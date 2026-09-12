import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { useAuth } from './auth';
import { toFrenchError } from './errors';
import { useSettings } from '../hooks/useSettings';
import type { PomodoroControlAction } from '../env';
import {
  advancePhase,
  checkpointNoteLabel,
  completePhase,
  consolidateDuration,
  partialMinutesElapsed,
  pauseSession,
  resumeSession,
  startSession,
  type PomodoroDurations,
  type PomodoroSession,
} from './pomodoroLogic';

interface PomodoroContextValue {
  session: PomodoroSession | null;
  durations: PomodoroDurations | null;
  note: string;
  setNote: (note: string) => void;
  error: string | null;
  pinned: boolean;
  cycleCompletedAt: number | null;
  start: (skillId: string, skillName: string, workMinutes: number) => void;
  pause: () => void;
  resume: () => void;
  advance: () => void;
  stop: () => Promise<void>;
  switchEngagement: (skillId: string, skillName: string) => Promise<void>;
  switching: boolean;
  setPinned: (pinned: boolean) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { session: authSession } = useAuth();
  const { settings } = useSettings();
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinnedState] = useState(false);
  const [cycleCompletedAt, setCycleCompletedAt] = useState<number | null>(null);

  // Toujours la dernière valeur dans le setInterval du tick, sans le
  // remettre en place à chaque changement de session (voir Step 2).
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const settingsDurations: PomodoroDurations | null = settings
    ? {
        workMinutes: settings.pomodoroWorkMinutes,
        shortBreakMinutes: settings.pomodoroShortBreakMinutes,
        longBreakMinutes: settings.pomodoroLongBreakMinutes,
        cyclesBeforeLongBreak: settings.pomodoroCyclesBeforeLongBreak,
      }
    : null;
  // Figée une fois à start() (durée de travail choisie au lancement,
  // pauses/cycles des Réglages au moment du lancement) et remise à null à
  // l'arrêt — sans ça, changer les Réglages pendant qu'une session tourne
  // changerait la durée des phases de travail suivantes en plein milieu.
  const [sessionDurations, setSessionDurations] = useState<PomodoroDurations | null>(null);
  const durations = sessionDurations ?? settingsDurations;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;

  // Même raison que sessionRef/durationsRef, mais pour stop() : il peut être
  // invoqué depuis le listener onControl monté une seule fois (deps [], plus
  // bas), dont la fermeture fige authSession/note tels qu'ils étaient au
  // tout premier rendu. pause/resume/advance échappent au problème car ils
  // ne lisent que via setSession(current => ...) ou durationsRef ; stop()
  // lit authSession.user.id et note directement, donc sans ces refs un Arrêt
  // déclenché depuis l'overlay écrirait toujours note: null (la note tapée
  // dans l'écran Pomodoro serait perdue) et utiliserait un authSession
  // potentiellement périmé.
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;
  const noteRef = useRef(note);
  noteRef.current = note;

  // Verrou de ré-entrance PARTAGÉ entre stop() et switchEngagement() — les
  // deux soldent les checkpoints accumulés via flushSession() en lisant
  // sessionRef.current avant leur premier await. Sans un verrou commun, un
  // stop() et un switchEngagement() qui se chevauchent (ou deux
  // switchEngagement() successifs — le sélecteur natif de Pomodoro.tsx est
  // un <select> replié, et Chromium déclenche `change` à chaque flèche du
  // clavier, donc deux appels peuvent partir dans le même aller-retour
  // réseau) liraient tous deux le même sessionRef.current pas encore mis à
  // jour et solderaient deux fois les mêmes checkpoints — minutes de
  // pratique comptées en double, ou pire, une entrée de 0 minute si le
  // second à démarrer voit ses checkpoints déjà supprimés par le premier
  // (voir flushSession). Voir le commentaire sur stop() plus bas.
  const flushLockRef = useRef(false);
  // Reflet React de flushLockRef, uniquement pour désactiver le sélecteur
  // « Enchaîner sur un autre engagement » pendant qu'un changement
  // d'engagement est en vol (Pomodoro.tsx) — flushLockRef seul ne
  // déclenche pas de re-render.
  const [switching, setSwitching] = useState(false);

  // Notifie le process main à chaque transition, pour relais vers l'overlay
  // (voir Task 4) — pas à chaque tick, cf. Global Constraints.
  useEffect(() => {
    window.api?.pomodoro?.reportState?.(
      session && durationsRef.current ? { session, durations: durationsRef.current } : null
    );
  }, [session]);

  // Filet de sécurité si le Provider se démonte alors qu'une session
  // épinglée est encore active (ex. déconnexion) : sans ça, l'overlay reste
  // visible et continue de capturer les clics indéfiniment, orphelin de
  // toute fenêtre principale pour le désépingler. `reportState(null)` est
  // tout aussi nécessaire que `setPinned(false)` ici : sans lui,
  // `hasActiveSession` reste vrai côté process main (voir
  // src/main/pomodoroOverlay.ts), donc réduire la fenêtre après une
  // déconnexion en pleine session ré-affiche l'overlay — figé sur une
  // session morte, ses boutons relayant vers un renderer qui n'a plus de
  // Provider pour les recevoir — par-dessus l'écran de connexion.
  useEffect(() => {
    return () => {
      window.api?.pomodoro?.setPinned?.(false);
      window.api?.pomodoro?.reportState?.(null);
    };
  }, []);

  const logCheckpoint = useCallback(
    async (minutes: number, cycleIndex: number, cyclesBeforeLongBreak: number, skillId: string) => {
      if (!authSession || minutes <= 0) return;
      const { data, error: insertError } = await getSupabaseClient()
        .from('practice_entry')
        .insert({
          engagement_id: skillId,
          user_id: authSession.user.id,
          duration_minutes: minutes,
          note: checkpointNoteLabel(cycleIndex, cyclesBeforeLongBreak),
        })
        .select('id')
        .single();
      if (insertError) {
        setError(toFrenchError(insertError.message));
        return;
      }
      setSession((current) =>
        current ? { ...current, loggedEntryIds: [...current.loggedEntryIds, data.id as string] } : current
      );
    },
    [authSession]
  );

  const notifyPhaseChange = useCallback(
    (phase: PomodoroSession['phase'], skillName: string) => {
      if (!settings?.notificationsEnabled || typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') Notification.requestPermission();
      if (Notification.permission !== 'granted') return;
      const label = phase === 'work' ? 'Travail' : phase === 'shortBreak' ? 'Pause courte' : 'Pause longue';
      new Notification('Saint Daily', { body: `${label} — ${skillName}` });
    },
    [settings?.notificationsEnabled]
  );

  // Tick : vérifie chaque seconde si la phase en cours vient de se
  // terminer. Ne pousse PAS d'état à chaque tick (l'affichage local de
  // chaque fenêtre se recalcule depuis phaseEndsAt) — seulement au moment
  // d'une transition réelle.
  useEffect(() => {
    if (!session || session.status !== 'running' || !durations) return;
    const id = window.setInterval(() => {
      const current = sessionRef.current;
      const currentDurations = durationsRef.current;
      if (!current || current.status !== 'running' || !currentDurations) return;
      // Empêche le tick de ressusciter une session que stop() (ou de
      // court-circuiter un switchEngagement()) est en train de solder :
      // sans ce garde-fou, un tick qui se déclenche entre les appels
      // Supabase de flushSession() et la mise à jour finale de l'état
      // relirait un sessionRef.current sur le point d'être invalidé.
      if (flushLockRef.current) return;
      // Number.isFinite d'abord : `now < NaN` vaut toujours false en JS, donc
      // sans ce garde-fou, un phaseEndsAt corrompu (settings dont les
      // colonnes Pomodoro manquent côté base, par ex.) ferait échouer la
      // comparaison "ouvert" — chaque tick serait traité comme une phase
      // terminée, avec une boucle d'avancement de cycle sans fin. On
      // s'arrête plutôt en silence et on attend un phaseEndsAt valide.
      if (!Number.isFinite(current.phaseEndsAt)) return;
      if (Date.now() < current.phaseEndsAt) return;

      const cycleIndexBeforeCompletion = current.cycleIndex;
      const skillNameForNotification = current.skillName;
      const { loggedMinutes, next } = completePhase(
        current,
        currentDurations,
        settings?.pomodoroAutoAdvance ?? true
      );
      setSession(next);
      if (current.phase === 'work' && next.phase === 'longBreak') {
        // Auto-effacé après un délai plutôt que par un "consume" explicite
        // côté écran. La fenêtre (2.5s) est volontairement courte plutôt que
        // de garantir "ne rejoue jamais" : si Pomodoro.tsx démonte/remonte
        // (navigation) DANS cette fenêtre, l'effet qui lit cycleCompletedAt
        // au montage rejoue la célébration — c'est voulu (mieux vaut montrer
        // une célébration qu'on aurait pu manquer que la perdre en
        // silence), pas un bug. Le but est seulement d'éviter de la rejouer
        // longtemps après coup.
        const completedAt = Date.now();
        setCycleCompletedAt(completedAt);
        setTimeout(() => {
          setCycleCompletedAt((c) => (c === completedAt ? null : c));
        }, 2500);
      }
      notifyPhaseChange(next.phase, skillNameForNotification);
      if (loggedMinutes > 0) {
        void logCheckpoint(loggedMinutes, cycleIndexBeforeCompletion, currentDurations.cyclesBeforeLongBreak, current.skillId);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [session?.status, durations, settings?.pomodoroAutoAdvance, logCheckpoint, notifyPhaseChange]);

  // Applique les actions de contrôle déclenchées depuis l'overlay — un seul
  // point de mutation, que le clic parte de la fenêtre principale ou de
  // l'overlay (voir spec, section "Fenêtres & IPC"). Monté une seule fois :
  // pause/resume/advance/stop restent valables au-delà du premier rendu
  // grâce à sessionRef/durationsRef/authSessionRef/noteRef (voir plus haut).
  useEffect(() => {
    const unsubscribe = window.api?.pomodoro?.onControl?.((action: PomodoroControlAction) => {
      if (action === 'pause') pause();
      else if (action === 'resume') resume();
      else if (action === 'advance') advance();
      else if (action === 'stop') void stop();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(skillId: string, skillName: string, workMinutes: number) {
    if (!settingsDurations) return;
    const effective: PomodoroDurations = { ...settingsDurations, workMinutes };
    setSessionDurations(effective);
    setError(null);
    setNote('');
    setSession(startSession(skillId, skillName, effective));
  }

  function pause() {
    setSession((current) => (current && current.status === 'running' ? pauseSession(current) : current));
  }

  function resume() {
    setSession((current) => (current && current.status === 'paused' ? resumeSession(current) : current));
  }

  function advance() {
    setSession((current) =>
      current && current.status === 'awaitingAdvance' && durationsRef.current
        ? advancePhase(current, durationsRef.current)
        : current
    );
  }

  /**
   * Solde la session en cours : convertit les checkpoints accumulés en une
   * unique entrée de pratique pour l'engagement **actuellement ciblé**, puis
   * supprime les checkpoints.
   *
   * Extrait de `stopInternal` sans changement de comportement, pour que le
   * changement d'engagement en cours de session puisse solder l'ancien avant
   * de basculer. Sans ce solde, la consolidation finale attribuerait tout le
   * temps de la session au dernier engagement ciblé, y compris les cycles
   * faits sur le précédent.
   */
  async function flushSession(
    current: PomodoroSession,
    currentDurations: PomodoroDurations,
    currentAuthSession: Session
  ): Promise<void> {
    const partialMinutes =
      current.status !== 'awaitingAdvance' && current.phase === 'work'
        ? partialMinutesElapsed(current, currentDurations)
        : 0;
    let entryIds = current.loggedEntryIds;
    if (partialMinutes > 0) {
      const { data, error: insertError } = await getSupabaseClient()
        .from('practice_entry')
        .insert({
          engagement_id: current.skillId,
          user_id: currentAuthSession.user.id,
          duration_minutes: partialMinutes,
          note: checkpointNoteLabel(current.cycleIndex, currentDurations.cyclesBeforeLongBreak),
        })
        .select('id')
        .single();
      if (insertError) {
        setError(toFrenchError(insertError.message));
      } else {
        entryIds = [...entryIds, data.id as string];
      }
    }

    if (entryIds.length > 0) {
      const supabase = getSupabaseClient();
      const { data: rows, error: fetchError } = await supabase
        .from('practice_entry')
        .select('duration_minutes')
        .in('id', entryIds);
      if (fetchError) {
        setError(toFrenchError(fetchError.message));
      } else {
        // Insertion AVANT suppression : si la consolidée échoue à
        // s'insérer (réseau coupé, session expirée), les checkpoints
        // restent intacts — dégradation acceptée vers "les checkpoints
        // existent encore", jamais vers une perte silencieuse (voir spec).
        // Pire cas si la suppression échoue ensuite : un doublon visible et
        // corrigeable dans le journal, pas une perte.
        const total = consolidateDuration((rows as { duration_minutes: number }[]).map((r) => r.duration_minutes));
        // total === 0 signifie qu'il n'y a rien à consolider — soit
        // entryIds pointait déjà vers des lignes supprimées par un autre
        // flushSession() (deux appels qui se sont chevauchés malgré
        // flushLockRef ; défense en profondeur), soit consolidateDuration([])
        // sur un tableau vide. Insérer quand même produirait une entrée de
        // pratique de 0 minute, visible et trompeuse dans le journal.
        if (total > 0) {
          const noteAtStop = noteRef.current.trim();
          const { error: insertError } = await supabase.from('practice_entry').insert({
            engagement_id: current.skillId,
            user_id: currentAuthSession.user.id,
            duration_minutes: total,
            note: noteAtStop ? noteAtStop : null,
          });
          if (insertError) {
            setError(toFrenchError(insertError.message));
          } else {
            const { error: deleteError } = await supabase.from('practice_entry').delete().in('id', entryIds);
            if (deleteError) setError(toFrenchError(deleteError.message));
          }
        }
      }
    }
  }

  async function stopInternal() {
    const current = sessionRef.current;
    const currentDurations = durationsRef.current;
    const currentAuthSession = authSessionRef.current;
    if (!current || !currentAuthSession || !currentDurations) {
      setSession(null);
      setSessionDurations(null);
      return;
    }
    setError(null);

    await flushSession(current, currentDurations, currentAuthSession);

    setSession(null);
    setSessionDurations(null);
    setNote('');
    // Désépingle l'overlay : sans ça, la fenêtre transparente reste
    // parquée en haut à droite après la fin d'une session, capturant les
    // clics dans sa zone même invisible (comportement Electron sur les
    // fenêtres transparentes).
    setPinned(false);
  }

  /**
   * Change l'engagement ciblé sans interrompre le minuteur. Le temps déjà
   * accumulé est soldé au profit de l'engagement qu'on quitte, et la session
   * repart avec une liste de checkpoints vide.
   */
  async function switchEngagement(skillId: string, skillName: string) {
    const current = sessionRef.current;
    const currentDurations = durationsRef.current;
    const currentAuthSession = authSessionRef.current;
    if (!current || !currentDurations || !currentAuthSession) return;
    if (current.skillId === skillId) return;
    // Même verrou que stop() (flushLockRef) et même raison : sans lui, deux
    // switchEngagement() qui se chevauchent (deux flèches clavier sur le
    // <select> dans le même aller-retour réseau) ou un switchEngagement()
    // et un stop() concurrents liraient tous deux le même
    // sessionRef.current pas encore mis à jour et solderaient deux fois les
    // mêmes checkpoints. Un stop() qui arrive pendant qu'un
    // switchEngagement() est en vol est donc silencieusement ignoré plutôt
    // que de risquer la double consolidation — l'utilisateur peut recliquer
    // Arrêter une fois le switch terminé.
    if (flushLockRef.current) return;
    flushLockRef.current = true;
    setSwitching(true);
    try {
      setError(null);
      await flushSession(current, currentDurations, currentAuthSession);
      setNote('');
      setSession((session) =>
        session ? { ...session, skillId, skillName, loggedEntryIds: [] } : session
      );
    } finally {
      flushLockRef.current = false;
      setSwitching(false);
    }
  }

  async function stop() {
    // Sans ce verrou, un double-clic sur Arrêter (ou une course entre la
    // fenêtre principale et l'overlay, ou avec un switchEngagement() en
    // vol) relirait le même sessionRef.current pas encore remis à null et
    // consoliderait deux fois — une deuxième entrée consolidée, minutes
    // comptées en double. pause/resume/advance n'ont pas besoin de ce
    // verrou : ils passent par setSession(current => ...), qui se base sur
    // l'état React réel, pas un ref figé.
    if (flushLockRef.current) return;
    flushLockRef.current = true;
    try {
      await stopInternal();
    } finally {
      flushLockRef.current = false;
    }
  }

  function setPinned(next: boolean) {
    setPinnedState(next);
    window.api?.pomodoro?.setPinned?.(next);
  }

  return (
    <PomodoroContext.Provider
      value={{
        session,
        durations,
        note,
        setNote,
        error,
        pinned,
        cycleCompletedAt,
        start,
        pause,
        resume,
        advance,
        stop,
        switchEngagement,
        switching,
        setPinned,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro doit être utilisé dans un PomodoroProvider');
  return ctx;
}

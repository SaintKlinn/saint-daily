import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabase';
import { usePomodoro } from '../lib/pomodoro';
import { choisirSkillsRapides } from '../lib/actionsRapides';

// Même rythme que l'infobulle du tray (useTrayNextEngagement) : une séance
// loguée apparaît dans le menu au plus une minute plus tard.
const REFRESH_INTERVAL_MS = 60_000;
const SEANCES_CONSIDEREES = 100;

/**
 * Menu du tray : envoie au process main les skills récents (pour « Logger
 * une séance » et « Démarrer un pomodoro ») et exécute les pomodoros
 * demandés depuis ce menu. Monté sous `PomodoroProvider`, dont il a besoin
 * pour démarrer une session.
 */
export function useActionsRapidesTray(): void {
  const navigate = useNavigate();
  const pomodoro = usePomodoro();
  // Le listener IPC est enregistré une fois ; il lit l'état courant ici.
  const pomodoroRef = useRef(pomodoro);
  pomodoroRef.current = pomodoro;

  useEffect(() => {
    if (!window.api?.setTrayQuickSkills) return;
    let cancelled = false;
    async function refresh() {
      const supabase = getSupabaseClient();
      const [skillsRes, seancesRes] = await Promise.all([
        supabase.from('engagement').select('*').is('archived_at', null).is('scheduled_at', null).eq('is_project', false),
        supabase
          .from('practice_entry')
          .select('engagement_id')
          .order('practiced_at', { ascending: false })
          .limit(SEANCES_CONSIDEREES),
      ]);
      if (cancelled || skillsRes.error || seancesRes.error) return;
      // `deleted_at` filtré ici plutôt que dans la requête, comme dans
      // useTrayNextEngagement.
      const skills = ((skillsRes.data ?? []) as { id: string; name: string; deleted_at?: string | null }[]).filter(
        (s) => !s.deleted_at
      );
      const idsRecents = ((seancesRes.data ?? []) as { engagement_id: string }[]).map((r) => r.engagement_id);
      window.api?.setTrayQuickSkills?.(choisirSkillsRapides(skills, idsRecents));
    }
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(
    () =>
      window.api?.onTrayPomodoroStart?.(({ skillId, skillName, fenetreVisible }) => {
        const { session, durations, start, setPinned } = pomodoroRef.current;
        // Une session déjà en cours n'est jamais remplacée depuis le tray :
        // on la montre, c'est tout.
        if (!session && durations) start(skillId, skillName, durations.workMinutes);
        // Sans réglages chargés, rien n'a démarré : épingler l'overlay
        // laisserait une fenêtre transparente et vide capturer les clics en
        // haut à droite de l'écran, sans moyen de la retirer. On montre
        // plutôt l'écran Pomodoro, dont le bouton dit alors que les
        // réglages ne sont pas chargés. Sans session, `durations` non nul
        // vaut les réglages chargés — la condition même sous laquelle
        // `start` démarre : `minuteurEnCours` dit donc vrai.
        const minuteurEnCours = Boolean(session) || Boolean(durations);
        if (fenetreVisible || !minuteurEnCours) {
          if (!fenetreVisible) window.api?.focusWindow?.();
          navigate('/pomodoro');
        } else {
          setPinned(true);
        }
      }),
    [navigate]
  );
}

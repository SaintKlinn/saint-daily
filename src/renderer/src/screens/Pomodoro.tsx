import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePomodoro } from '../lib/pomodoro';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { EXTENSION_MINUTES, phaseTotalMs } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import SkillPicker from '../components/SkillPicker';
import EmptyState from '../components/EmptyState';
import PointsCycles from '../components/PointsCycles';
import { colors } from '../theme/colors';
import { EASE_SORTIE } from '../theme/mouvement';
import { derniersJours } from '../lib/historiquePomodoro';
import { resumeRecap } from '../lib/recapPomodoro';
import { formatMinutes } from '../lib/retrospective';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

const PRESET_WORK_MINUTES = [15, 25, 50];

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { engagements, loading: skillsLoading } = useEngagements();
  const skills = engagements.filter((e) => !e.scheduledAt && !e.isProject);
  const activeSkills = skills.filter((s) => !s.archivedAt);
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(activeSkills.map((s) => s.id));
  const {
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
    extend,
    skipBreak,
    restored,
    historique,
    recap,
    fermerRecap,
    stop,
    switchEngagement,
    switching,
    setPinned,
  } = usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  // Le sélecteur ne liste que des skills, mais une cible arrivée par lien
  // profond peut être une tâche planifiée (« Démarrer un pomodoro » depuis
  // le calendrier). On la résout donc dans l'ensemble des engagements
  // praticables, projets exclus — ils n'ont pas d'historique de pratique.
  const selectedSkill =
    engagements.find((e) => e.id === skillId && !e.isProject && !e.archivedAt) ?? null;
  // null = pas encore touché par l'utilisateur ; résout alors sur la durée
  // des Réglages dès qu'elle est connue (voir effectiveWorkMinutes) — donc
  // rien ne change tant que personne ne choisit explicitement un preset.
  const [workMinutesChoice, setWorkMinutesChoice] = useState<number | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const effectiveWorkMinutes = workMinutesChoice ?? durations?.workMinutes ?? null;

  // PomodoroProvider ne pousse un nouvel état qu'aux transitions de phase,
  // pas à chaque tick (voir lib/pomodoro.tsx) — donc rien d'autre ne force
  // un re-render de cet écran chaque seconde. Sans ce tick local, le calcul
  // de remainingMs plus bas (basé sur Date.now()) resterait figé à sa
  // valeur du dernier vrai re-render. Même pattern que PomodoroOverlay.tsx.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.status]);

  const [showCycleComplete, setShowCycleComplete] = useState(false);
  useEffect(() => {
    if (!cycleCompletedAt) return;
    setShowCycleComplete(true);
    const id = setTimeout(() => setShowCycleComplete(false), 2000);
    return () => clearTimeout(id);
  }, [cycleCompletedAt]);

  // Espace : l'action principale du moment (Pause, Reprendre ou Continuer),
  // comme sur un lecteur. Ignoré quand le focus est dans un champ ou sur un
  // contrôle, où Espace a déjà son propre sens — taper une note, activer le
  // bouton qui a le focus (ce qui ferait sinon l'action deux fois).
  useEffect(() => {
    if (!session) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const cible = event.target as HTMLElement | null;
      if (cible?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      event.preventDefault();
      if (session?.status === 'awaitingAdvance') advance();
      else if (session?.status === 'paused') resume();
      else pause();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, advance, resume, pause]);

  const aujourdhui = derniersJours(historique, 1)[0];
  const resumeFin = recap ? resumeRecap(recap) : null;

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-md flex-col gap-6"
      >
        <div>
          <h1 className="font-serif text-titre-ecran text-champagne">Pomodoro</h1>
          {/* Toujours affiché, zéro compris : c'est un repère de la journée,
              pas une récompense qui n'apparaîtrait qu'une fois méritée. */}
          <p className="mt-1 text-secondaire text-muted">
            Aujourd'hui : {aujourdhui.cycles} pomodoro{aujourdhui.cycles > 1 ? 's' : ''}
            {aujourdhui.minutes > 0 && ` · ${formatMinutes(aujourdhui.minutes)}`}
          </p>
        </div>
        {resumeFin && (
          // Clôt la session qu'on vient d'arrêter sur ce qu'elle a produit,
          // plutôt que de retomber sans transition sur l'écran de démarrage.
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE_SORTIE }}
            className="relative flex items-start justify-between gap-4 overflow-hidden border border-accent-bright/35 px-6 py-4"
            style={{
              background: `linear-gradient(160deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 70%, ${colors.accent.bright}14 100%)`,
            }}
          >
            <RayCorner variant={2} />
            <div className="relative">
              <p className="font-serif text-titre text-accent-bright">{resumeFin.titre}</p>
              <p className="mt-1 text-secondaire text-muted">{resumeFin.detail}</p>
            </div>
            <button
              type="button"
              onClick={fermerRecap}
              aria-label="Fermer le récapitulatif"
              className={`relative shrink-0 px-2 py-1 font-data text-libelle uppercase tracking-[0.1em] text-muted hover:text-champagne ${FOCUS_RING}`}
            >
              OK
            </button>
          </motion.div>
        )}
        {error && (
          <p role="alert" className="text-corps text-danger">
            {error}
          </p>
        )}
        {selectedSkill && !activeSkills.some((s) => s.id === selectedSkill.id) && (
          // Cible résolue depuis un lien profond (ex. "Démarrer un pomodoro"
          // sur une tâche planifiée du calendrier) mais absente du
          // sélecteur, qui ne liste que des skills sans horaire — sans ce
          // rappel visible, l'écran arrive avec rien de surligné et semble
          // avoir ignoré la demande.
          <p className="text-corps text-muted">
            Pomodoro pour <span className="text-champagne">{selectedSkill.name}</span>
          </p>
        )}
        {/* Sans skill actif, le sélecteur disait « Aucun skill ne
            correspond » au-dessus d'un Démarrer grisé : une impasse. On dit
            plutôt ce qu'il manque et on y mène. Pas pendant le chargement,
            ni pour une cible arrivée par lien profond (tâche planifiée). */}
        {!skillsLoading && activeSkills.length === 0 && !selectedSkill ? (
          skills.length === 0 ? (
            <EmptyState titre="Il te faut un skill" action={{ libelle: 'Créer un skill', vers: '/skills/nouveau' }}>
              Un pomodoro se rattache à un skill : le temps de chaque cycle est enregistré sur lui.
            </EmptyState>
          ) : (
            <EmptyState action={{ libelle: 'Voir mes skills', vers: '/skills' }}>
              Tous tes skills sont en pause. Réactives-en un pour lancer un pomodoro dessus.
            </EmptyState>
          )
        ) : (
          <>
          <SkillPicker
            skills={activeSkills}
            entriesBySkill={entriesBySkill}
            value={skillId}
            onChange={setSkillId}
            loading={skillsLoading}
          />
          {entriesError && (
            <p role="alert" className="text-corps text-danger">
              {entriesError}
            </p>
          )}
          {selectedSkill && (
            <div className="flex flex-col gap-2">
              <p className="text-libelle uppercase tracking-[0.04em] text-muted">Durée de travail</p>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_WORK_MINUTES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setWorkMinutesChoice(preset);
                      setCustomMinutesInput('');
                    }}
                    aria-pressed={effectiveWorkMinutes === preset}
                    className={`font-data text-secondaire px-3 py-2 transition-colors duration-150 ${FOCUS_RING} ${effectiveWorkMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
                  >
                    {preset} min
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={
                    customMinutesInput !== ''
                      ? customMinutesInput
                      : effectiveWorkMinutes !== null && !PRESET_WORK_MINUTES.includes(effectiveWorkMinutes)
                        ? String(effectiveWorkMinutes)
                        : ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCustomMinutesInput(raw);
                    if (raw.trim() === '') {
                      setWorkMinutesChoice(null);
                      return;
                    }
                    const parsed = Math.floor(Number(raw));
                    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 240) setWorkMinutesChoice(parsed);
                  }}
                  placeholder="Personnalisé"
                  aria-label="Durée de travail personnalisée en minutes"
                  className={`w-28 border bg-ink-800 px-3 py-2 font-data text-secondaire normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING} ${effectiveWorkMinutes !== null && !PRESET_WORK_MINUTES.includes(effectiveWorkMinutes) ? 'border-accent-bright' : 'border-ink-700'}`}
                />
              </div>
            </div>
          )}
          <Button
            variant="primary"
            disabled={!selectedSkill || !durations || effectiveWorkMinutes === null}
            onClick={() => {
              if (selectedSkill && effectiveWorkMinutes !== null) start(selectedSkill.id, selectedSkill.name, effectiveWorkMinutes);
            }}
          >
            Démarrer
          </Button>
          </>
        )}
      </motion.div>
    );
  }

  if (!durations) return null; // ne peut pas arriver : une session active implique que les réglages ont déjà chargé

  const totalMs = phaseTotalMs(session, durations);
  const remainingMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - Date.now());
  const filled = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const phaseLabel = session.phase === 'work' ? 'Travail' : session.phase === 'shortBreak' ? 'Pause courte' : 'Pause longue';
  const enPause = session.phase !== 'work';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-8"
    >
      {/* Deux halos superposés, l'un or pour le travail, l'autre vert d'eau
          pour les pauses, en fondu enchaîné : la carte change d'ambiance au
          changement de phase sans qu'un dégradé ait à s'interpoler (ce que
          CSS ne sait pas faire). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${enPause ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${colors.accent.bright}14, transparent 70%)` }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${enPause ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${colors.repos}1f, transparent 70%)` }}
      />
      <RayCorner variant={0} />
      <div className="relative flex flex-col items-center gap-3">
        <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">{session.skillName}</p>
        <PointsCycles
          cycleIndex={session.cycleIndex}
          total={durations.cyclesBeforeLongBreak}
          phase={session.phase}
        />
      </div>
      <div className="relative flex flex-col items-center gap-2">
        <motion.div
          className="flex items-center justify-center rounded-full"
          animate={
            showCycleComplete
              ? { scale: [1, 1.06, 1], filter: `drop-shadow(0 0 18px ${colors.accent.bright}99)` }
              : { scale: 1, filter: 'none' }
          }
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <ProgressRing
            size={160}
            radius={70}
            strokeWidth={6}
            filled={Math.max(0, Math.min(1, filled))}
            couleur={enPause ? colors.repos : colors.accent.bright}
          />
        </motion.div>
        {/* `text-heros` et non `titre-ecran` : c'est le minuteur, donc le
            point focal de l'écran, et la spec lui attribue nommément ce
            rôle. Il rejoint ainsi le minuteur du mode focus, qui est déjà
            en `heros` — les deux afficheurs de compte à rebours de l'app
            n'ont aucune raison d'être à deux tailles différentes. */}
        <p className="font-serif text-heros text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p
          className={`font-data text-libelle uppercase tracking-[0.1em] transition-colors duration-700 ${
            enPause ? 'text-repos' : 'text-accent-bright'
          }`}
        >
          {phaseLabel}
        </p>
        {/* Toujours monté (jamais démonté/remonté) : sinon son apparition
            pousserait la rangée de boutons Pause/Continuer/Arrêter/Épingler
            plus bas dans la colonne flex, un reflow perceptible pile au
            moment où l'utilisateur vise ces boutons. La visibilité passe par
            `animate`, pas par le montage, pour aussi avoir une vraie
            animation de sortie (le démontage React coupait le fade-in de
            400ms net, sans transition retour). */}
        <motion.p
          initial={false}
          animate={showCycleComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          className="font-data text-libelle uppercase tracking-[0.1em] text-muted"
        >
          {showCycleComplete ? 'Cycle terminé' : ''}
        </motion.p>
      </div>

      {restored && (
        // Session relue au lancement (voir restoreSession) : sans ce mot,
        // retrouver un minuteur en pause qu'on n'a pas mis en pause
        // semblerait être un bug.
        <p role="status" className="relative text-center text-secondaire text-muted">
          Session retrouvée après la fermeture de l'app. Elle t'attend en pause, là où elle s'était arrêtée.
        </p>
      )}

      {error && (
        <p role="alert" className="relative text-corps text-danger">
          {error}
        </p>
      )}

      <div className="relative flex flex-wrap items-center justify-center gap-3">
        {session.status === 'awaitingAdvance' ? (
          <Button variant="primary" onClick={advance}>
            Continuer
          </Button>
        ) : (
          <Button variant="secondary" onClick={session.status === 'paused' ? resume : pause}>
            {session.status === 'paused' ? 'Reprendre' : 'Pause'}
          </Button>
        )}
        <button
          onClick={() => void stop()}
          // Pendant une bascule d'engagement, `stop()` est bloqué par le
          // verrou de solde et ne ferait rien : mieux vaut un bouton
          // visiblement indisponible qu'un bouton qui ignore le clic.
          disabled={switching}
          className={`border border-ink-700 px-6 py-3 font-sans text-corps text-muted transition-[color,transform] duration-150 ease-out hover:text-danger active:scale-[0.97] disabled:opacity-60 disabled:hover:text-muted ${FOCUS_RING}`}
        >
          Arrêter
        </button>
        <button
          onClick={() => setPinned(!pinned)}
          aria-pressed={pinned}
          className={`border px-6 py-3 font-sans text-corps transition-[color,transform] duration-150 ease-out active:scale-[0.97] ${FOCUS_RING} ${pinned ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted hover:text-champagne'}`}
        >
          {pinned ? 'Détacher' : 'Épingler'}
        </button>
      </div>

      {/* Actions secondaires, sur leur propre rangée et en petit : elles
          ajustent la phase en cours sans être l'action du moment. */}
      {(session.phase !== 'work' || session.status !== 'awaitingAdvance') && (
        <div className="relative -mt-2 flex flex-wrap items-center justify-center gap-2">
          {session.status !== 'awaitingAdvance' && (
            <Button size="sm" onClick={extend}>
              +{EXTENSION_MINUTES} min
            </Button>
          )}
          {session.phase !== 'work' && (
            <Button size="sm" onClick={skipBreak}>
              Passer la pause
            </Button>
          )}
        </div>
      )}
      <p className="relative -mt-2 font-data text-libelle text-muted">
        Espace : {session.status === 'awaitingAdvance' ? 'continuer' : 'pause / reprise'}
      </p>

      <label className="relative flex w-full flex-col gap-1 text-libelle uppercase tracking-[0.04em] text-muted">
        Note (optionnelle)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ce sur quoi tu travailles…"
          className={`border border-ink-700 bg-ink-800 px-3 py-3 font-sans text-corps normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
      </label>

      {
        // Le statut awaitingAdvance couvre le cas manuel (pomodoroAutoAdvance
        // = false), mais avec le réglage par défaut (true, voir Réglages) la
        // session ne s'y arrête jamais — sans la condition sur la phase,
        // personne ne verrait jamais ce sélecteur. Une pause (courte ou
        // longue) est le second moment sûr : partialMinutesElapsed y vaut
        // toujours 0 dans flushSession (voir lib/pomodoro.tsx), donc changer
        // de cible n'y coupe jamais un cycle de travail en deux. Ne JAMAIS
        // l'étendre à une phase 'work' en cours (status 'running' ou
        // 'paused') — ce serait précisément le découpage qu'on évite.
        (session.status === 'awaitingAdvance' || session.phase === 'shortBreak' || session.phase === 'longBreak') && (
          <div className="relative mt-4 flex w-full flex-col gap-1 border-t border-ink-700 pt-4">
            <label htmlFor="pomodoro-switch" className="font-data text-libelle uppercase tracking-[0.1em] text-muted">
              Enchaîner sur un autre skill
            </label>
            <select
              id="pomodoro-switch"
              value=""
              disabled={switching}
              onChange={(e) => {
                const next = activeSkills.find((s) => s.id === e.target.value);
                if (next) void switchEngagement(next.id, next.name);
              }}
              className={`w-full border border-ink-700 bg-ink-800 px-3 py-2 text-secondaire text-champagne disabled:opacity-60 ${FOCUS_RING}`}
            >
              <option value="">Continuer sur {session.skillName}</option>
              {activeSkills
                .filter((s) => s.id !== session.skillId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <p className="text-secondaire text-muted">
              Le temps déjà fait est enregistré sur {session.skillName} avant de basculer.
            </p>
          </div>
        )
      }
    </motion.div>
  );
}

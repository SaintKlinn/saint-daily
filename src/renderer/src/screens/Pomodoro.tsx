import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import SkillPicker from '../components/SkillPicker';
import { colors } from '../theme/colors';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

const PRESET_WORK_MINUTES = [15, 25, 50];

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));
  const { session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
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

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-md flex-col gap-5"
      >
        <h1 className="font-serif text-2xl text-champagne">Pomodoro</h1>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SkillPicker skills={skills} entriesBySkill={entriesBySkill} value={skillId} onChange={setSkillId} />
        {skillId && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Durée de travail</p>
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
                  className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${effectiveWorkMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
                >
                  {preset} min
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={customMinutesInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomMinutesInput(raw);
                  const parsed = Number(raw);
                  if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) setWorkMinutesChoice(parsed);
                }}
                placeholder="Personnalisé"
                aria-label="Durée de travail personnalisée en minutes"
                className={`w-28 border bg-ink-800 px-3 py-1.5 font-data text-xs normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING} ${effectiveWorkMinutes !== null && !PRESET_WORK_MINUTES.includes(effectiveWorkMinutes) ? 'border-accent-bright' : 'border-ink-700'}`}
              />
            </div>
          </div>
        )}
        <Button
          variant="primary"
          disabled={!skillId || effectiveWorkMinutes === null}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill && effectiveWorkMinutes !== null) start(skill.id, skill.name, effectiveWorkMinutes);
          }}
        >
          Démarrer
        </Button>
      </motion.div>
    );
  }

  if (!durations) return null; // ne peut pas arriver : une session active implique que les réglages ont déjà chargé

  const totalMs = phaseDurationMinutes(session.phase, durations) * 60_000;
  const remainingMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - Date.now());
  const filled = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const phaseLabel = session.phase === 'work' ? 'Travail' : session.phase === 'shortBreak' ? 'Pause courte' : 'Pause longue';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-9"
    >
      <RayCorner variant={0} />
      <p className="relative font-data text-[11px] uppercase tracking-[0.1em] text-muted">
        {session.skillName} · cycle {session.cycleIndex + 1}/{durations.cyclesBeforeLongBreak}
      </p>
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
          <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        </motion.div>
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
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
          className="font-data text-xs uppercase tracking-[0.1em] text-muted"
        >
          {showCycleComplete ? 'Cycle terminé' : ''}
        </motion.p>
      </div>

      {error && (
        <p role="alert" className="relative text-sm text-danger">
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
          className={`border border-ink-700 px-5 py-3 font-sans text-sm text-muted transition-[color,transform] duration-150 ease-out hover:text-danger active:scale-[0.97] ${FOCUS_RING}`}
        >
          Arrêter
        </button>
        <button
          onClick={() => setPinned(!pinned)}
          aria-pressed={pinned}
          className={`border px-5 py-3 font-sans text-sm transition-[color,transform] duration-150 ease-out active:scale-[0.97] ${FOCUS_RING} ${pinned ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted hover:text-champagne'}`}
        >
          {pinned ? 'Détacher' : 'Épingler'}
        </button>
      </div>

      <label className="relative flex w-full flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        Note (optionnelle)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ce sur quoi tu travailles…"
          className={`border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
      </label>
    </motion.div>
  );
}

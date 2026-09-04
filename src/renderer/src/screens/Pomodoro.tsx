import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { SelectField } from '../components/FormField';
import { colors } from '../theme/colors';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');

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
        <SelectField label="Skill" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Choisir…</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Button
          variant="primary"
          disabled={!skillId || !durations}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill) start(skill.id, skill.name);
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
          animate={showCycleComplete ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={showCycleComplete ? { filter: `drop-shadow(0 0 18px ${colors.accent.bright}99)` } : undefined}
        >
          <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        </motion.div>
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
        {showCycleComplete && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="font-data text-xs uppercase tracking-[0.1em] text-muted"
          >
            Cycle terminé
          </motion.p>
        )}
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
          className={`border border-ink-700 px-5 py-3 font-sans text-sm text-muted hover:text-danger ${FOCUS_RING}`}
        >
          Arrêter
        </button>
        <button
          onClick={() => setPinned(!pinned)}
          aria-pressed={pinned}
          className={`border px-5 py-3 font-sans text-sm ${FOCUS_RING} ${pinned ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted hover:text-champagne'}`}
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

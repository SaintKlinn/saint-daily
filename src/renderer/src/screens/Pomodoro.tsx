import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { session, durations, note, setNote, error, pinned, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h1 className="font-serif text-2xl text-champagne">Pomodoro</h1>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Skill
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne"
          >
            <option value="">Choisir…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!skillId || !durations}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill) start(skill.id, skill.name);
          }}
          className="bg-accent-bright px-5 py-2.5 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover disabled:opacity-60"
        >
          Démarrer
        </button>
      </div>
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
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={0} />
      <p className="relative font-data text-[11px] uppercase tracking-[0.1em] text-muted">
        {session.skillName} · cycle {session.cycleIndex + 1}/{durations.cyclesBeforeLongBreak}
      </p>
      <div className="relative flex flex-col items-center gap-2">
        <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
      </div>

      {error && (
        <p role="alert" className="relative text-sm text-danger">
          {error}
        </p>
      )}

      <div className="relative flex flex-wrap items-center justify-center gap-3">
        {session.status === 'awaitingAdvance' ? (
          <button
            onClick={advance}
            className="bg-accent-bright px-5 py-2.5 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover"
          >
            Continuer
          </button>
        ) : (
          <button
            onClick={session.status === 'paused' ? resume : pause}
            className="border border-ink-700 px-5 py-2.5 font-sans text-sm text-muted hover:text-champagne"
          >
            {session.status === 'paused' ? 'Reprendre' : 'Pause'}
          </button>
        )}
        <button
          onClick={() => void stop()}
          className="border border-ink-700 px-5 py-2.5 font-sans text-sm text-muted hover:text-danger"
        >
          Arrêter
        </button>
        <button
          onClick={() => setPinned(!pinned)}
          className={`border px-5 py-2.5 font-sans text-sm ${pinned ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted hover:text-champagne'}`}
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
          className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-champagne placeholder:text-muted focus:outline-none"
        />
      </label>
    </div>
  );
}

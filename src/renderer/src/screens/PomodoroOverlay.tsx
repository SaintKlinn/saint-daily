import { useEffect, useState } from 'react';
import ProgressRing from '../components/ProgressRing';
import type { PomodoroControlAction, PomodoroStateSnapshot } from '../env';

// Ne passe JAMAIS par PomodoroProvider/usePomodoro : cette fenêtre est un
// pur relais d'affichage + de clics IPC (voir spec, "Fenêtres & IPC"). Un
// second minuteur indépendant ici double-compterait les checkpoints.
export default function PomodoroOverlay() {
  const [snapshot, setSnapshot] = useState<PomodoroStateSnapshot | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => window.api?.pomodoro?.onState?.(setSnapshot), []);

  useEffect(() => {
    if (!snapshot) return;
    function tick() {
      if (!snapshot) return;
      const { session } = snapshot;
      const ms =
        session.status === 'paused' && session.remainingMsAtPause !== null
          ? session.remainingMsAtPause
          : Math.max(0, session.phaseEndsAt - Date.now());
      setRemainingMs(ms);
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [snapshot]);

  function sendControl(action: PomodoroControlAction) {
    window.api?.pomodoro?.sendControl?.(action);
  }

  if (!snapshot) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  const { session, durations } = snapshot;
  const totalMs =
    (session.phase === 'work'
      ? durations.workMinutes
      : session.phase === 'shortBreak'
        ? durations.shortBreakMinutes
        : durations.longBreakMinutes) * 60_000;
  const filled = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const phaseLabel = session.phase === 'work' ? 'Travail' : session.phase === 'shortBreak' ? 'Pause' : 'Pause longue';

  return (
    <div
      className="flex h-screen w-screen items-center gap-3 border border-ink-700 bg-ink-900/95 px-4 [-webkit-app-region:drag]"
      style={{ borderRadius: 16 }}
    >
      <ProgressRing size={40} radius={17} filled={Math.max(0, Math.min(1, filled))} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] text-champagne">{session.skillName}</p>
        <p className="font-data text-xs text-muted">
          {phaseLabel} · {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} · cycle{' '}
          {session.cycleIndex + 1}/{durations.cyclesBeforeLongBreak}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 [-webkit-app-region:no-drag]">
        {session.status === 'awaitingAdvance' ? (
          <button
            onClick={() => sendControl('advance')}
            aria-label="Continuer"
            className="border border-accent-bright px-2.5 py-1.5 font-data text-[11px] uppercase text-accent-bright hover:bg-accent-bright hover:text-ink-900"
          >
            Suite
          </button>
        ) : (
          <button
            onClick={() => sendControl(session.status === 'paused' ? 'resume' : 'pause')}
            aria-label={session.status === 'paused' ? 'Reprendre' : 'Mettre en pause'}
            className="border border-ink-700 px-2.5 py-1.5 font-data text-[11px] uppercase text-muted hover:text-champagne"
          >
            {session.status === 'paused' ? '▶' : '⏸'}
          </button>
        )}
        <button
          onClick={() => sendControl('stop')}
          aria-label="Arrêter le pomodoro"
          className="border border-ink-700 px-2.5 py-1.5 font-data text-[11px] uppercase text-muted hover:text-danger"
        >
          ■
        </button>
      </div>
    </div>
  );
}

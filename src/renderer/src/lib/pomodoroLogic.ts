// Machine à états pure du minuteur Pomodoro — aucune dépendance React/
// Supabase/Electron, pour rester testable en isolation (voir spec, section
// "Machine à états"). `usePomodoro` (hooks/PomodoroProvider) est la seule
// couche qui appelle Supabase et l'IPC ; ce module ne fait que calculer.

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'awaitingAdvance';

export interface PomodoroDurations {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface PomodoroSession {
  skillId: string;
  skillName: string; // dénormalisé pour l'overlay, qui n'a pas accès à useSkills
  phase: PomodoroPhase;
  status: PomodoroStatus;
  cycleIndex: number; // 0-based, remis à 0 après chaque pause longue
  phaseEndsAt: number; // epoch ms, recalculé à chaque (re)départ de phase
  remainingMsAtPause: number | null;
  loggedEntryIds: string[]; // practice_entry créées cette session, pour la consolidation
}

export function startSession(
  skillId: string,
  skillName: string,
  durations: PomodoroDurations,
  now: number = Date.now()
): PomodoroSession {
  return {
    skillId,
    skillName,
    phase: 'work',
    status: 'running',
    cycleIndex: 0,
    phaseEndsAt: now + durations.workMinutes * 60_000,
    remainingMsAtPause: null,
    loggedEntryIds: [],
  };
}

export function phaseDurationMinutes(phase: PomodoroPhase, durations: PomodoroDurations): number {
  if (phase === 'work') return durations.workMinutes;
  if (phase === 'shortBreak') return durations.shortBreakMinutes;
  return durations.longBreakMinutes;
}

/** Phase + cycleIndex après que la phase COURANTE se termine normalement. */
export function nextPhase(
  session: PomodoroSession,
  durations: PomodoroDurations
): { phase: PomodoroPhase; cycleIndex: number } {
  if (session.phase === 'work') {
    const isLastCycleOfRound = session.cycleIndex + 1 >= durations.cyclesBeforeLongBreak;
    return isLastCycleOfRound
      ? { phase: 'longBreak', cycleIndex: session.cycleIndex }
      : { phase: 'shortBreak', cycleIndex: session.cycleIndex };
  }
  // N'importe quelle pause -> retour au travail ; une pause longue remet le
  // compteur de cycle à 0 pour la nouvelle série, une pause courte l'incrémente.
  return { phase: 'work', cycleIndex: session.phase === 'longBreak' ? 0 : session.cycleIndex + 1 };
}

export interface PhaseCompletionResult {
  /** Minutes à checkpointer pour la phase qui vient de se terminer (0 pour une pause). */
  loggedMinutes: number;
  next: PomodoroSession;
}

/**
 * Applique la transition quand le décompte de la phase courante atteint 0.
 * `autoAdvance` vient de `settings.pomodoroAutoAdvance` : si faux, la
 * session passe en `awaitingAdvance` avec la phase suivante déjà posée
 * (pour l'affichage : "Pause courte — prêt à commencer"), mais sans
 * `phaseEndsAt` recalculé — `advancePhase` s'en charge au clic.
 */
export function completePhase(
  session: PomodoroSession,
  durations: PomodoroDurations,
  autoAdvance: boolean,
  now: number = Date.now()
): PhaseCompletionResult {
  const loggedMinutes = session.phase === 'work' ? phaseDurationMinutes('work', durations) : 0;
  const { phase, cycleIndex } = nextPhase(session, durations);
  if (autoAdvance) {
    return {
      loggedMinutes,
      next: {
        ...session,
        phase,
        cycleIndex,
        status: 'running',
        phaseEndsAt: now + phaseDurationMinutes(phase, durations) * 60_000,
        remainingMsAtPause: null,
      },
    };
  }
  return {
    loggedMinutes,
    next: { ...session, phase, cycleIndex, status: 'awaitingAdvance', remainingMsAtPause: null },
  };
}

/** Démarre la phase déjà posée par `completePhase` en mode manuel (bouton "Commencer"). */
export function advancePhase(
  session: PomodoroSession,
  durations: PomodoroDurations,
  now: number = Date.now()
): PomodoroSession {
  return {
    ...session,
    status: 'running',
    phaseEndsAt: now + phaseDurationMinutes(session.phase, durations) * 60_000,
  };
}

export function pauseSession(session: PomodoroSession, now: number = Date.now()): PomodoroSession {
  return { ...session, status: 'paused', remainingMsAtPause: Math.max(0, session.phaseEndsAt - now) };
}

export function resumeSession(session: PomodoroSession, now: number = Date.now()): PomodoroSession {
  const remaining = session.remainingMsAtPause ?? 0;
  return { ...session, status: 'running', phaseEndsAt: now + remaining, remainingMsAtPause: null };
}

/**
 * Minutes écoulées dans la phase COURANTE (non terminée), arrondies à la
 * minute la plus proche — utilisé au Stop pour créditer un cycle de travail
 * interrompu (voir spec, "Cycle interrompu").
 */
export function partialMinutesElapsed(
  session: PomodoroSession,
  durations: PomodoroDurations,
  now: number = Date.now()
): number {
  const totalMs = phaseDurationMinutes(session.phase, durations) * 60_000;
  const isPaused = session.status === 'paused' && session.remainingMsAtPause !== null;
  const remainingMs = isPaused ? session.remainingMsAtPause : Math.max(0, session.phaseEndsAt - now);
  // If phase has ended (no remaining time) and not paused, return 0
  if (remainingMs === 0 && !isPaused) {
    return 0;
  }
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  return Math.round(elapsedMs / 60_000);
}

/** Somme des minutes déjà checkpointées (+ l'éventuelle minute partielle) pour l'entrée consolidée. */
export function consolidateDuration(loggedMinutes: number[]): number {
  return loggedMinutes.reduce((sum, m) => sum + m, 0);
}

export function checkpointNoteLabel(cycleIndex: number, cyclesBeforeLongBreak: number): string {
  return `Pomodoro — cycle ${cycleIndex + 1}/${cyclesBeforeLongBreak}`;
}

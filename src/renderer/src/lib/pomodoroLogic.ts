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
  skillName: string; // dénormalisé pour l'overlay, qui n'a pas accès à useEngagements
  phase: PomodoroPhase;
  status: PomodoroStatus;
  cycleIndex: number; // 0-based, remis à 0 après chaque pause longue
  phaseEndsAt: number; // epoch ms, recalculé à chaque (re)départ de phase
  remainingMsAtPause: number | null;
  loggedEntryIds: string[]; // practice_entry créées cette session, pour la consolidation
  // Temps ajouté à la phase COURANTE par « +5 min » (voir `extendPhase`),
  // remis à 0 à chaque changement de phase. Porté par la session plutôt
  // qu'appliqué aux durées : ces dernières valent pour toute la session,
  // une prolongation ne vaut que pour la phase où on l'a demandée.
  extensionMs: number;
  // Phases de travail menées à leur terme depuis le Démarrer, tous
  // engagements confondus (un changement d'engagement ne le remet pas à 0).
  // Sert au récapitulatif de fin de session ; une phase coupée par l'arrêt
  // n'en fait pas partie.
  completedCycles: number;
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
    extensionMs: 0,
    completedCycles: 0,
  };
}

export function phaseDurationMinutes(phase: PomodoroPhase, durations: PomodoroDurations): number {
  if (phase === 'work') return durations.workMinutes;
  if (phase === 'shortBreak') return durations.shortBreakMinutes;
  return durations.longBreakMinutes;
}

/**
 * Durée totale de la phase COURANTE, prolongations comprises. Seule source
 * de cette durée pour le crédit de minutes (`completePhase`,
 * `partialMinutesElapsed`) comme pour le remplissage des anneaux : sans
 * elle, un « +5 min » ferait déborder l'anneau et ne serait jamais crédité.
 */
export function phaseTotalMs(session: PomodoroSession, durations: PomodoroDurations): number {
  return phaseDurationMinutes(session.phase, durations) * 60_000 + session.extensionMs;
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
  const loggedMinutes = session.phase === 'work' ? Math.round(phaseTotalMs(session, durations) / 60_000) : 0;
  const { phase, cycleIndex } = nextPhase(session, durations);
  const completedCycles = session.completedCycles + (session.phase === 'work' ? 1 : 0);
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
        extensionMs: 0,
        completedCycles,
      },
    };
  }
  return {
    loggedMinutes,
    next: {
      ...session,
      phase,
      cycleIndex,
      status: 'awaitingAdvance',
      remainingMsAtPause: null,
      extensionMs: 0,
      completedCycles,
    },
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
  const totalMs = phaseTotalMs(session, durations);
  const remainingMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - now);
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

export const EXTENSION_MINUTES = 5;

/**
 * « +5 min » : prolonge la phase en cours, qu'elle tourne ou soit en pause.
 * Sans effet en `awaitingAdvance` — la phase posée n'a pas encore commencé,
 * il n'y a rien à prolonger.
 */
export function extendPhase(session: PomodoroSession, minutes: number = EXTENSION_MINUTES): PomodoroSession {
  const ms = minutes * 60_000;
  if (session.status === 'running') {
    return { ...session, phaseEndsAt: session.phaseEndsAt + ms, extensionMs: session.extensionMs + ms };
  }
  if (session.status === 'paused') {
    return {
      ...session,
      remainingMsAtPause: (session.remainingMsAtPause ?? 0) + ms,
      extensionMs: session.extensionMs + ms,
    };
  }
  return session;
}

/**
 * « Passer la pause » : démarre tout de suite le cycle de travail suivant,
 * même si la pause est en cours, en pause ou pas encore commencée
 * (`awaitingAdvance`). Sans effet pendant une phase de travail. Rien n'est
 * crédité : une pause ne l'est jamais, passée ou non.
 */
export function skipBreak(
  session: PomodoroSession,
  durations: PomodoroDurations,
  now: number = Date.now()
): PomodoroSession {
  if (session.phase === 'work') return session;
  const { phase, cycleIndex } = nextPhase(session, durations);
  return {
    ...session,
    phase,
    cycleIndex,
    status: 'running',
    phaseEndsAt: now + phaseDurationMinutes(phase, durations) * 60_000,
    remainingMsAtPause: null,
    extensionMs: 0,
  };
}

/**
 * Session relue après une fermeture de l'app (plantage, redémarrage de mise
 * à jour, extinction). Une session qui tournait revient EN PAUSE, figée au
 * dernier instant où l'app était vivante (`lastSeenAt`) : le temps passé app
 * fermée n'est jamais crédité, puisque rien ne dit qu'il a été travaillé. Si
 * la phase s'est terminée avant la fermeture, elle revient en pause à 0:00 —
 * « Reprendre » la termine et crédite le cycle, « Arrêter » aussi.
 */
export function restoreSession(saved: PomodoroSession, lastSeenAt: number): PomodoroSession {
  if (saved.status !== 'running') return saved;
  return { ...saved, status: 'paused', remainingMsAtPause: Math.max(0, saved.phaseEndsAt - lastSeenAt) };
}

// Progression de la phase Pomodoro en cours, affichée sur l'icône de Saint
// Daily dans la barre des tâches Windows (BrowserWindow.setProgressBar) :
// on voit où en est le minuteur sans rouvrir l'app ni épingler l'overlay.
//
// Calculée ici, dans le process main, à partir du dernier état reçu : le
// renderer ne pousse son état qu'aux transitions (voir lib/pomodoro.tsx),
// jamais à chaque seconde, et il n'y a pas de raison de changer ça pour une
// barre de progression.
//
// Forme minimale de l'état, recopiée de PomodoroSession/PomodoroDurations
// (src/renderer/src/lib/pomodoroLogic.ts) pour la même raison que la copie
// du preload : tsconfig.node.json ne couvre pas src/renderer/src/**.

export interface EtatPomodoroMinimal {
  session: {
    phase: 'work' | 'shortBreak' | 'longBreak';
    status: 'idle' | 'running' | 'paused' | 'awaitingAdvance';
    phaseEndsAt: number;
    remainingMsAtPause: number | null;
    extensionMs: number;
  };
  durations: {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
  };
}

export interface EtatBarreDesTaches {
  // Entre 0 et 1 ; -1 retire la barre (convention d'Electron).
  ratio: number;
  // 'paused' est rendu en jaune par Windows : minuteur arrêté, en attente.
  mode: 'none' | 'normal' | 'paused';
}

export const BARRE_ABSENTE: EtatBarreDesTaches = { ratio: -1, mode: 'none' };

export function etatBarreDesTaches(etat: EtatPomodoroMinimal | null, now: number = Date.now()): EtatBarreDesTaches {
  if (!etat || etat.session.status === 'idle') return BARRE_ABSENTE;
  const { session, durations } = etat;
  // Phase terminée, la suivante attend un clic : barre pleine, en pause.
  if (session.status === 'awaitingAdvance') return { ratio: 1, mode: 'paused' };
  const minutes =
    session.phase === 'work'
      ? durations.workMinutes
      : session.phase === 'shortBreak'
        ? durations.shortBreakMinutes
        : durations.longBreakMinutes;
  // Même total que phaseTotalMs côté renderer, prolongations comprises.
  const totalMs = minutes * 60_000 + session.extensionMs;
  if (!(totalMs > 0)) return BARRE_ABSENTE;
  const restantMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - now);
  const ratio = Math.min(1, Math.max(0, 1 - restantMs / totalMs));
  return { ratio, mode: session.status === 'paused' ? 'paused' : 'normal' };
}

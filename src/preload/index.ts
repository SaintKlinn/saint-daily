import { contextBridge, ipcRenderer } from 'electron';

// Pont IPC : connexion dev auto (voir src/main/devLogin.ts), tray/auto-launch
// (voir src/main/tray.ts et src/main/autoLaunch.ts), et le minuteur Pomodoro
// (voir src/main/pomodoroOverlay.ts). Un seul preload pour les deux fenêtres
// (principale et overlay) — la fenêtre overlay n'appelle simplement jamais
// getDevLoginCredentials/setAutoLaunch.
//
// Copie locale, à resynchroniser à la main avec PomodoroSession/
// PomodoroDurations de src/renderer/src/lib/pomodoroLogic.ts si elles
// changent : ce fichier est compilé sous tsconfig.node.json, dont
// `include` ne couvre pas src/renderer/src/**, donc il ne peut rien
// importer de ces types-là (voir la note de typage du Task 4).
interface PomodoroStateSnapshot {
  session: {
    skillId: string;
    skillName: string;
    phase: 'work' | 'shortBreak' | 'longBreak';
    status: 'idle' | 'running' | 'paused' | 'awaitingAdvance';
    cycleIndex: number;
    phaseEndsAt: number;
    remainingMsAtPause: number | null;
    loggedEntryIds: string[];
  };
  durations: {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    cyclesBeforeLongBreak: number;
  };
}

type PomodoroControlAction = 'pause' | 'resume' | 'stop' | 'advance';

type AutoUpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

const api = {
  getDevLoginCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke('get-dev-login-credentials'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('get-auto-launch'),
  pomodoro: {
    // Fenêtre principale -> main -> overlay : diffuse un instantané à
    // chaque transition (jamais à chaque tick, voir Global Constraints).
    reportState: (state: PomodoroStateSnapshot | null): void => {
      ipcRenderer.send('pomodoro:state-changed', state);
    },
    // Overlay : écoute les instantanés relayés par main.
    onState: (callback: (state: PomodoroStateSnapshot | null) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: PomodoroStateSnapshot | null) => callback(state);
      ipcRenderer.on('pomodoro:state', listener);
      return () => ipcRenderer.removeListener('pomodoro:state', listener);
    },
    // Overlay -> main -> fenêtre principale : une action de contrôle.
    sendControl: (action: PomodoroControlAction): void => {
      ipcRenderer.send('pomodoro:control', action);
    },
    // Fenêtre principale : écoute les actions de contrôle relayées par main.
    onControl: (callback: (action: PomodoroControlAction) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, action: PomodoroControlAction) => callback(action);
      ipcRenderer.on('pomodoro:control', listener);
      return () => ipcRenderer.removeListener('pomodoro:control', listener);
    },
    // Fenêtre principale : montre/cache la fenêtre overlay.
    setPinned: (pinned: boolean): void => {
      ipcRenderer.send('pomodoro:set-pinned', pinned);
    },
  },
  autoUpdate: {
    onStatus: (callback: (status: AutoUpdateStatus) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: AutoUpdateStatus) => callback(status);
      ipcRenderer.on('auto-update:status', listener);
      return () => ipcRenderer.removeListener('auto-update:status', listener);
    },
    installNow: (): Promise<void> => ipcRenderer.invoke('auto-update:install-now'),
  },
};

contextBridge.exposeInMainWorld('api', api);

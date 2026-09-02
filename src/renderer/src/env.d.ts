/// <reference types="vite/client" />

import type { PomodoroDurations, PomodoroSession } from './lib/pomodoroLogic';

// env.d.ts est sous tsconfig.web.json, le même projet que lib/pomodoroLogic.ts
// (contrairement à src/preload/index.ts, sous tsconfig.node.json) — donc pas
// de duplication ici, juste un import direct.
export interface PomodoroStateSnapshot {
  session: PomodoroSession;
  durations: PomodoroDurations;
}

export type PomodoroControlAction = 'pause' | 'resume' | 'stop' | 'advance';

export interface SaintDailyApi {
  getDevLoginCredentials: () => Promise<{ email: string; password: string } | null>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
  pomodoro: {
    reportState: (state: PomodoroStateSnapshot | null) => void;
    onState: (callback: (state: PomodoroStateSnapshot | null) => void) => () => void;
    sendControl: (action: PomodoroControlAction) => void;
    onControl: (callback: (action: PomodoroControlAction) => void) => () => void;
    setPinned: (pinned: boolean) => void;
  };
}

declare global {
  interface Window {
    api: SaintDailyApi;
  }
}

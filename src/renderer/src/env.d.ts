/// <reference types="vite/client" />

export interface SaintDailyApi {
  getDevLoginCredentials: () => Promise<{ email: string; password: string } | null>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
}

declare global {
  interface Window {
    api: SaintDailyApi;
  }
}

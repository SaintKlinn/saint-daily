/// <reference types="vite/client" />

// La tâche 14 du plan étendra cette interface avec setAutoLaunch/getAutoLaunch —
// à fusionner avec ce qui existe, pas à remplacer.
export interface SaintDailyApi {
  getDevLoginCredentials: () => Promise<{ email: string; password: string } | null>;
}

declare global {
  interface Window {
    api: SaintDailyApi;
  }
}

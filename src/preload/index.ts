import { contextBridge, ipcRenderer } from 'electron';

// Pont IPC minimal : connexion dev auto (voir src/main/devLogin.ts). La
// tâche 14 du plan étendra cet objet avec setAutoLaunch/getAutoLaunch —
// à fusionner avec ce qui existe, pas à remplacer.
const api = {
  getDevLoginCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke('get-dev-login-credentials'),
};

contextBridge.exposeInMainWorld('api', api);

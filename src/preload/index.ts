import { contextBridge, ipcRenderer } from 'electron';

// Pont IPC : connexion dev auto (voir src/main/devLogin.ts) + tray/auto-launch
// (voir src/main/tray.ts et src/main/autoLaunch.ts).
const api = {
  getDevLoginCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke('get-dev-login-credentials'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('get-auto-launch'),
};

contextBridge.exposeInMainWorld('api', api);

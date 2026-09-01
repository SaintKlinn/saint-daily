import { app, ipcMain } from 'electron';

// Connexion automatique réservée au dev local : lit un compte de test
// dédié depuis DEV_LOGIN_EMAIL/DEV_LOGIN_PASSWORD (.env.local, jamais
// commité) — même intention que le /dev-login de Saint Gym, adaptée à
// Electron. electron-vite charge .env.local dans process.env pour les
// process main/preload (pas pour le renderer, qui ne voit que les
// variables VITE_*), donc les identifiants ne quittent jamais le
// process principal tant que le renderer ne les demande pas
// explicitement via cet handler IPC. Renvoie null hors dev (app
// packagée) ou si les variables manquent.
export function registerDevLoginHandler(): void {
  ipcMain.handle('get-dev-login-credentials', () => {
    if (app.isPackaged) return null;
    const email = process.env.DEV_LOGIN_EMAIL;
    const password = process.env.DEV_LOGIN_PASSWORD;
    if (!email || !password) return null;
    return { email, password };
  });
}

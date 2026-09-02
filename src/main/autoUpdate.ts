import { app, ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h
const INITIAL_DELAY_MS = 10_000;

export type AutoUpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

/**
 * Vérifie et télécharge les mises à jour en silence — jamais de
 * notification OS générique (contrairement à
 * autoUpdater.checkForUpdatesAndNotify()), jamais de redémarrage forcé.
 * Le renderer n'est prévenu qu'une fois le téléchargement terminé (voir
 * spec, section "Mise à jour automatique"). Inerte hors app packagée :
 * un build non empaqueté n'a pas de app-update.yml généré par
 * electron-builder, electron-updater n'a rien à lire (même garde que
 * src/main/devLogin.ts pour `app.isPackaged`).
 */
export function registerAutoUpdateHandlers(getMainWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  function sendStatus(status: AutoUpdateStatus): void {
    getMainWindow()?.webContents.send('auto-update:status', status);
  }

  autoUpdater.on('checking-for-update', () => sendStatus('checking'));
  autoUpdater.on('update-available', () => sendStatus('downloading'));
  autoUpdater.on('update-not-available', () => sendStatus('idle'));
  autoUpdater.on('update-downloaded', () => sendStatus('downloaded'));
  // Reste silencieux côté utilisateur (voir spec, "Gestion des erreurs") —
  // se corrigera de lui-même à la prochaine vérification périodique — mais
  // loggé côté main process pour du débogage éventuel.
  autoUpdater.on('error', (err) => {
    console.error('[auto-update]', err);
    sendStatus('error');
  });

  ipcMain.handle('auto-update:install-now', () => {
    autoUpdater.quitAndInstall();
  });

  function checkNow(): void {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-update]', err);
      sendStatus('error');
    });
  }

  setTimeout(() => {
    checkNow();
    setInterval(checkNow, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

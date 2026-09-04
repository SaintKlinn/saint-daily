import { app, ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h
const INITIAL_DELAY_MS = 10_000;

export type AutoUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface AutoUpdateState {
  status: AutoUpdateStatus;
  version?: string;
  percent?: number;
}

/**
 * Vérifie périodiquement les mises à jour, mais ne télécharge jamais sans
 * accord explicite (autoDownload: false) — le renderer déclenche le
 * téléchargement via auto-update:download-now une fois l'utilisateur
 * prévenu (voir UpdateBanner.tsx). Une fois téléchargée, le redémarrage
 * reste aussi une action explicite (auto-update:install-now), jamais
 * automatique. Inerte hors app packagée : un build non empaqueté n'a pas
 * de app-update.yml généré par electron-builder, electron-updater n'a
 * rien à lire (même garde que src/main/devLogin.ts pour `app.isPackaged`).
 */
export function registerAutoUpdateHandlers(getMainWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;

  const { autoUpdater } = electronUpdater;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  function sendState(state: AutoUpdateState): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('auto-update:status', state);
    }
  }

  autoUpdater.on('checking-for-update', () => sendState({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => sendState({ status: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendState({ status: 'idle' }));
  autoUpdater.on('download-progress', (progress) => sendState({ status: 'downloading', percent: progress.percent }));
  autoUpdater.on('update-downloaded', () => sendState({ status: 'downloaded' }));
  // Contrairement à une erreur de vérification en fond, une erreur de
  // téléchargement/installation suit toujours un clic explicite de
  // l'utilisateur — elle doit lui revenir (voir UpdateBanner.tsx, qui
  // repropose l'étape précédente), pas juste finir en log.
  autoUpdater.on('error', (err) => {
    console.error('[auto-update]', err);
    sendState({ status: 'error' });
  });

  ipcMain.handle('auto-update:download-now', () => {
    void autoUpdater.downloadUpdate().catch((err) => {
      console.error('[auto-update]', err);
      sendState({ status: 'error' });
    });
  });

  ipcMain.handle('auto-update:install-now', () => {
    // isSilent (pas d'assistant NSIS visible) + isForceRunAfter (relance
    // automatique) — voir node_modules/electron-updater/out/BaseUpdater.js.
    autoUpdater.quitAndInstall(true, true);
  });

  function checkNow(): void {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-update]', err);
      sendState({ status: 'error' });
    });
  }

  setTimeout(() => {
    checkNow();
    setInterval(checkNow, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

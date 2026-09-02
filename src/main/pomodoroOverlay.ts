import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';

const OVERLAY_WIDTH = 300;
const OVERLAY_HEIGHT = 84;

let overlayWindow: BrowserWindow | null = null;

// Même garde que isQuitting dans src/main/index.ts : sans elle, le close
// handler ci-dessous préviendrait indéfiniment sa propre fermeture, y
// compris pendant une vraie séquence app.quit() (déclenchée depuis le tray)
// — l'overlay ne se fermerait jamais, window-all-closed ne se déclencherait
// jamais, et l'app resterait un process zombie impossible à quitter.
let isQuitting = false;

function buildOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + workArea.width - OVERLAY_WIDTH - 24,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 'screen-saver' reste au-dessus des fenêtres plein écran d'autres apps,
  // pas seulement des fenêtres normales (niveau 'floating' par défaut).
  win.setAlwaysOnTop(true, 'screen-saver');

  // Se cacher plutôt que se détruire quand on la ferme (aucun bouton de
  // fermeture n'existe dans l'UI overlay elle-même, mais Alt+F4/fermeture
  // système doivent quand même la laisser réutilisable) — même raison que
  // win.hide() sur la fenêtre principale (src/main/index.ts).
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/pomodoro-overlay`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pomodoro-overlay' });
  }

  return win;
}

/**
 * Crée la fenêtre overlay (cachée par défaut) et branche le relais IPC
 * bidirectionnel entre elle et la fenêtre principale. À appeler une fois au
 * démarrage, après createWindow() — voir src/main/index.ts.
 */
export function createPomodoroOverlay(getMainWindow: () => BrowserWindow | null): void {
  app.on('before-quit', () => {
    isQuitting = true;
  });

  overlayWindow = buildOverlayWindow();

  // Fenêtre principale -> overlay : relaie chaque instantané d'état.
  ipcMain.on('pomodoro:state-changed', (_event, state) => {
    overlayWindow?.webContents.send('pomodoro:state', state);
  });

  // Overlay -> fenêtre principale : relaie chaque action de contrôle. La
  // fenêtre principale reste la seule à muter réellement l'état (voir spec).
  ipcMain.on('pomodoro:control', (_event, action) => {
    getMainWindow()?.webContents.send('pomodoro:control', action);
  });

  // Bouton "épingler" de la fenêtre principale : montre/cache l'overlay,
  // indépendamment de l'état réduit/visible de la fenêtre principale.
  ipcMain.on('pomodoro:set-pinned', (_event, pinned: boolean) => {
    if (pinned) overlayWindow?.show();
    else overlayWindow?.hide();
  });
}

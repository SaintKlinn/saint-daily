import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';

const WIDGET_WIDTH = 300;
const WIDGET_HEIGHT = 260;

let widgetWindow: BrowserWindow | null = null;

// Même garde que isQuitting dans src/main/index.ts et
// src/main/pomodoroOverlay.ts : sans elle, le close handler ci-dessous
// empêcherait indéfiniment sa propre fermeture, y compris pendant une vraie
// séquence app.quit() (déclenchée depuis le tray) — le widget ne se
// fermerait jamais, window-all-closed ne se déclencherait jamais, et l'app
// resterait un process zombie impossible à quitter.
let isQuitting = false;

function buildWidgetWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: workArea.x + workArea.width - WIDGET_WIDTH - 24,
    y: workArea.y + workArea.height - WIDGET_HEIGHT - 24,
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
  // pas seulement des fenêtres normales (niveau 'floating' par défaut) —
  // même raison que l'overlay Pomodoro.
  win.setAlwaysOnTop(true, 'screen-saver');

  // Se cacher plutôt que se détruire quand on la ferme (aucun bouton de
  // fermeture n'existe dans l'UI du widget elle-même, mais Alt+F4/fermeture
  // système doivent quand même la laisser réutilisable) — même raison que
  // win.hide() sur la fenêtre principale et sur l'overlay Pomodoro.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  // Ne se déclenche donc qu'à la vraie destruction (séquence de quitte),
  // jamais sur un close intercepté ci-dessus. Sans ça, `widgetWindow`
  // resterait une référence vers une fenêtre détruite après un quit.
  win.on('closed', () => {
    widgetWindow = null;
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/agenda-widget`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/agenda-widget' });
  }

  return win;
}

/**
 * Crée la fenêtre widget agenda (cachée par défaut) et branche le relais IPC
 * entre elle et la fenêtre principale. À appeler une fois au démarrage, à
 * côté de createPomodoroOverlay() — voir src/main/index.ts.
 */
export function createAgendaWidget(): void {
  app.on('before-quit', () => {
    isQuitting = true;
  });

  widgetWindow = buildWidgetWindow();

  // Fenêtre principale -> main -> widget : relaie chaque instantané d'agenda.
  ipcMain.on('agenda:state-changed', (_event, items) => {
    widgetWindow?.webContents.send('agenda:state', items);
  });
}

/**
 * Bascule la visibilité de la fenêtre widget et renvoie l'état résultant —
 * utilisé par l'entrée de menu du tray (voir src/main/tray.ts).
 */
export function toggleAgendaWidget(): boolean {
  // Même garde que applyOverlayVisibility() dans pomodoroOverlay.ts :
  // fenêtre détruite plutôt que simplement cachée (fermeture système/Alt+F4
  // pendant isQuitting, ou tout autre chemin qui laisserait `widgetWindow`
  // non réinitialisé) — appeler show()/hide() dessus lèverait alors.
  if (!widgetWindow || widgetWindow.isDestroyed()) return false;
  const next = !widgetWindow.isVisible();
  if (next) widgetWindow.show();
  else widgetWindow.hide();
  return next;
}

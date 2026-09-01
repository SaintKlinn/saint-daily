import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerDevLoginHandler } from './devLogin';
import { createTray } from './tray';
import { registerAutoLaunchHandlers } from './autoLaunch';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#064E3B',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Masquer plutôt que fermer : la fenêtre doit rester en mémoire pour
  // que les rappels de régularité (notifications) continuent de
  // fonctionner tant que l'app tourne dans le system tray.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  registerDevLoginHandler();
  createTray(() => mainWindow);
  registerAutoLaunchHandlers();

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
    else mainWindow = createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

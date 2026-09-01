import { app, BrowserWindow, Menu, Tray } from 'electron';
import { join } from 'node:path';

let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null): void {
  // En dev l'icône est lue depuis le dossier resources/ du projet ; dans
  // l'app packagée elle n'est PAS dans l'asar (electron-builder ne
  // packe que out/**) mais copiée à côté via `extraResources`, donc dans
  // process.resourcesPath. Sans ça, `new Tray(...)` lève dans l'app
  // installée : plus d'icône de tray, et l'app devient un process
  // fantôme impossible à rouvrir.
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Saint Daily');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Ouvrir Saint Daily',
        click: () => {
          const win = getWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() },
    ])
  );
  tray.on('click', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

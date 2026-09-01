import { app, BrowserWindow, Menu, Tray } from 'electron';
import { join } from 'node:path';

let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null): void {
  const iconPath = join(__dirname, '../../resources/icon.png');
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

import { app, BrowserWindow, Menu, Tray } from 'electron';
import { join } from 'node:path';
import { toggleAgendaWidget } from './agendaWidget';

let tray: Tray | null = null;

export function setTrayNextEngagement(label: string | null): void {
  // L'infobulle est la seule surface de l'app visible sans ouvrir la
  // fenêtre : elle garde toujours le nom du produit en première ligne,
  // pour rester identifiable parmi les autres icônes du tray.
  tray?.setToolTip(label ? `Saint Daily\n${label}` : 'Saint Daily');
}

// Skills pratiqués récemment, envoyés par le renderer (voir
// useActionsRapidesTray) : de quoi logger une séance ou lancer un pomodoro
// depuis l'icône, sans ouvrir la fenêtre ni chercher le skill.
export interface SkillRapide {
  id: string;
  name: string;
}

let skillsRapides: SkillRapide[] = [];
let agendaAffiche = false;
let fenetre: () => BrowserWindow | null = () => null;

export function setTrayQuickSkills(skills: SkillRapide[]): void {
  // Le renderer renvoie la même liste toutes les minutes : ne reconstruire
  // le menu que si elle change, pour ne pas fermer un menu ouvert.
  if (JSON.stringify(skills) === JSON.stringify(skillsRapides)) return;
  skillsRapides = skills;
  construireMenu();
}

function montrer(): BrowserWindow | null {
  const win = fenetre();
  if (!win) return null;
  win.show();
  win.focus();
  return win;
}

function naviguer(chemin: string): void {
  montrer()?.webContents.send('navigate:request', chemin);
}

function demarrerPomodoro(skill: SkillRapide): void {
  const win = fenetre();
  if (!win) return;
  // Fenêtre cachée dans le tray : on le reste, et c'est l'overlay qui
  // montre le minuteur (le renderer l'épingle) — sauf si rien n'a pu
  // démarrer, faute de réglages chargés : le renderer montre alors la
  // fenêtre sur l'écran Pomodoro. Fenêtre visible : on y affiche l'écran
  // Pomodoro.
  const fenetreVisible = win.isVisible() && !win.isMinimized();
  if (fenetreVisible) win.focus();
  win.webContents.send('tray:pomodoro-start', { skillId: skill.id, skillName: skill.name, fenetreVisible });
}

function construireMenu(): void {
  if (!tray) return;
  const sousMenu = (action: (skill: SkillRapide) => void) =>
    skillsRapides.map((skill) => ({ label: skill.name.replace(/&/g, '&&'), click: () => action(skill) }));
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'Ouvrir Saint Daily', click: () => montrer() },
    { label: 'Nouvelle entrée', click: () => naviguer('/entree/nouvelle') },
  ];
  if (skillsRapides.length > 0) {
    template.push(
      { label: 'Logger une séance', submenu: sousMenu((skill) => naviguer(`/entree/nouvelle?skillId=${skill.id}`)) },
      { label: 'Démarrer un pomodoro', submenu: sousMenu(demarrerPomodoro) }
    );
  }
  template.push(
    { type: 'separator' },
    {
      label: "Afficher l'agenda du jour",
      type: 'checkbox',
      checked: agendaAffiche,
      click: (item) => {
        agendaAffiche = toggleAgendaWidget();
        item.checked = agendaAffiche;
      },
    },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() }
  );
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

export function createTray(getWindow: () => BrowserWindow | null): void {
  fenetre = getWindow;
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
  setTrayNextEngagement(null);
  construireMenu();
  tray.on('click', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

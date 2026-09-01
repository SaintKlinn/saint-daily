import { app, ipcMain } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Connexion automatique réservée au dev local : lit un compte de test
// dédié depuis .env.local (jamais commité) — même intention que le
// /dev-login de Saint Gym, adaptée à Electron. electron-vite N'INJECTE
// PAS .env.local dans process.env pour le process principal (contrairement
// à une hypothèse initiale) : Electron est lancé avec l'environnement
// hérité tel quel, et Vite ne fait qu'une substitution statique de
// `import.meta.env.*`. Ce fichier est donc lu et parsé directement depuis
// le disque, uniquement hors app packagée. Les identifiants ne quittent
// jamais le process principal tant que le renderer ne les demande pas
// explicitement via cet handler IPC.
function readDevCredentials(): { email: string; password: string } | null {
  if (app.isPackaged) return null;
  try {
    const envPath = join(app.getAppPath(), '.env.local');
    const contents = readFileSync(envPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      vars[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
    }
    const email = vars.DEV_LOGIN_EMAIL;
    const password = vars.DEV_LOGIN_PASSWORD;
    if (!email || !password) return null;
    return { email, password };
  } catch {
    // Pas de .env.local, illisible, ou variables absentes : pas de
    // connexion dev, le bouton ne s'affiche simplement pas.
    return null;
  }
}

export function registerDevLoginHandler(): void {
  ipcMain.handle('get-dev-login-credentials', () => readDevCredentials());
}

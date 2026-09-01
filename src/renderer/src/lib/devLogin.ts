// Identifiants du compte dev : d'abord via le pont IPC Electron (app réelle),
// sinon via l'endpoint Vite `/__dev-login-credentials` (voir
// electron.vite.config.ts) — utile quand le renderer tourne sans Electron,
// ex. un onglet de navigateur pointé directement sur le serveur Vite. Même
// intention que le GET /dev-login de Saint Gym : ni le code appelant ni
// quiconque déclenche ce flux ne manipule le mot de passe, il reste dans
// .env.local et transite uniquement entre process applicatifs.
export async function getDevLoginCredentials(): Promise<{ email: string; password: string } | null> {
  const viaElectron = await window.api?.getDevLoginCredentials?.().catch(() => null);
  if (viaElectron) return viaElectron;

  if (!import.meta.env.DEV) return null;
  try {
    const res = await fetch('/__dev-login-credentials');
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
}

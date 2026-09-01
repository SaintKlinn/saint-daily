import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Miroir du pont IPC de src/main/devLogin.ts, pour les cas où le renderer
// tourne SANS Electron (ex. un onglet de navigateur pointé directement sur
// ce serveur Vite, sans window.api) — même intention que le GET /dev-login
// de Saint Gym : une requête suffit, personne ne saisit le mot de passe.
// `apply: 'serve'` exclut ce endpoint de `vite build` / de l'app packagée.
function devLoginCredentialsPlugin(): Plugin {
  return {
    name: 'dev-login-credentials',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev-login-credentials', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const contents = readFileSync(resolve(__dirname, '.env.local'), 'utf-8');
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
          res.end(email && password ? JSON.stringify({ email, password }) : 'null');
        } catch {
          res.end('null');
        }
      });
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } },
  },
  // Le preload est forcé en CommonJS (`index.cjs`) : package.json déclare
  // `"type": "module"`, donc electron-vite produirait sinon un `index.mjs`
  // que le `preload:` d'une BrowserWindow ne sait pas charger (les scripts
  // de preload sandboxés d'Electron sont CJS). Sans ça, `window.api` est
  // toujours undefined dans l'app réelle.
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    plugins: [react(), devLoginCredentialsPlugin()],
  },
});

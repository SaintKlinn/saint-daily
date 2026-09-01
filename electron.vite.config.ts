import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
  },
});

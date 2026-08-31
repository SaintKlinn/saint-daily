# Saint Daily — Opérationnel (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Saint Daily from an empty repo to an operational Electron desktop app: scaffold, theme/logo, shared Supabase auth and schema, pure progress-tracking logic, all data hooks, and all 6 spec screens, packaged as a Windows installer.

**Architecture:** Electron (main/preload/renderer, via `electron-vite`) with a React + TypeScript + Tailwind renderer. The renderer talks to Supabase directly (`@supabase/supabase-js`), reusing Saint Gym's existing Supabase project, `auth.users`, and `profile` table — no new auth system. Four new tables (`skill`, `skill_milestone`, `practice_entry`, `skill_app_settings`) live in that same project, RLS-scoped to their owner. The main process owns OS integration only (window, system tray, native login-item auto-launch) — no business logic there.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, Tailwind CSS, React Router (`HashRouter`), `@supabase/supabase-js`, Vitest, electron-builder, sharp + png-to-ico (icon generation).

**Spec:** [docs/superpowers/specs/2026-08-31-saint-daily-skill-tracker-design.md](../specs/2026-08-31-saint-daily-skill-tracker-design.md)

## Global Constraints

- **Windows only for v1** — no macOS/Linux packaging or testing.
- **No offline mode** — a failed write shows a clear error and keeps the user's input in the form; no local queue, no retry-on-reconnect.
- **100% personal** — no social layer. Every table is RLS-scoped to `auth.uid() = user_id` (directly, or via a join to `skill.user_id` for `skill_milestone`).
- **No public web presence** — no robots.txt, sitemap.xml, canonical URLs, social share, or cookie consent. Legal/FAQ content lives as static in-app sections (Réglages screen).
- **Emerald Ink `#064E3B`** and **Champagne `#F8E7C9`** are fixed brand anchors — never change these two hex values.
- **Accent gold** `#E7B94E` / `#C08A2A` / `#8A5F1B` and **IBM Plex Serif/Sans/Mono** are validated (from the design canvas mockups) — use them as given.
- **Logo**: the exact 17-ray `LOGO_RAYS` / `LOGO_VIEWBOX` coordinates supplied by the user, never an approximation.
- **Same Supabase project/account as Saint Gym** — reuse `profile` and `auth.users` as they exist today. No new signup/registration screen; only login.
- **French UI** — all user-facing copy in French, matching Saint Gym's convention. No i18n framework (single-user personal app, YAGNI).
- **Tests**: automated unit tests only for pure logic (streaks, tag filtering) per the spec's testing strategy — no large e2e suite. Everything else is verified manually via `npm run dev`.
- **Lazy-loading of secondary screens** (a line item in the spec's launch checklist) is deliberately **not** implemented here: Electron loads its bundle from local disk, not over a network, so route-level code-splitting has negligible real benefit for an app this size. `React.lazy`/`Suspense` can be added later with no architecture change if the bundle grows enough to matter.

---

## Task 1: Project scaffold (Electron + Vite + React + TypeScript + Tailwind)

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/index.css`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `npm run dev` boots an Electron window; `App` default export at `src/renderer/src/App.tsx` (replaced fully by Task 5); Tailwind utility classes available renderer-wide.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "saint-daily",
  "productName": "Saint Daily",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "icons": "node scripts/generate-icons.mjs",
    "dist:win": "electron-vite build && electron-builder --win"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "electron-vite": "^2.3.0",
    "png-to-ico": "^2.1.8",
    "postcss": "^8.4.0",
    "sharp": "^0.33.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write the TypeScript configs**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json` (main + preload — Node context):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": ["src/main/**/*", "src/preload/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json` (renderer — DOM/React context):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/src/*"] }
  },
  "include": ["src/renderer/src/**/*"]
}
```

- [ ] **Step 3: Write `electron.vite.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    plugins: [react()],
  },
});
```

- [ ] **Step 4: Write Tailwind + PostCSS config (minimal — Task 2 adds the brand tokens)**

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

`postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Write the main process entry point**

`src/main/index.ts`:

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

const isDev = !app.isPackaged;

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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

(Task 14 replaces this with tray + auto-launch + hide-on-close behavior.)

- [ ] **Step 6: Write the (currently empty) preload script**

`src/preload/index.ts`:

```ts
// Étendu à la tâche 14 avec le pont IPC (auto-launch). Vide pour l'instant :
// aucune fonctionnalité renderer -> main n'est encore nécessaire.
export {};
```

- [ ] **Step 7: Write the renderer entry point**

`src/renderer/index.html`:

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co;"
    />
    <title>Saint Daily</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/renderer/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/renderer/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/renderer/src/App.tsx` (placeholder — fully replaced by Task 5):

```tsx
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <p className="text-2xl font-semibold">Saint Daily</p>
    </div>
  );
}
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes with no errors.

- [ ] **Step 9: Verify the app boots**

Run: `npm run dev`
Expected: an Electron window opens showing "Saint Daily" centered on a dark background (proves Electron + Vite + React + Tailwind are wired together correctly). Close the window/stop the process afterward.

- [ ] **Step 10: Commit**

```bash
git add package.json electron.vite.config.ts tsconfig.json tsconfig.node.json tsconfig.web.json tailwind.config.ts postcss.config.js src/
git commit -m "Scaffold Electron + Vite + React + TypeScript + Tailwind project"
```

---

## Task 2: Theme tokens & logo mark

**Files:**
- Create: `src/renderer/src/theme/colors.ts`
- Create: `src/renderer/src/theme/logoRays.ts`
- Create: `src/renderer/src/theme/logoRays.test.ts`
- Create: `src/renderer/src/components/LogoMark.tsx`
- Modify: `tailwind.config.ts`
- Modify: `src/renderer/index.html` (Google Fonts)
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `App.tsx` placeholder (Task 1).
- Produces: `colors` object (`src/renderer/src/theme/colors.ts`) with shape `{ ink: {950,900,800,700}, champagne, muted, accent: {bright,hover,mid,deep}, danger }`; `LOGO_RAYS`/`LOGO_VIEWBOX` (`theme/logoRays.ts`); `LogoMark` React component (`components/LogoMark.tsx`, props `{size?, width?, height?, className?}`); Tailwind color tokens `ink`/`champagne`/`muted`/`accent`/`danger` and font families `font-serif`/`font-sans`/`font-data`.

- [ ] **Step 1: Write the failing test for the logo data**

`src/renderer/src/theme/logoRays.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOGO_RAYS, LOGO_VIEWBOX } from './logoRays';

describe('LOGO_RAYS', () => {
  it('has the 17 rays of the Saint mark', () => {
    expect(LOGO_RAYS).toHaveLength(17);
  });

  it("is symmetric around the viewBox's horizontal midpoint", () => {
    const midX = LOGO_VIEWBOX.width / 2;
    const left = LOGO_RAYS.slice(0, 8);
    const right = LOGO_RAYS.slice(9).reverse();
    left.forEach((ray, i) => {
      const mirrored = right[i];
      expect(ray.x1 + mirrored.x1).toBeCloseTo(midX * 2, 1);
      expect(ray.x2 + mirrored.x2).toBeCloseTo(midX * 2, 1);
      expect(ray.y1).toBeCloseTo(mirrored.y1, 5);
      expect(ray.y2).toBeCloseTo(mirrored.y2, 5);
      expect(ray.o).toBeCloseTo(mirrored.o, 5);
    });
  });
});

describe('LOGO_VIEWBOX', () => {
  it('matches the Saint mark drawing dimensions', () => {
    expect(LOGO_VIEWBOX).toEqual({ minX: 0, minY: 0, width: 128, height: 85 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/renderer/src/theme/logoRays.test.ts`
Expected: FAIL — `Cannot find module './logoRays'`.

- [ ] **Step 3: Write `logoRays.ts` — the exact coordinates supplied by the user**

```ts
// Coordonnées du mark Saint Daily. Reprend exactement la technique de
// Saint Gym : une seule moitié + le rayon central, reflétée exactement
// (x -> 128 - x), pas alternée par parité d'index. Ne jamais approximer
// ces valeurs (voir Global Constraints du plan et la spec, section
// "Thème graphique").
export const LOGO_RAYS = [
  { x1: 46.0, y1: 83.7, x2: 38.1, y2: 83.2, o: 0.6 },
  { x1: 35.0, y1: 77.4, x2: 18.6, y2: 73.0, o: 0.68 },
  { x1: 47.8, y1: 77.3, x2: 24.6, y2: 66.2, o: 0.75 },
  { x1: 39.8, y1: 67.3, x2: 12.7, y2: 47.4, o: 0.82 },
  { x1: 51.7, y1: 71.8, x2: 24.1, y2: 42.2, o: 0.88 },
  { x1: 48.0, y1: 59.6, x2: 23.3, y2: 20.5, o: 0.93 },
  { x1: 57.4, y1: 68.3, x2: 38.9, y2: 21.3, o: 0.97 },
  { x1: 58.4, y1: 55.5, x2: 48.5, y2: 3.3, o: 0.99 },
  { x1: 64.0, y1: 67.0, x2: 64.0, y2: 13.0, o: 1.0 },
  { x1: 69.6, y1: 55.5, x2: 79.5, y2: 3.3, o: 0.99 },
  { x1: 70.6, y1: 68.3, x2: 89.1, y2: 21.3, o: 0.97 },
  { x1: 80.0, y1: 59.6, x2: 104.7, y2: 20.5, o: 0.93 },
  { x1: 76.3, y1: 71.8, x2: 103.9, y2: 42.2, o: 0.88 },
  { x1: 88.2, y1: 67.3, x2: 115.3, y2: 47.4, o: 0.82 },
  { x1: 80.2, y1: 77.3, x2: 103.4, y2: 66.2, o: 0.75 },
  { x1: 93.0, y1: 77.4, x2: 109.4, y2: 73.0, o: 0.68 },
  { x1: 82.0, y1: 83.7, x2: 89.9, y2: 83.2, o: 0.6 },
] as const;

export const LOGO_VIEWBOX = { minX: 0, minY: 0, width: 128, height: 85 };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/renderer/src/theme/logoRays.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the color tokens**

`src/renderer/src/theme/colors.ts`:

```ts
// Source unique des tokens de couleur — consommée par tailwind.config.ts
// ET par LogoMark.tsx, pour que le rendu in-app et les icônes générées
// (tâche 13) ne divergent jamais. Emerald Ink (#064E3B) et Champagne
// (#F8E7C9) sont des ancrages de marque fixes ; les nuances ink/muted et
// l'accent doré viennent du canvas de maquettes validé avec l'utilisateur.
export const colors = {
  ink: {
    950: '#03231A',
    900: '#064E3B', // Emerald Ink — ancrage, ne change pas
    800: '#0B5F49',
    700: '#146856',
  },
  champagne: '#F8E7C9', // ancrage, ne change pas
  muted: '#8FA396',
  accent: {
    bright: '#E7B94E',
    hover: '#F3CE73',
    mid: '#C08A2A',
    deep: '#8A5F1B',
  },
  danger: '#F87171',
} as const;
```

- [ ] **Step 6: Write the logo component**

`src/renderer/src/components/LogoMark.tsx`:

```tsx
import { LOGO_RAYS, LOGO_VIEWBOX } from '../theme/logoRays';
import { colors } from '../theme/colors';

export default function LogoMark({
  size = 30,
  width,
  height,
  className,
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  const vb = `${LOGO_VIEWBOX.minX} ${LOGO_VIEWBOX.minY} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
  return (
    <svg width={width ?? size} height={height ?? size} viewBox={vb} className={className} aria-hidden="true">
      <g stroke={colors.accent.bright} strokeWidth="2.4" strokeLinecap="butt">
        {LOGO_RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeOpacity={r.o} />
        ))}
      </g>
    </svg>
  );
}
```

- [ ] **Step 7: Wire the tokens into Tailwind and add IBM Plex fonts**

`tailwind.config.ts` (full replacement):

```ts
import type { Config } from 'tailwindcss';
import { colors } from './src/renderer/src/theme/colors';

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        champagne: colors.champagne,
        muted: colors.muted,
        accent: colors.accent,
        danger: colors.danger,
      },
      fontFamily: {
        serif: ['"IBM Plex Serif"', 'ui-serif', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

`src/renderer/index.html` (full replacement — adds the font `<link>`s):

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co;"
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400&display=swap"
      rel="stylesheet"
    />
    <title>Saint Daily</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Show the branded logo as a smoke check**

`src/renderer/src/App.tsx` (full replacement):

```tsx
import LogoMark from './components/LogoMark';

export default function App() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-900 text-champagne">
      <LogoMark size={64} />
      <p className="font-serif text-2xl">Saint Daily</p>
    </div>
  );
}
```

Run: `npm run dev`
Expected: window shows the 17-ray gold mark on an Emerald Ink background, with "Saint Daily" in IBM Plex Serif below it.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/theme src/renderer/src/components/LogoMark.tsx src/renderer/src/App.tsx tailwind.config.ts src/renderer/index.html
git commit -m "Add Emerald Ink/Champagne theme tokens and the Saint Daily logo mark"
```

---

## Task 3: Pure progress-tracking logic (streaks, tag filter)

**Files:**
- Create: `src/renderer/src/lib/streaks.ts`
- Create: `src/renderer/src/lib/streaks.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `calculateStreak(entries: {practicedAt: string}[], now?: Date): number`, `daysSinceLastPractice(entries: {practicedAt: string}[], now?: Date): number | null`, `filterByTag<T extends {tags: string[]}>(items: T[], tag: string | null | undefined): T[]` — consumed by Tasks 10, 11, 12.

- [ ] **Step 1: Write the failing tests**

`src/renderer/src/lib/streaks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateStreak, daysSinceLastPractice, filterByTag } from './streaks';

describe('calculateStreak', () => {
  it('returns 0 with no entries', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    const entries = [
      { practicedAt: '2026-08-31T09:00:00Z' },
      { practicedAt: '2026-08-30T09:00:00Z' },
      { practicedAt: '2026-08-29T09:00:00Z' },
    ];
    expect(calculateStreak(entries, now)).toBe(3);
  });

  it('still counts an active streak when today has no entry yet', () => {
    const now = new Date('2026-08-31T07:00:00Z');
    const entries = [{ practicedAt: '2026-08-30T09:00:00Z' }, { practicedAt: '2026-08-29T09:00:00Z' }];
    expect(calculateStreak(entries, now)).toBe(2);
  });

  it('resets to 0 when the chain is broken', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    expect(calculateStreak([{ practicedAt: '2026-08-28T09:00:00Z' }], now)).toBe(0);
  });
});

describe('daysSinceLastPractice', () => {
  it('returns null with no entries', () => {
    expect(daysSinceLastPractice([])).toBeNull();
  });

  it('returns 0 for a practice logged today', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    expect(daysSinceLastPractice([{ practicedAt: '2026-08-31T09:00:00Z' }], now)).toBe(0);
  });

  it('returns the number of full days since the most recent entry', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    const entries = [{ practicedAt: '2026-08-25T09:00:00Z' }, { practicedAt: '2026-08-27T09:00:00Z' }];
    expect(daysSinceLastPractice(entries, now)).toBe(4);
  });
});

describe('filterByTag', () => {
  const skills = [
    { name: 'Piano', tags: ['Musique', 'Créatif'] },
    { name: 'React', tags: ['Code', 'Technique'] },
  ];

  it('returns all skills when no tag is given', () => {
    expect(filterByTag(skills, null)).toEqual(skills);
  });

  it('filters case-insensitively on an exact tag match', () => {
    expect(filterByTag(skills, 'musique')).toEqual([skills[0]]);
  });

  it('returns an empty list when no skill has the tag', () => {
    expect(filterByTag(skills, 'Sport')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: FAIL — `Cannot find module './streaks'`.

- [ ] **Step 3: Write the implementation**

`src/renderer/src/lib/streaks.ts`:

```ts
export interface PracticeEntryLike {
  practicedAt: string; // ISO 8601
}

/**
 * Jours consécutifs (jusqu'à aujourd'hui) avec au moins une entrée de
 * pratique. Une absence aujourd'hui ne casse pas un streak déjà en cours
 * (on n'a peut-être pas encore pratiqué) ; une absence hier le remet à 0.
 * Tout est calculé en UTC pour rester déterministe quel que soit le fuseau
 * de la machine qui exécute le code.
 */
export function calculateStreak(entries: PracticeEntryLike[], now: Date = new Date()): number {
  if (entries.length === 0) return 0;

  const practicedDays = new Set(entries.map((e) => toDayKey(new Date(e.practicedAt))));

  let streak = 0;
  const cursor = startOfUtcDay(now);

  if (!practicedDays.has(toDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (practicedDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

/** Nombre de jours pleins écoulés depuis la dernière pratique. null si aucune entrée. */
export function daysSinceLastPractice(entries: PracticeEntryLike[], now: Date = new Date()): number | null {
  if (entries.length === 0) return null;

  const lastPracticedAt = entries.reduce(
    (latest, e) => (e.practicedAt > latest ? e.practicedAt : latest),
    entries[0].practicedAt
  );

  const last = startOfUtcDay(new Date(lastPracticedAt));
  const today = startOfUtcDay(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((today.getTime() - last.getTime()) / msPerDay);
}

/** Filtre par tag, correspondance exacte insensible à la casse. Pas de tag = liste inchangée. */
export function filterByTag<T extends { tags: string[] }>(
  items: T[],
  tag: string | null | undefined
): T[] {
  if (!tag) return items;
  const needle = tag.toLowerCase();
  return items.filter((s) => s.tags.some((t) => t.toLowerCase() === needle));
}

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/streaks.ts src/renderer/src/lib/streaks.test.ts
git commit -m "Add streak, days-since-practice, and tag-filter pure logic with tests"
```

---

## Task 4: Supabase schema migration (4 new tables + RLS)

**Files:**
- Create: `supabase/migrations/0001_saint_daily_tables.sql`

**Interfaces:**
- Consumes: the existing `profile` table in the shared Supabase project (see `../../../gym-tracker/gym/supabase/schema.sql` for reference — not modified).
- Produces: tables `skill`, `skill_milestone`, `practice_entry`, `skill_app_settings`, each RLS-scoped to their owner — consumed by Tasks 6, 7, 8.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_saint_daily_tables.sql`:

```sql
-- Nouvelles tables Saint Daily dans le projet Supabase partagé avec Saint
-- Gym. `profile` existe déjà (voir gym-tracker/gym/supabase/schema.sql) et
-- n'est pas recréée ici — un seul compte pour tout l'écosystème.

create table skill (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profile(user_id) on delete cascade,
  name text not null,
  notes text,
  tags text[] not null default '{}',
  generic_level text not null default 'debutant' -- auto-déclaré par l'utilisateur, pas calculé
    check (generic_level in ('debutant', 'intermediaire', 'avance', 'expert')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table skill_milestone (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  label text not null,
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table practice_entry (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  user_id uuid not null references profile(user_id) on delete cascade,
  duration_minutes int not null check (duration_minutes > 0),
  note text,
  practiced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table skill_app_settings (
  user_id uuid primary key references profile(user_id) on delete cascade,
  reminder_threshold_days int not null default 5 check (reminder_threshold_days > 0),
  notifications_enabled boolean not null default true,
  auto_launch_enabled boolean not null default true
);

-- Row Level Security : chaque table filtrée sur son propriétaire, aucun
-- partage (Saint Daily v1 est 100% personnel, cf. spec).

alter table skill enable row level security;
create policy "skill_owner_all" on skill
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table skill_milestone enable row level security;
create policy "skill_milestone_owner_all" on skill_milestone
  for all
  using (exists (
    select 1 from skill where skill.id = skill_milestone.skill_id and skill.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from skill where skill.id = skill_milestone.skill_id and skill.user_id = auth.uid()
  ));

alter table practice_entry enable row level security;
create policy "practice_entry_owner_all" on practice_entry
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table skill_app_settings enable row level security;
create policy "skill_app_settings_owner_all" on skill_app_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index skill_user_id_idx on skill (user_id);
create index skill_milestone_skill_id_idx on skill_milestone (skill_id);
create index practice_entry_skill_id_idx on practice_entry (skill_id);
create index practice_entry_user_id_idx on practice_entry (user_id);
```

- [ ] **Step 2: Apply the migration**

Open the Supabase SQL editor for the **same project used by Saint Gym**, paste the file's contents, and run it once.
Expected: no errors; 4 new tables appear in the Table Editor.

- [ ] **Step 3: Verify tables and RLS**

Run this query in the SQL editor:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('skill', 'skill_milestone', 'practice_entry', 'skill_app_settings');
```

Expected: 4 rows, `relrowsecurity = true` for all.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_saint_daily_tables.sql
git commit -m "Add Supabase migration for skill, milestone, practice entry, and settings tables"
```

---

## Task 5: App shell — Supabase client, auth, routing, Introuvable

**Files:**
- Create: `src/renderer/src/lib/supabase.ts`
- Create: `src/renderer/src/lib/auth.tsx`
- Create: `src/renderer/src/screens/Login.tsx`
- Create: `src/renderer/src/screens/Introuvable.tsx`
- Create: `src/renderer/src/components/AppShell.tsx`
- Create: `.env.local.example`
- Modify: `package.json` (add `.env.local` note — no dependency change, already installed in Task 1)
- Modify: `src/renderer/src/App.tsx`
- Modify: `.gitignore` if it doesn't already ignore `.env.local` (it does — this project's root `.gitignore` already lists it; skip if so)

**Interfaces:**
- Consumes: `colors`, `LogoMark` (Task 2).
- Produces: `getSupabaseClient(): SupabaseClient` (`lib/supabase.ts`); `AuthProvider`, `useAuth(): {session, loading, signIn, signOut}` (`lib/auth.tsx`); `AppShell` layout component (nav + `<Outlet/>`); routing skeleton in `App.tsx` with `/login` and a catch-all `Introuvable` — consumed by every later screen task, which each add one `<Route>`.

- [ ] **Step 1: Add the env var example**

`.env.local.example`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy it to `.env.local` and fill in the **same values used by Saint Gym** (Project Settings → API in the Supabase dashboard).

- [ ] **Step 2: Write the Supabase client**

`src/renderer/src/lib/supabase.ts`:

```ts
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// Instance mémorisée à dessein : plusieurs createClient() créeraient
// plusieurs instances GoTrueClient dont les événements onAuthStateChange
// ne seraient pas forcément synchronisés entre elles (même piège
// documenté dans Saint Gym, lib/supabase/client.ts).
let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis (.env.local)');
    }
    client = createSupabaseClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
```

- [ ] **Step 3: Write the auth context**

`src/renderer/src/lib/auth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await getSupabaseClient().auth.signOut();
  }

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
```

Note: Saint Daily has **no signup screen** — it reuses the single existing Saint account (created via Saint Gym). Login only.

- [ ] **Step 4: Write the Login screen**

`src/renderer/src/screens/Login.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import LogoMark from '../components/LogoMark';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-ink-900">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4 border border-ink-700 bg-ink-800 p-8">
        <div className="flex items-center gap-3">
          <LogoMark size={32} />
          <h1 className="font-serif text-xl text-champagne">Saint Daily</h1>
        </div>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-ink-700 bg-ink-700 px-3 py-2 text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-ink-700 bg-ink-700 px-3 py-2 text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write the Introuvable (404-equivalent) screen**

`src/renderer/src/screens/Introuvable.tsx`:

```tsx
import { Link } from 'react-router-dom';
import LogoMark from '../components/LogoMark';

export default function Introuvable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-champagne">
      <LogoMark size={48} />
      <p className="font-serif text-xl">Introuvable</p>
      <p className="text-sm text-muted">Ce skill ou cette page n'existe plus.</p>
      <Link to="/" className="text-accent-bright underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Write the app shell (nav layout)**

`src/renderer/src/components/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import LogoMark from './LogoMark';

const navItems = [
  { to: '/', label: 'Accueil' },
  { to: '/skills', label: 'Skills' },
  { to: '/reglages', label: 'Réglages' },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-ink-900 text-champagne">
      <nav className="flex w-56 flex-col gap-1 border-r border-ink-700 p-4">
        <div className="mb-6 flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-serif text-lg">Saint Daily</span>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-sm ${isActive ? 'bg-ink-700 text-accent-bright' : 'text-muted hover:text-champagne'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Wire routing in `App.tsx`**

`src/renderer/src/App.tsx` (full replacement):

```tsx
import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import Login from './screens/Login';
import Introuvable from './screens/Introuvable';

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-900 text-champagne">Chargement…</div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route path="*" element={<Introuvable />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </HashRouter>
  );
}
```

(`HashRouter`, not `BrowserRouter`: Electron loads the renderer from a `file://` URL in production, where a history-API router breaks deep links.)

- [ ] **Step 8: Verify the login flow manually**

Run: `npm run dev`
Expected: the window shows the Login form (not the app shell, since there's no session yet). Enter the **existing Saint account's** email/password (same one used for Saint Gym) and submit. Expected: the form's loading state shows briefly, then the app shell appears (nav with Accueil/Skills/Réglages) showing the Introuvable screen (no other routes exist yet). Reload the window (Ctrl+R) — expected: still logged in (session persisted).

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/lib/supabase.ts src/renderer/src/lib/auth.tsx src/renderer/src/screens/Login.tsx src/renderer/src/screens/Introuvable.tsx src/renderer/src/components/AppShell.tsx src/renderer/src/App.tsx .env.local.example
git commit -m "Add Supabase auth, routing skeleton, app shell, and Introuvable screen"
```

---

## Task 6: `useSkills` data hook

**Files:**
- Create: `src/renderer/src/lib/types.ts`
- Create: `src/renderer/src/hooks/useSkills.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` (Task 5), `useAuth` (Task 5), `skill` table (Task 4).
- Produces: `GenericLevel`, `Skill` types (`lib/types.ts`); `useSkills(): {skills: Skill[], loading, error, refresh, createSkill(input), updateSkill(id, patch), setArchived(id, archived)}` — consumed by Tasks 9–12.

- [ ] **Step 1: Write the shared domain types**

`src/renderer/src/lib/types.ts`:

```ts
export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';

export interface Skill {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  createdAt: string;
}

export interface SkillMilestone {
  id: string;
  skillId: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface PracticeEntry {
  id: string;
  skillId: string;
  userId: string;
  durationMinutes: number;
  note: string | null;
  practicedAt: string;
  createdAt: string;
}

export interface SkillAppSettings {
  userId: string;
  reminderThresholdDays: number;
  notificationsEnabled: boolean;
  autoLaunchEnabled: boolean;
}
```

- [ ] **Step 2: Write the hook**

`src/renderer/src/hooks/useSkills.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { GenericLevel, Skill } from '../lib/types';

interface SkillRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tags: string[];
  generic_level: GenericLevel;
  archived_at: string | null;
  created_at: string;
}

function fromRow(row: SkillRow): Skill {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    genericLevel: row.generic_level,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function useSkills() {
  const { session } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('skill')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSkills((data as SkillRow[]).map(fromRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createSkill(input: {
    name: string;
    tags: string[];
    genericLevel: GenericLevel;
    notes?: string | null;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('skill').insert({
      user_id: session.user.id,
      name: input.name,
      tags: input.tags,
      generic_level: input.genericLevel,
      notes: input.notes ?? null,
    });
    if (insertError) return { error: insertError.message };
    await refresh();
    return { error: null };
  }

  async function updateSkill(id: string, patch: Partial<Pick<Skill, 'name' | 'notes' | 'tags' | 'genericLevel'>>) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
      })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  async function setArchived(id: string, archived: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { skills, loading, error, refresh, createSkill, updateSkill, setArchived };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Functional verification happens in Task 9/11/12, the first screens to actually call this hook — there is no UI yet to exercise it against, per the spec's manual-testing strategy.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/lib/types.ts src/renderer/src/hooks/useSkills.ts
git commit -m "Add shared domain types and the useSkills data hook"
```

---

## Task 7: `useMilestones` and `usePracticeEntries` data hooks

**Files:**
- Create: `src/renderer/src/hooks/useMilestones.ts`
- Create: `src/renderer/src/hooks/usePracticeEntries.ts`

**Interfaces:**
- Consumes: `getSupabaseClient`, `useAuth` (Task 5); `SkillMilestone`, `PracticeEntry` types (Task 6); `skill_milestone`, `practice_entry` tables (Task 4).
- Produces: `useMilestones(skillId: string | null): {milestones, loading, error, refresh, addMilestone(label), toggleMilestone(id, completed)}`; `usePracticeEntries(skillId: string | null): {entries, loading, error, refresh, logEntry(input)}`; `useAllPracticeEntries(skillIds: string[]): {entriesBySkill: Record<string, PracticeEntry[]>, loading}` — consumed by Tasks 9, 10, 12.

- [ ] **Step 1: Write `useMilestones`**

`src/renderer/src/hooks/useMilestones.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { SkillMilestone } from '../lib/types';

interface MilestoneRow {
  id: string;
  skill_id: string;
  label: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

function fromRow(row: MilestoneRow): SkillMilestone {
  return {
    id: row.id,
    skillId: row.skill_id,
    label: row.label,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function useMilestones(skillId: string | null) {
  const [milestones, setMilestones] = useState<SkillMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!skillId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('skill_milestone')
      .select('*')
      .eq('skill_id', skillId)
      .order('position', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setMilestones((data as MilestoneRow[]).map(fromRow));
    }
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addMilestone(label: string) {
    if (!skillId) return { error: 'Aucun skill sélectionné' };
    const { error: insertError } = await getSupabaseClient()
      .from('skill_milestone')
      .insert({ skill_id: skillId, label, position: milestones.length });
    if (insertError) return { error: insertError.message };
    await refresh();
    return { error: null };
  }

  async function toggleMilestone(id: string, completed: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill_milestone')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { milestones, loading, error, refresh, addMilestone, toggleMilestone };
}
```

- [ ] **Step 2: Write `usePracticeEntries` (including the multi-skill variant used by Accueil)**

`src/renderer/src/hooks/usePracticeEntries.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { PracticeEntry } from '../lib/types';

interface PracticeEntryRow {
  id: string;
  skill_id: string;
  user_id: string;
  duration_minutes: number;
  note: string | null;
  practiced_at: string;
  created_at: string;
}

function fromRow(row: PracticeEntryRow): PracticeEntry {
  return {
    id: row.id,
    skillId: row.skill_id,
    userId: row.user_id,
    durationMinutes: row.duration_minutes,
    note: row.note,
    practicedAt: row.practiced_at,
    createdAt: row.created_at,
  };
}

export function usePracticeEntries(skillId: string | null) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!skillId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('practice_entry')
      .select('*')
      .eq('skill_id', skillId)
      .order('practiced_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEntries((data as PracticeEntryRow[]).map(fromRow));
    }
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logEntry(input: {
    skillId: string;
    durationMinutes: number;
    note?: string | null;
    practicedAt?: string;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      skill_id: input.skillId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
    });
    if (insertError) return { error: insertError.message };
    if (input.skillId === skillId) await refresh();
    return { error: null };
  }

  return { entries, loading, error, refresh, logEntry };
}

/**
 * Toutes les entrées de plusieurs skills en une seule requête — utilisé par
 * l'Accueil pour calculer streak/régularité de chaque skill actif sans une
 * requête par skill.
 */
export function useAllPracticeEntries(skillIds: string[]) {
  const [entriesBySkill, setEntriesBySkill] = useState<Record<string, PracticeEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const key = skillIds.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (skillIds.length === 0) {
        setEntriesBySkill({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await getSupabaseClient().from('practice_entry').select('*').in('skill_id', skillIds);
      if (cancelled) return;
      const bySkill: Record<string, PracticeEntry[]> = {};
      for (const row of (data ?? []) as PracticeEntryRow[]) {
        const entry = fromRow(row);
        (bySkill[entry.skillId] ??= []).push(entry);
      }
      setEntriesBySkill(bySkill);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // key (la liste d'ids jointe) est la vraie dépendance : évite un
    // effet qui re-fetch à chaque re-render sur une nouvelle identité de
    // tableau sans changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { entriesBySkill, loading };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/hooks/useMilestones.ts src/renderer/src/hooks/usePracticeEntries.ts
git commit -m "Add useMilestones and usePracticeEntries data hooks"
```

---

## Task 8: `useSettings` data hook

**Files:**
- Create: `src/renderer/src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: `getSupabaseClient`, `useAuth` (Task 5); `SkillAppSettings` type (Task 6); `skill_app_settings` table (Task 4).
- Produces: `useSettings(): {settings: SkillAppSettings | null, loading, error, refresh, updateSettings(patch)}` — consumed by Tasks 12, 15.

- [ ] **Step 1: Write the hook**

`src/renderer/src/hooks/useSettings.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { SkillAppSettings } from '../lib/types';

interface SettingsRow {
  user_id: string;
  reminder_threshold_days: number;
  notifications_enabled: boolean;
  auto_launch_enabled: boolean;
}

function fromRow(row: SettingsRow): SkillAppSettings {
  return {
    userId: row.user_id,
    reminderThresholdDays: row.reminder_threshold_days,
    notificationsEnabled: row.notifications_enabled,
    autoLaunchEnabled: row.auto_launch_enabled,
  };
}

function toRow(patch: Partial<Omit<SkillAppSettings, 'userId'>>) {
  return {
    ...(patch.reminderThresholdDays !== undefined ? { reminder_threshold_days: patch.reminderThresholdDays } : {}),
    ...(patch.notificationsEnabled !== undefined ? { notifications_enabled: patch.notificationsEnabled } : {}),
    ...(patch.autoLaunchEnabled !== undefined ? { auto_launch_enabled: patch.autoLaunchEnabled } : {}),
  };
}

const DEFAULT_SETTINGS: Omit<SkillAppSettings, 'userId'> = {
  reminderThresholdDays: 5,
  notificationsEnabled: true,
  autoLaunchEnabled: true,
};

export function useSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<SkillAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from('skill_app_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    if (data) {
      setSettings(fromRow(data as SettingsRow));
      setLoading(false);
      return;
    }
    // Première visite : crée la ligne de réglages avec les valeurs par défaut.
    const { data: created, error: insertError } = await supabase
      .from('skill_app_settings')
      .insert({ user_id: session.user.id, ...toRow(DEFAULT_SETTINGS) })
      .select('*')
      .single();
    if (insertError) {
      setError(insertError.message);
    } else {
      setSettings(fromRow(created as SettingsRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function updateSettings(patch: Partial<Omit<SkillAppSettings, 'userId'>>) {
    if (!session) return { error: 'Non connecté' };
    const { error: updateError } = await getSupabaseClient()
      .from('skill_app_settings')
      .update(toRow(patch))
      .eq('user_id', session.user.id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { settings, loading, error, refresh, updateSettings };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useSettings.ts
git commit -m "Add useSettings data hook"
```

---

## Task 9: Screen — Nouvelle entrée

**Files:**
- Create: `src/renderer/src/screens/NouvelleEntree.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useSkills` (Task 6), `usePracticeEntries` (Task 7).
- Produces: `NouvelleEntree` screen; adds route `entree/nouvelle` (accepts an optional `?skillId=` query param to preselect a skill).

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/NouvelleEntree.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { usePracticeEntries } from '../hooks/usePracticeEntries';

export default function NouvelleEntree() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');

  const { skills } = useSkills();
  const { logEntry } = usePracticeEntries(null);

  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  const [duration, setDuration] = useState('30');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const durationMinutes = Number(duration);
    if (!skillId) {
      setError('Choisis un skill.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('La durée doit être un nombre de minutes positif.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: logError } = await logEntry({ skillId, durationMinutes, note: note || null });
    setSubmitting(false);
    if (logError) {
      // La saisie reste dans le formulaire — pas de perte, retry manuel.
      setError(logError);
      return;
    }
    navigate(`/skills/${skillId}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-serif text-2xl text-champagne">Nouvelle entrée</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Skill
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          >
            <option value="">Choisir…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Durée (minutes)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 font-data text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

`src/renderer/src/App.tsx` (only the `Router` function changes — add the import and the route):

```tsx
import NouvelleEntree from './screens/NouvelleEntree';
```

```tsx
        <Route path="*" element={<Introuvable />} />
```

becomes:

```tsx
        <Route path="entree/nouvelle" element={<NouvelleEntree />} />
        <Route path="*" element={<Introuvable />} />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, log in, then navigate the window to `#/entree/nouvelle` (edit the URL bar if devtools are open, or temporarily change `AppShell`'s Accueil link — reverted once Task 12 adds a real link). Since no skill exists yet, the picker is empty; this is expected until Task 11 adds skill creation. Verify the form renders with Skill/Durée/Note fields and a disabled-while-submitting "Enregistrer" button.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/NouvelleEntree.tsx src/renderer/src/App.tsx
git commit -m "Add Nouvelle entrée screen and route"
```

---

## Task 10: Screen — Détail skill

**Files:**
- Create: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useSkills`, `useMilestones`, `usePracticeEntries` (Tasks 6, 7); `calculateStreak`, `daysSinceLastPractice` (Task 3).
- Produces: `DetailSkill` screen; adds route `skills/:id`.

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/DetailSkill.tsx`:

```tsx
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useMilestones } from '../hooks/useMilestones';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import type { GenericLevel } from '../lib/types';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export default function DetailSkill() {
  const { id } = useParams<{ id: string }>();
  const { skills, updateSkill, setArchived } = useSkills();
  const { milestones, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const { entries } = usePracticeEntries(id ?? null);

  const skill = skills.find((s) => s.id === id);

  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const daysSince = useMemo(() => daysSinceLastPractice(entries), [entries]);
  const chartPoints = useMemo(() => buildCumulativeHoursPath(entries), [entries]);

  if (!skill) {
    return <p className="text-muted">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl text-champagne">{skill.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <span key={tag} className="border border-ink-700 px-2 py-0.5 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => setArchived(skill.id, !skill.archivedAt)}
          className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne"
        >
          {skill.archivedAt ? 'Désarchiver' : 'Archiver'}
        </button>
      </div>

      <div className="flex gap-8 text-sm text-muted">
        <span>
          Streak : <span className="text-accent-bright">{streak} j</span>
        </span>
        <span>
          Dernière pratique :{' '}
          <span className="text-champagne">
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </span>
        </span>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm text-muted">
        Niveau
        <select
          value={skill.genericLevel}
          onChange={(e) => updateSkill(skill.id, { genericLevel: e.target.value as GenericLevel })}
          className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
        >
          {(Object.keys(LEVEL_LABELS) as GenericLevel[]).map((level) => (
            <option key={level} value={level}>
              {LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </label>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Progression (heures cumulées)</h2>
        <svg viewBox="0 0 400 120" className="w-full max-w-xl border border-ink-700 bg-ink-800">
          <polyline points={chartPoints} fill="none" stroke="#E7B94E" strokeWidth="2" />
        </svg>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Jalons</h2>
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!m.completedAt} onChange={(e) => toggleMilestone(m.id, e.target.checked)} />
              <span className={m.completedAt ? 'text-muted line-through' : 'text-champagne'}>{m.label}</span>
            </li>
          ))}
        </ul>
        <NewMilestoneForm onAdd={addMilestone} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-lg text-champagne">Journal de pratique</h2>
          <Link to={`/entree/nouvelle?skillId=${skill.id}`} className="text-sm text-accent-bright underline">
            + Nouvelle entrée
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border border-ink-700 p-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>{new Date(entry.practicedAt).toLocaleDateString('fr-FR')}</span>
                <span className="font-data">{entry.durationMinutes} min</span>
              </div>
              {entry.note && <p className="mt-1 text-champagne">{entry.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        if (input.value.trim()) {
          onAdd(input.value.trim());
          input.value = '';
        }
      }}
      className="mt-3 flex gap-2"
    >
      <input
        name="label"
        placeholder="Nouveau jalon"
        className="flex-1 border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
      />
      <button type="submit" className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne">
        Ajouter
      </button>
    </form>
  );
}

function buildCumulativeHoursPath(entries: { practicedAt: string; durationMinutes: number }[]): string {
  if (entries.length === 0) return '';
  const sorted = [...entries].sort((a, b) => new Date(a.practicedAt).getTime() - new Date(b.practicedAt).getTime());
  const totalMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
  const maxHours = Math.max(totalMinutes / 60, 1);

  let cumulativeMinutes = 0;
  return sorted
    .map((entry, i) => {
      cumulativeMinutes += entry.durationMinutes;
      const x = sorted.length === 1 ? 400 : (i / (sorted.length - 1)) * 400;
      const y = 120 - (cumulativeMinutes / 60 / maxHours) * 110 - 5;
      return `${x},${y}`;
    })
    .join(' ');
}
```

- [ ] **Step 2: Add the route**

`src/renderer/src/App.tsx` — add the import and route:

```tsx
import DetailSkill from './screens/DetailSkill';
```

```tsx
        <Route path="skills/:id" element={<DetailSkill />} />
        <Route path="entree/nouvelle" element={<NouvelleEntree />} />
        <Route path="*" element={<Introuvable />} />
```

- [ ] **Step 3: Verify manually**

There's no skill to view yet (Task 11 adds skill creation) — defer full verification to after Task 11, then revisit: navigate to `/skills/<a real id>` and confirm milestones, journal, chart, level selector, and archive button all render and respond to interaction.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/DetailSkill.tsx src/renderer/src/App.tsx
git commit -m "Add Détail skill screen and route"
```

---

## Task 11: Screens — Liste des skills + Nouveau skill

**Files:**
- Create: `src/renderer/src/screens/ListeSkills.tsx`
- Create: `src/renderer/src/screens/NouveauSkill.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useSkills` (Task 6), `filterByTag` (Task 3).
- Produces: `ListeSkills`, `NouveauSkill` screens; adds routes `skills` and `skills/nouveau`.

- [ ] **Step 1: Write the skill-creation screen**

`src/renderer/src/screens/NouveauSkill.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import type { GenericLevel } from '../lib/types';

export default function NouveauSkill() {
  const navigate = useNavigate();
  const { createSkill } = useSkills();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [genericLevel, setGenericLevel] = useState<GenericLevel>('debutant');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const { error: createError } = await createSkill({ name: name.trim(), tags, genericLevel, notes: notes || null });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/skills');
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-serif text-2xl text-champagne">Nouveau skill</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Nom
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tags (séparés par des virgules)
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Musique, Créatif"
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Niveau de départ
          <select
            value={genericLevel}
            onChange={(e) => setGenericLevel(e.target.value as GenericLevel)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Création…' : 'Créer'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the list screen**

`src/renderer/src/screens/ListeSkills.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { filterByTag } from '../lib/streaks';

export default function ListeSkills() {
  const { skills } = useSkills();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const allTags = useMemo(() => Array.from(new Set(skills.flatMap((s) => s.tags))).sort(), [skills]);

  const visible = useMemo(() => {
    let list = skills.filter((s) => (showArchived ? true : !s.archivedAt));
    list = filterByTag(list, tag);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(needle) || (s.notes ?? '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [skills, tag, search, showArchived]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-champagne">Skills</h1>
        <Link to="/skills/nouveau" className="bg-accent-bright px-4 py-2 text-sm font-semibold text-ink-900">
          + Nouveau skill
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
        />
        <select
          value={tag ?? ''}
          onChange={(e) => setTag(e.target.value || null)}
          className="border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
        >
          <option value="">Tous les tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Voir les skills en pause
        </label>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((skill) => (
          <li key={skill.id}>
            <Link
              to={`/skills/${skill.id}`}
              className="flex items-center justify-between border border-ink-700 bg-ink-800 px-4 py-3 hover:border-accent-bright"
            >
              <span className="text-champagne">{skill.name}</span>
              <span className="flex gap-2">
                {skill.tags.map((t) => (
                  <span key={t} className="text-xs text-muted">
                    {t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted">Aucun skill ne correspond.</p>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Add the routes**

`src/renderer/src/App.tsx` — add imports and routes:

```tsx
import ListeSkills from './screens/ListeSkills';
import NouveauSkill from './screens/NouveauSkill';
```

```tsx
        <Route path="skills" element={<ListeSkills />} />
        <Route path="skills/nouveau" element={<NouveauSkill />} />
        <Route path="skills/:id" element={<DetailSkill />} />
        <Route path="entree/nouvelle" element={<NouvelleEntree />} />
        <Route path="*" element={<Introuvable />} />
```

- [ ] **Step 4: Verify manually — the full skill → entry → detail loop**

Run: `npm run dev`, log in, click the "Skills" nav item → "+ Nouveau skill", create one (e.g. name "Piano", tags "Musique, Créatif"). Expected: redirected to `/skills` showing the new skill. Click it → Détail skill renders with an empty journal/chart/milestones. Click "+ Nouvelle entrée", log a practice entry (e.g. 30 minutes, a note). Expected: redirected back to the skill's detail page, now showing that entry in the journal, the chart updated, and streak = 1 j. Add a milestone via the inline form; check its checkbox — expected: label gets a strikethrough. Toggle "Voir les skills en pause" and the Archiver button — expected: the skill disappears/reappears from the list accordingly. Filter by the "Musique" tag and by searching "Piano" — expected: the skill still shows; searching for an unrelated term hides it.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/ListeSkills.tsx src/renderer/src/screens/NouveauSkill.tsx src/renderer/src/App.tsx
git commit -m "Add Liste des skills and Nouveau skill screens and routes"
```

---

## Task 12: Screen — Accueil (dashboard)

**Files:**
- Create: `src/renderer/src/screens/Accueil.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useSkills` (Task 6), `useAllPracticeEntries` (Task 7), `useSettings` (Task 8), `calculateStreak`/`daysSinceLastPractice` (Task 3).
- Produces: `Accueil` screen; adds the index route (`/`).

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/Accueil.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';

export default function Accueil() {
  const { skills } = useSkills();
  const { settings } = useSettings();
  const activeSkills = useMemo(() => skills.filter((s) => !s.archivedAt), [skills]);
  const { entriesBySkill } = useAllPracticeEntries(activeSkills.map((s) => s.id));

  const stats = useMemo(
    () =>
      activeSkills.map((skill) => {
        const entries = entriesBySkill[skill.id] ?? [];
        return {
          skill,
          streak: calculateStreak(entries),
          daysSince: daysSinceLastPractice(entries),
        };
      }),
    [activeSkills, entriesBySkill]
  );

  // Une notification par skill par session (pas de rappel qui revient
  // toutes les 5 minutes tant qu'on n'a pas relancé l'app).
  const notifiedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!settings?.notificationsEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') Notification.requestPermission();

    for (const { skill, daysSince } of stats) {
      if (daysSince !== null && daysSince >= settings.reminderThresholdDays && !notifiedRef.current.has(skill.id)) {
        notifiedRef.current.add(skill.id);
        if (Notification.permission === 'granted') {
          new Notification('Saint Daily', { body: `${skill.name} : pas pratiqué depuis ${daysSince} jours.` });
        }
      }
    }
  }, [stats, settings]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-champagne">Accueil</h1>
        <Link to="/entree/nouvelle" className="bg-accent-bright px-4 py-2 text-sm font-semibold text-ink-900">
          + Nouvelle entrée
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-4">
        {stats.map(({ skill, streak, daysSince }) => {
          const due = settings ? daysSince !== null && daysSince >= settings.reminderThresholdDays : false;
          return (
            <li key={skill.id}>
              <Link
                to={`/skills/${skill.id}`}
                className={`block border p-4 ${due ? 'border-accent-bright' : 'border-ink-700'} bg-ink-800`}
              >
                <p className="font-serif text-lg text-champagne">{skill.name}</p>
                <p className="mt-1 text-sm text-muted">Streak : {streak} j</p>
                {due && <p className="mt-1 text-sm text-accent-bright">Pas pratiqué depuis {daysSince} j</p>}
              </Link>
            </li>
          );
        })}
      </ul>

      {activeSkills.length === 0 && (
        <p className="text-sm text-muted">
          Aucun skill actif pour l'instant.{' '}
          <Link to="/skills/nouveau" className="text-accent-bright underline">
            Crée ton premier skill
          </Link>
          .
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the index route**

`src/renderer/src/App.tsx` — add the import and the `index` route:

```tsx
import Accueil from './screens/Accueil';
```

```tsx
        <Route index element={<Accueil />} />
        <Route path="skills" element={<ListeSkills />} />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, log in. Expected: the app now lands on Accueil (not Introuvable) showing a card per active skill with its streak. In Réglages (once Task 15 exists) or directly via SQL, set a skill's `reminder_threshold_days` low and its latest `practice_entry.practiced_at` far enough in the past — expected: the card gets a gold border and "Pas pratiqué depuis N j", and (if the OS grants notification permission) a native Windows notification appears once.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Accueil.tsx src/renderer/src/App.tsx
git commit -m "Add Accueil dashboard screen with streaks and due reminders"
```

---

## Task 13: App icon generation + Windows packaging config

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `electron-builder.yml`

**Interfaces:**
- Consumes: nothing new (duplicates the `LOGO_RAYS` data as plain JS — see the in-file comment on why).
- Produces: `resources/icon.png`, `resources/icon.ico` (generated, not committed); `npm run icons` script; electron-builder config consumed by Task 14 (tray icon) and this task's own packaging check.

- [ ] **Step 1: Write the icon-generation script**

`scripts/generate-icons.mjs`:

```js
// Génère les icônes de l'app (fenêtre/taskbar/installeur Windows) à partir
// du même dessin que le logo in-app (LogoMark.tsx). Les coordonnées sont
// DUPLIQUÉES ici depuis src/renderer/src/theme/logoRays.ts : un script de
// build Node ne peut pas importer ce module .ts sans outillage
// supplémentaire. logoRays.test.ts garde le fichier source correct (17
// rayons, symétrie) mais NE VÉRIFIE PAS que cette copie reste synchronisée
// — si logoRays.ts change un jour, reporter le changement ici à la main.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'resources');

const LOGO_RAYS = [
  { x1: 46.0, y1: 83.7, x2: 38.1, y2: 83.2, o: 0.6 },
  { x1: 35.0, y1: 77.4, x2: 18.6, y2: 73.0, o: 0.68 },
  { x1: 47.8, y1: 77.3, x2: 24.6, y2: 66.2, o: 0.75 },
  { x1: 39.8, y1: 67.3, x2: 12.7, y2: 47.4, o: 0.82 },
  { x1: 51.7, y1: 71.8, x2: 24.1, y2: 42.2, o: 0.88 },
  { x1: 48.0, y1: 59.6, x2: 23.3, y2: 20.5, o: 0.93 },
  { x1: 57.4, y1: 68.3, x2: 38.9, y2: 21.3, o: 0.97 },
  { x1: 58.4, y1: 55.5, x2: 48.5, y2: 3.3, o: 0.99 },
  { x1: 64.0, y1: 67.0, x2: 64.0, y2: 13.0, o: 1.0 },
  { x1: 69.6, y1: 55.5, x2: 79.5, y2: 3.3, o: 0.99 },
  { x1: 70.6, y1: 68.3, x2: 89.1, y2: 21.3, o: 0.97 },
  { x1: 80.0, y1: 59.6, x2: 104.7, y2: 20.5, o: 0.93 },
  { x1: 76.3, y1: 71.8, x2: 103.9, y2: 42.2, o: 0.88 },
  { x1: 88.2, y1: 67.3, x2: 115.3, y2: 47.4, o: 0.82 },
  { x1: 80.2, y1: 77.3, x2: 103.4, y2: 66.2, o: 0.75 },
  { x1: 93.0, y1: 77.4, x2: 109.4, y2: 73.0, o: 0.68 },
  { x1: 82.0, y1: 83.7, x2: 89.9, y2: 83.2, o: 0.6 },
];

const INK = '#064E3B';
const ACCENT = '#E7B94E';

function buildSvg(size) {
  const lines = LOGO_RAYS.map(
    (r) => `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke-opacity="${r.o}" />`
  ).join('');
  // viewBox carré 128x128 (LOGO_VIEWBOX fait 128x85) : le dessin est
  // centré verticalement par translation, (128-85)/2 = 21.5 — même
  // principe de centrage que celui décrit par l'utilisateur pour les
  // icônes Satori de Saint Gym, en SVG natif ici.
  return `<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="${INK}" />
    <g transform="translate(0, 21.5)" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round">${lines}</g>
  </svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const pngSizes = [16, 32, 48, 64, 128, 256, 512];
  const pngBuffers = await Promise.all(
    pngSizes.map((size) => sharp(Buffer.from(buildSvg(size))).resize(size, size).png().toBuffer())
  );
  await writeFile(join(outDir, 'icon.png'), pngBuffers[pngBuffers.length - 1]);

  const icoSizes = [16, 32, 48, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map((size) => sharp(Buffer.from(buildSvg(size))).resize(size, size).png().toBuffer())
  );
  const ico = await pngToIco(icoBuffers);
  await writeFile(join(outDir, 'icon.ico'), ico);

  console.log(`Icônes générées dans ${outDir} (icon.png, icon.ico)`);
}

main();
```

- [ ] **Step 2: Write the electron-builder config**

`electron-builder.yml`:

```yaml
appId: com.saintdaily.app
productName: Saint Daily
directories:
  output: release
  buildResources: resources
files:
  - out/**/*
win:
  target: nsis
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 3: Generate the icons and verify**

Run: `npm run icons`
Expected: prints "Icônes générées dans …/resources (icon.png, icon.ico)"; `resources/icon.png` and `resources/icon.ico` exist and are non-empty (open `icon.png` in an image viewer — expected: the gold 17-ray mark centered on an Emerald Ink square).

- [ ] **Step 4: Ignore generated resources, commit the scripts/config**

Add to `.gitignore`:

```
resources/icon.png
resources/icon.ico
```

```bash
git add scripts/generate-icons.mjs electron-builder.yml .gitignore
git commit -m "Add icon generation script and electron-builder Windows config"
```

---

## Task 14: Main process — system tray + auto-launch

**Files:**
- Create: `src/main/tray.ts`
- Create: `src/main/autoLaunch.ts`
- Create: `src/renderer/src/env.d.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

**Interfaces:**
- Consumes: `resources/icon.png` (Task 13).
- Produces: `createTray(getWindow)`, `registerAutoLaunchHandlers()` (main process); `window.api.setAutoLaunch(enabled): Promise<boolean>`, `window.api.getAutoLaunch(): Promise<boolean>` (renderer-visible, via preload) — consumed by Task 15.

- [ ] **Step 1: Write the tray module**

`src/main/tray.ts`:

```ts
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
```

- [ ] **Step 2: Write the auto-launch IPC handlers**

`src/main/autoLaunch.ts`:

```ts
import { app, ipcMain } from 'electron';

export function registerAutoLaunchHandlers(): void {
  ipcMain.handle('set-auto-launch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('get-auto-launch', () => {
    return app.getLoginItemSettings().openAtLogin;
  });
}
```

- [ ] **Step 3: Expose the IPC bridge from preload**

`src/preload/index.ts` (full replacement):

```ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  setAutoLaunch: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('get-auto-launch'),
};

contextBridge.exposeInMainWorld('api', api);
```

`src/renderer/src/env.d.ts` (new — types `window.api` for the renderer; duplicated shape rather than cross-importing from `src/preload`, since main/preload and renderer are separate TypeScript projects here):

```ts
/// <reference types="vite/client" />

export interface SaintDailyApi {
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
}

declare global {
  interface Window {
    api: SaintDailyApi;
  }
}
```

- [ ] **Step 4: Wire tray + auto-launch into the main process, hide instead of quitting on close**

`src/main/index.ts` (full replacement):

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
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
```

- [ ] **Step 5: Verify manually**

Run: `npm run icons` (if not already done in Task 13), then `npm run dev`.
Expected: a Saint Daily icon appears in the Windows system tray. Closing the window (the × button) hides it instead of quitting — the tray icon remains; clicking "Ouvrir Saint Daily" from the tray menu (or clicking the tray icon) brings the window back. "Quitter" from the tray menu actually exits the process.

- [ ] **Step 6: Commit**

```bash
git add src/main/tray.ts src/main/autoLaunch.ts src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "Add system tray, hide-on-close, and auto-launch IPC bridge"
```

---

## Task 15: Screen — Réglages, and final packaging check

**Files:**
- Create: `src/renderer/src/screens/Reglages.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useSettings` (Task 8), `useAuth().signOut` (Task 5), `window.api` (Task 14).
- Produces: `Reglages` screen; adds route `reglages`. This is the last task — it closes with the full Windows packaging check.

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/Reglages.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../hooks/useSettings';

export default function Reglages() {
  const { signOut } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [autoLaunch, setAutoLaunch] = useState(false);

  useEffect(() => {
    window.api.getAutoLaunch().then(setAutoLaunch);
  }, []);

  async function handleAutoLaunchChange(enabled: boolean) {
    const actual = await window.api.setAutoLaunch(enabled);
    setAutoLaunch(actual);
    await updateSettings({ autoLaunchEnabled: actual });
  }

  if (!settings) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <h1 className="font-serif text-2xl text-champagne">Réglages</h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-lg text-champagne">Rappels</h2>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Seuil de rappel (jours sans pratique)
          <input
            type="number"
            min={1}
            value={settings.reminderThresholdDays}
            onChange={(e) => updateSettings({ reminderThresholdDays: Number(e.target.value) })}
            className="w-24 border border-ink-700 bg-ink-800 px-3 py-2 font-data text-champagne"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
          />
          Notifications natives activées
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={autoLaunch} onChange={(e) => handleAutoLaunchChange(e.target.checked)} />
          Lancer Saint Daily au démarrage de session
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-champagne">À propos</h2>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-champagne">Confidentialité</summary>
          <p className="mt-2">
            Saint Daily est un outil 100% personnel : tes skills, jalons et entrées de pratique ne sont
            visibles que par toi. Les données sont stockées dans le projet Supabase partagé avec Saint Gym,
            protégées par des règles d'accès (RLS) qui limitent chaque ligne à son propriétaire.
          </p>
        </details>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-champagne">Conditions d'utilisation</summary>
          <p className="mt-2">
            Projet personnel — pas de service tiers, pas de compte séparé à créer : Saint Daily réutilise le
            compte existant de l'écosystème Saint.
          </p>
        </details>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-champagne">FAQ</summary>
          <p className="mt-2">
            <strong className="text-champagne">Pourquoi les rappels ne sonnent pas quand l'app est fermée ?</strong>
            <br />
            Les rappels sont calculés pendant que Saint Daily tourne (fenêtre ouverte ou réduite dans le
            system tray). Active le lancement au démarrage ci-dessus pour qu'ils soient toujours actifs.
          </p>
        </details>
      </section>

      <button
        onClick={() => signOut()}
        className="w-fit border border-ink-700 px-4 py-2 text-sm text-muted hover:text-champagne"
      >
        Se déconnecter
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

`src/renderer/src/App.tsx` — add the import and route:

```tsx
import Reglages from './screens/Reglages';
```

```tsx
        <Route path="reglages" element={<Reglages />} />
        <Route path="*" element={<Introuvable />} />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, log in, open "Réglages" from the nav. Expected: current settings load; changing the reminder threshold or toggling notifications persists (reload the window — values survive). Toggling "Lancer au démarrage" calls into the main process (no error in the console) and persists too. Expand each `<details>` (Confidentialité/Conditions/FAQ) — expected: text expands in place. Click "Se déconnecter" — expected: redirected to the Login screen.

- [ ] **Step 4: Full test suite and typecheck**

Run: `npm run test`
Expected: all Vitest suites pass (Task 2's `logoRays.test.ts`, Task 3's `streaks.test.ts`).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Final packaging check**

Run: `npm run icons` (if `resources/icon.ico` isn't already present), then `npm run dist:win`
Expected: `electron-vite build` succeeds, then `electron-builder` produces a Windows installer under `release/` (e.g. `release/Saint Daily Setup 0.1.0.exe`). Running that installer and launching the installed app should reach the Login screen, matching Step 3's manual walkthrough — this is the "operational" milestone for the whole plan.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Reglages.tsx src/renderer/src/App.tsx
git commit -m "Add Réglages screen with reminder/notification/auto-launch settings and legal sections"
```

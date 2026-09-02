# Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Saint Daily a real release pipeline: a private GitHub repo, a Windows `.exe` built and attached to every GitHub Release automatically, a changelog generated from Conventional Commits behind an explicit approval gate, and an in-app auto-updater that downloads silently and never restarts without the user's confirmation.

**Architecture:** `release-please` watches `master`, maintains a single "Release PR" that accumulates the changelog from Conventional Commits, and creates the actual GitHub Release (tag + notes) only when that PR is merged. A second GitHub Actions workflow, triggered by the resulting `release: published` event, builds on `windows-latest` and publishes the `.exe` to that same release — electron-builder's GitHub publisher uploads to an existing release with a matching tag rather than creating a new one. The installed app's main process (`electron-updater`) polls that same GitHub Releases feed on a timer, downloads silently, and only surfaces a banner once a new version is fully downloaded and ready to install.

**Tech Stack:** GitHub Actions, `release-please` (via `googleapis/release-please-action@v4`), `electron-builder`'s GitHub publish provider, `electron-updater`.

**Spec:** [docs/superpowers/specs/2026-09-02-release-pipeline-design.md](../specs/2026-09-02-release-pipeline-design.md)

## Global Constraints

- **No code signing** — the `.exe` is unsigned; Windows SmartScreen will warn "unknown publisher" on install. Accepted for personal use.
- **No retro-labeling of existing commits** — Conventional Commits (`type: sujet`) applies to every commit from Task 2 onward only. The starting point is framed as `1.0.0`, not a reconstructed history.
- **`GITHUB_TOKEN` only** — no personal access token anywhere in this pipeline. Workflow permissions: `contents: write` + `pull-requests: write`.
- **Changelog sections extend beyond the tool's feat/fix default** — `perf`, `refactor`, `chore`, `docs`, `build`, `ci` are all visible, in French section headers, so "bug fix ou pas" is genuinely reflected.
- **Silent update flow** — check and download happen with no visible UI; the ONLY user-facing surface is a banner after a full download, with an explicit button. Never a forced restart.
- **`electron-updater` is inert unless `app.isPackaged`** — matches the existing gating convention already used by `src/main/devLogin.ts`.
- **French UI copy**, matching the rest of the app.
- **Windows-only**, matching the rest of the app.

---

## Task 1: Create the GitHub repository and push existing history

**⚠️ This task performs a real, external, irreversible-in-spirit action** (publishing this repository's full history to a new GitHub repo). Even though the design already establishes this is wanted, confirm with the user immediately before the push step specifically — do not run `git push` without that confirmation in the moment, even if earlier approval covered the plan in general.

**Files:**
- Modify: `package.json` (add a `"repository"` field, needed for `npm`/tooling conventions — NOT required by electron-builder, which infers the GitHub owner/repo from the `git remote` URL directly, but good practice to have it match)

**Interfaces:**
- Consumes: nothing.
- Produces: a `origin` git remote pointing at a real private GitHub repository — consumed implicitly by every later task's git operations (pushes trigger the workflows Tasks 4/5 create) and by electron-builder's publish auto-detection (Task 5).

- [ ] **Step 1: Ask the user to create the empty repository**

There is no `gh` CLI available in this environment (confirmed: `gh --version` fails with "command not found" in both bash and PowerShell), so this cannot be scripted. Ask the user to:

1. Go to `https://github.com/new`
2. Repository name: `saint-daily`
3. Visibility: **Private**
4. Do **not** initialize with a README, `.gitignore`, or license (this repo already has all of those — an initialized remote would create a conflicting, unrelated initial commit)
5. Click "Create repository", then paste the resulting URL (e.g. `https://github.com/<username>/saint-daily.git`) back to you.

Wait for the user's reply with the real URL before continuing. Do not guess or fabricate a username.

- [ ] **Step 2: Add the remote**

```bash
git remote add origin <the URL the user gave you>
```

- [ ] **Step 3: Confirm before pushing, then push**

State plainly what is about to happen: "This pushes the full local history — every commit on `master` — to the new private GitHub repo at `<url>`. Proceed?" Wait for an explicit yes.

```bash
git push -u origin master
```

Expected: push succeeds, no errors. (No GitHub Actions workflows exist yet at this point, so nothing fires — that starts with Task 4.)

- [ ] **Step 4: Add the `repository` field to `package.json`**

In `package.json`, add a `"repository"` key (placed after `"private"`, matching common `package.json` field ordering conventions — exact position doesn't matter functionally). Use the real owner from the URL the user gave you in Step 1 — for example, if the repo is `https://github.com/jdoe/saint-daily.git`:

```json
  "repository": "github:jdoe/saint-daily",
```

- [ ] **Step 5: Commit and push**

```bash
git add package.json
git commit -m "chore: record the GitHub repository in package.json"
git push
```

- [ ] **Step 6: Report the real values for later tasks**

In your task report, state the exact repository URL and owner/slug you used — later tasks that reference "the repo" need this confirmed, not guessed.

---

## Task 2: Version bootstrap to 1.0.0

**Files:**
- Modify: `package.json:4` (the `"version"` field)

**Interfaces:**
- Consumes: nothing.
- Produces: `package.json`'s `"version"` at `"1.0.0"` — this is the value `release-please` (Task 3) reads as its starting point for every future bump calculation.

- [ ] **Step 1: Bump the version**

In `package.json`, change:
```json
  "version": "0.1.0",
```
to:
```json
  "version": "1.0.0",
```

- [ ] **Step 2: Verify nothing else references the old version**

Run: `grep -rn "0.1.0" --include="*.json" --include="*.ts" --include="*.tsx" .` (excluding `node_modules`)
Expected: no matches outside `package-lock.json` (which will resolve itself on the next `npm install`/`npm ci` — do not hand-edit `package-lock.json`).

- [ ] **Step 3: Commit — this is the first Conventional Commit of this pipeline**

```bash
git add package.json
git commit -m "chore: bump version to 1.0.0 as the release-pipeline baseline"
git push
```

From this commit onward, every commit message in this repository follows the `type: sujet` format (`feat:`, `fix:`, `perf:`, `refactor:`, `chore:`, `docs:`, `build:`, `ci:`) — this is what `release-please` (Task 3/4) parses to decide version bumps and changelog entries. Commits before this one are not relabeled.

---

## Task 3: `release-please` configuration files

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

**Interfaces:**
- Consumes: `package.json`'s `"version": "1.0.0"` (Task 2) — the manifest below must match it exactly, or `release-please`'s first run will try to "correct" the version with a spurious bump.
- Produces: the configuration `release-please-action` (Task 4) reads by default (both files are auto-discovered at the repo root by the action — no path needs to be passed explicitly).

- [ ] **Step 1: Write the manifest**

`.release-please-manifest.json`:

```json
{
  ".": "1.0.0"
}
```

- [ ] **Step 2: Write the config**

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "packages": {
    ".": {
      "changelog-sections": [
        { "type": "feat", "section": "Nouveautés" },
        { "type": "fix", "section": "Corrections" },
        { "type": "perf", "section": "Performance" },
        { "type": "refactor", "section": "Améliorations internes" },
        { "type": "chore", "section": "Divers", "hidden": false },
        { "type": "docs", "section": "Documentation", "hidden": false },
        { "type": "build", "section": "Divers", "hidden": false },
        { "type": "ci", "section": "Divers", "hidden": false }
      ]
    }
  }
}
```

(`release-type: node` is what makes `release-please` read/write `package.json`'s `"version"` field directly — correct for any Node-based project regardless of whether it publishes to npm, which this one does not.)

- [ ] **Step 3: Validate both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('release-please-config.json', 'utf-8')); JSON.parse(require('fs').readFileSync('.release-please-manifest.json', 'utf-8')); console.log('valid')"`
Expected: prints `valid`, no errors.

- [ ] **Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "chore: add release-please configuration"
git push
```

---

## Task 4: `release-please` GitHub Actions workflow

**Files:**
- Create: `.github/workflows/release-please.yml`

**Interfaces:**
- Consumes: `release-please-config.json` / `.release-please-manifest.json` (Task 3, auto-discovered).
- Produces: on every push to `master` with pending Conventional Commits, an open/updated "Release PR"; when that PR is merged, a real GitHub Release (tag + notes) — the `release: published` event Task 5's workflow listens for.

- [ ] **Step 1: Write the workflow**

`.github/workflows/release-please.yml`:

```yaml
name: release-please

on:
  push:
    branches: [master]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          target-branch: master
```

(`target-branch: master` is explicit rather than relying on GitHub's default-branch auto-detection — this repo's default branch is `master`, not the more common `main`, and being explicit avoids a subtle misconfiguration if that default is ever misdetected.)

- [ ] **Step 2: Validate the YAML**

Run: `node -e "const yaml = require('fs').readFileSync('.github/workflows/release-please.yml', 'utf-8'); console.log(yaml.length > 0 ? 'non-empty' : 'empty')"` — this only checks the file isn't empty; there is no YAML linter installed in this project. Instead, visually re-read the file once against the schema above and confirm indentation is consistent (2 spaces, no tabs) and every key under `jobs.release-please.steps` is a list item (`-`).

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/release-please.yml
git commit -m "ci: add release-please workflow"
git push
```

- [ ] **Step 4: Verify on GitHub**

Since this push itself is a `chore:`/`ci:`-only change (no `feat:`/`fix:` yet), `release-please` will run but likely won't open a PR yet (nothing releasable has landed since the `1.0.0` baseline commit — a `ci:` commit does not trigger a version bump by default). Confirm the workflow ran successfully anyway (no crash, no permission error): check `https://github.com/<owner>/saint-daily/actions` — the "release-please" workflow's latest run should show a green checkmark. If it shows a red X, read the run's logs before proceeding to Task 5 — a permissions or config error here will also break Task 5's trigger chain.

---

## Task 5: `electron-builder` publish config + build-and-publish workflow

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json` (new script)
- Create: `.github/workflows/build-release.yml`

**Interfaces:**
- Consumes: the `release: published` GitHub event (fired when Task 4's `release-please` merge creates a real release).
- Produces: a `.exe` artifact attached to that same GitHub Release — this is the end-user-visible deliverable the whole plan exists to produce.

- [ ] **Step 1: Add the publish section to `electron-builder.yml`**

Read the current file first (it already has `appId`/`productName`/`directories`/`files`/`extraResources`/`win`/`nsis` keys from earlier packaging work — do not remove or reorder any of those). Add a new top-level `publish` key:

```yaml
publish:
  provider: github
```

No `owner`/`repo` needed — electron-builder infers both from the `git remote origin` URL at build time (confirmed present since Task 1). Place this key anywhere at the top level (after `directories` is a reasonable spot, but exact position doesn't matter).

- [ ] **Step 2: Add a publish-enabled build script**

In `package.json`'s `"scripts"`, add a new script alongside the existing `"dist:win"` (do not modify `"dist:win"` itself — that one must keep building WITHOUT publishing, for local test builds):

```json
    "dist:win:publish": "electron-vite build && electron-builder --win --publish always",
```

- [ ] **Step 3: Write the build-and-publish workflow**

`.github/workflows/build-release.yml`:

```yaml
name: build-and-publish

on:
  release:
    types: [published]

permissions:
  contents: write

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.release.tag_name }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - run: npm run dist:win:publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

(`GH_TOKEN` — not `GITHUB_TOKEN` — is the exact environment variable name electron-builder's GitHub publisher looks for. `secrets.GITHUB_TOKEN` is the automatically-provided token; no manual secret needs to be created. Because the release already exists with a matching tag — created by `release-please` in Task 4 — electron-builder's publisher uploads the `.exe` to that existing release rather than creating a new one; this is documented electron-builder behavior, not something this workflow has to orchestrate itself.)

- [ ] **Step 4: Commit and push**

```bash
git add electron-builder.yml package.json .github/workflows/build-release.yml
git commit -m "ci: build and publish the Windows installer to GitHub Releases"
git push
```

Full end-to-end verification (an actual release triggering an actual `.exe` upload) is not possible until a real `feat:`/`fix:` commit produces a mergeable Release PR — this happens naturally once Task 6's `feat:` commit lands. Note in your report that this task's workflow file is syntactically complete and correctly configured, but its trigger (`release: published`) cannot fire until then — this is expected, not a gap in this task.

---

## Task 6: `electron-updater` — dependency, main-process module, wiring

**Files:**
- Modify: `package.json` (add `electron-updater` dependency)
- Create: `src/main/autoUpdate.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (uses the `publish` config from Task 5's `electron-builder.yml` indirectly, at build time — electron-builder auto-generates `app-update.yml` from that config and embeds it in the packaged app, which is what `electron-updater` reads at runtime; no code in this task references that file directly).
- Produces: `registerAutoUpdateHandlers(getMainWindow: () => BrowserWindow | null): void` (`src/main/autoUpdate.ts`) — consumed by `src/main/index.ts`'s startup sequence in this same task. IPC channels `auto-update:status` (main → renderer, payload one of `'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'`) and `auto-update:install-now` (renderer → main, `ipcMain.handle`) — consumed by Task 7's preload extension.

- [ ] **Step 1: Install the dependency**

```bash
npm install electron-updater
```

- [ ] **Step 2: Write the main-process module**

`src/main/autoUpdate.ts`:

```ts
import { app, ipcMain, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h
const INITIAL_DELAY_MS = 10_000;

export type AutoUpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

/**
 * Vérifie et télécharge les mises à jour en silence — jamais de
 * notification OS générique (contrairement à
 * autoUpdater.checkForUpdatesAndNotify()), jamais de redémarrage forcé.
 * Le renderer n'est prévenu qu'une fois le téléchargement terminé (voir
 * spec, section "Mise à jour automatique"). Inerte hors app packagée :
 * un build non empaqueté n'a pas de app-update.yml généré par
 * electron-builder, electron-updater n'a rien à lire (même garde que
 * src/main/devLogin.ts pour `app.isPackaged`).
 */
export function registerAutoUpdateHandlers(getMainWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  function sendStatus(status: AutoUpdateStatus): void {
    getMainWindow()?.webContents.send('auto-update:status', status);
  }

  autoUpdater.on('checking-for-update', () => sendStatus('checking'));
  autoUpdater.on('update-available', () => sendStatus('downloading'));
  autoUpdater.on('update-not-available', () => sendStatus('idle'));
  autoUpdater.on('update-downloaded', () => sendStatus('downloaded'));
  // Reste silencieux côté utilisateur (voir spec, "Gestion des erreurs") —
  // se corrigera de lui-même à la prochaine vérification périodique — mais
  // loggé côté main process pour du débogage éventuel.
  autoUpdater.on('error', (err) => {
    console.error('[auto-update]', err);
    sendStatus('error');
  });

  ipcMain.handle('auto-update:install-now', () => {
    autoUpdater.quitAndInstall();
  });

  function checkNow(): void {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-update]', err);
      sendStatus('error');
    });
  }

  setTimeout(() => {
    checkNow();
    setInterval(checkNow, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
```

- [ ] **Step 3: Wire it into the main process startup**

In `src/main/index.ts`, add the import:

```ts
import { registerAutoUpdateHandlers } from './autoUpdate';
```

and inside the `app.whenReady()` chain, alongside the other `register*`/`create*` calls:

```ts
    mainWindow = createWindow();
    registerDevLoginHandler();
    registerAutoLaunchHandlers();
    registerAutoUpdateHandlers(() => mainWindow);
    createPomodoroOverlay(() => mainWindow);
    createTray(() => mainWindow);
```

(Only the one new line is added — the existing order/lines are otherwise unchanged.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`window.api.autoUpdate` doesn't exist yet — this task's own code doesn't reference it, only Tasks 7/8 will, so nothing here should fail.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main/autoUpdate.ts src/main/index.ts
git commit -m "feat: check for and silently download app updates"
git push
```

This is the first `feat:` commit since the `1.0.0` baseline — once pushed, `release-please` (Task 4's workflow) should open a Release PR proposing `1.1.0`. Do not merge it yet; later tasks add more to the same pending release. Note in your report whether the PR actually appeared (check `https://github.com/<owner>/saint-daily/pulls`) — this is real signal that Tasks 3/4 are wired correctly, not just syntactically plausible.

---

## Task 7: preload + `env.d.ts` IPC extension for auto-update

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: IPC channels `auto-update:status` / `auto-update:install-now` (Task 6).
- Produces: `window.api.autoUpdate.onStatus(callback)` / `window.api.autoUpdate.installNow()` — consumed by Task 8's renderer component.

**Note on typing:** exactly the same cross-tsconfig-project constraint already established by the Pomodoro feature applies here: `src/preload/index.ts` (`tsconfig.node.json`) cannot import from `src/main/autoUpdate.ts` (also `tsconfig.node.json`, but Vite's per-process build graphs don't share type-only imports across entry points in this project's config) OR from anything under `src/renderer/src/**`. Both this file and `env.d.ts` therefore each declare their own local copy of the `AutoUpdateStatus` union — it is a plain 6-value string union, trivial to keep in sync by hand if it ever changes.

- [ ] **Step 1: Extend the preload script**

In `src/preload/index.ts`, add a local type declaration near the top (alongside the existing `PomodoroStateSnapshot`/`PomodoroControlAction` local declarations):

```ts
type AutoUpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';
```

Then add a new `autoUpdate` key to the exported `api` object (alongside the existing `pomodoro` key):

```ts
  autoUpdate: {
    onStatus: (callback: (status: AutoUpdateStatus) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: AutoUpdateStatus) => callback(status);
      ipcRenderer.on('auto-update:status', listener);
      return () => ipcRenderer.removeListener('auto-update:status', listener);
    },
    installNow: (): Promise<void> => ipcRenderer.invoke('auto-update:install-now'),
  },
```

- [ ] **Step 2: Extend `env.d.ts`**

In `src/renderer/src/env.d.ts`, add the same union as a named export (this one IS the source of truth for the renderer side, since nothing in `src/main/**` can be imported here either):

```ts
export type AutoUpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';
```

and extend `SaintDailyApi`:

```ts
export interface SaintDailyApi {
  getDevLoginCredentials: () => Promise<{ email: string; password: string } | null>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
  pomodoro: {
    reportState: (state: PomodoroStateSnapshot | null) => void;
    onState: (callback: (state: PomodoroStateSnapshot | null) => void) => () => void;
    sendControl: (action: PomodoroControlAction) => void;
    onControl: (callback: (action: PomodoroControlAction) => void) => () => void;
    setPinned: (pinned: boolean) => void;
  };
  autoUpdate: {
    onStatus: (callback: (status: AutoUpdateStatus) => void) => () => void;
    installNow: () => Promise<void>;
  };
}
```

(Only the new `autoUpdate` key and the new `AutoUpdateStatus` export are added — the existing `pomodoro` key and everything else in the file is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: expose the auto-update status bridge to the renderer"
git push
```

---

## Task 8: Renderer update banner

**Files:**
- Create: `src/renderer/src/components/UpdateBanner.tsx`
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `window.api.autoUpdate.onStatus`/`installNow` (Task 7); `AutoUpdateStatus` type (Task 7, imported from `../env`).
- Produces: nothing consumed elsewhere — last task in this plan.

- [ ] **Step 1: Write the banner component**

`src/renderer/src/components/UpdateBanner.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { AutoUpdateStatus } from '../env';

// Le seul état qui produit une UI visible est 'downloaded' — voir spec,
// "jamais de redémarrage forcé sans action de l'utilisateur". Les autres
// statuts (checking/downloading/idle/error) restent silencieux par
// conception, pas un oubli.
export default function UpdateBanner() {
  const [status, setStatus] = useState<AutoUpdateStatus>('idle');

  useEffect(() => window.api?.autoUpdate?.onStatus?.(setStatus), []);

  if (status !== 'downloaded') return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-accent-bright/35 bg-ink-800 px-6 py-3">
      <p className="font-sans text-sm text-champagne">Mise à jour disponible — redémarrer pour l'appliquer.</p>
      <button
        onClick={() => window.api?.autoUpdate?.installNow?.()}
        className="border border-accent-bright px-4 py-1.5 font-sans text-sm font-semibold text-accent-bright hover:bg-accent-bright hover:text-ink-900"
      >
        Redémarrer maintenant
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `AppShell`**

`AppShell.tsx`'s current root element is a single `flex h-screen` row (`<nav>` beside `<main>`). A full-width banner needs to sit ABOVE that row, so the root needs to become a column, with the existing row nested one level in. Replace:

```tsx
  return (
    <div className="flex h-screen bg-ink-900 text-champagne">
      <nav
```

with:

```tsx
  return (
    <div className="flex h-screen flex-col bg-ink-900 text-champagne">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      <nav
```

and change the file's closing tags accordingly — the existing structure was:

```tsx
      </nav>
      <main
        ...
      >
        <Outlet />
      </main>
    </div>
  );
}
```

which becomes:

```tsx
      </nav>
      <main
        ...
      >
        <Outlet />
      </main>
      </div>
    </div>
  );
}
```

(One new wrapping `<div className="flex flex-1 overflow-hidden">` around the existing `<nav>...</nav><main>...</main>` pair, closed right before the outer `</div>`. `overflow-hidden` on this new wrapper keeps `<main>`'s own `overflow-y-auto` scoped correctly now that it's nested one level deeper — without it, the added flex layer could let content overflow past the banner instead of scrolling within `<main>`.)

Add the import at the top of the file:

```tsx
import UpdateBanner from './UpdateBanner';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify live via `/dev-login`**

Preview the `saint-daily-dev` launch config, navigate to `/#/dev-login`, then to `/#/`. Expected: the app renders exactly as before — no visible banner (status defaults to `'idle'`, `window.api` is undefined in the bare browser preview anyway, so `onStatus` never fires). This confirms the layout restructuring didn't break anything visually. The banner's actual "downloaded" state cannot be exercised outside a real packaged app being offered a real newer release — that only becomes testable once this whole pipeline has shipped at least two versions, which is expected, not a gap in this task.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/UpdateBanner.tsx src/renderer/src/components/AppShell.tsx
git commit -m "feat: show a banner to install a downloaded update"
git push
```

---

## Final manual pass (real end-to-end verification — not covered by any single task above)

Once all 8 tasks are merged:

1. Go to `https://github.com/<owner>/saint-daily/pulls` — a "Release PR" from `release-please` should exist, titled something like "chore(master): release 1.1.0", with a changelog body listing the `feat:` commits from Tasks 6-8 under "Nouveautés".
2. Review and merge that PR (a real, deliberate "yes, publish" action — confirm with the user before merging if this session is doing it, since it's the actual public-release trigger the whole design exists to gate).
3. Watch `https://github.com/<owner>/saint-daily/actions` — the "build-and-publish" workflow should start automatically (triggered by the release `release-please` just created), run on `windows-latest`, and finish green.
4. Check `https://github.com/<owner>/saint-daily/releases` — the `v1.1.0` release should now have a `.exe` file attached as a release asset.
5. Download and install that `.exe` on the machine that will run Saint Daily day-to-day (expect the SmartScreen "unknown publisher" warning — this is the accepted limitation from the spec, not a bug).
6. To test auto-update itself: with that `1.1.0` build installed and running, land one more small `fix:` commit, merge its Release PR, wait for the build to publish `1.1.1`, then wait up to 4 hours (or restart the app, which triggers an immediate check) — confirm the update banner appears and that clicking "Redémarrer maintenant" actually relaunches the app on the new version (check Réglages or the title bar, if either surfaces a version number — if neither does today, that's a reasonable small follow-up, not part of this plan).

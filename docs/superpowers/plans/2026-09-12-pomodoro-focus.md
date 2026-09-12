# Pomodoro et mode focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Épingler automatiquement l'overlay Pomodoro quand on réduit la fenêtre, annoncer le prochain engagement au survol du tray, lancer un Pomodoro depuis l'agenda, et offrir un mode focus plein écran.

**Architecture:** L'épinglage automatique est entièrement côté process principal (deux drapeaux et deux écouteurs de fenêtre). L'aperçu du tray est poussé par le renderer, seul à avoir accès à Supabase. Le mode focus est une route sœur d'`AppShell`, sous les mêmes fournisseurs mais sans le rail de navigation.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind + Supabase + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-daily-tool-backlog-design.md` (chantier 5)

**Aucune migration.** Ce chantier est intégralement vérifiable en conditions réelles.

## Global Constraints

- Toute copie visible est **en français**.
- Palette limitée aux jetons existants de `src/renderer/src/theme/colors.ts`.
- **Aucune nouvelle dépendance npm.**
- Logique pure dans `src/renderer/src/lib/*.ts`, testée avec Vitest. **Aucun test de composant React.**
- Toute erreur remontée à l'écran (`role="alert"`, `text-danger`), jamais avalée.
- Accessibilité : `aria-label` sur tout contrôle sans libellé visible, anneau de focus visible.
- **Ne jamais lire de données via un état monté une seule fois pour la session.** `useEngagements` et consorts ne se rafraîchissent que sur leurs propres mutations, or l'app tourne des jours dans le tray : tout ce qui doit rester à jour interroge lui-même, périodiquement. Règle tirée d'un défaut critique trouvé en revue au chantier 2.

---

### Task 1: Épinglage automatique de l'overlay

**Files:**
- Modify: `src/main/pomodoroOverlay.ts`

**Interfaces:**
- Le bouton « épingler » manuel existant (`pomodoro:set-pinned`) reste inchangé côté renderer ; le process principal le combine désormais avec un second drapeau.

- [ ] **Step 1: Suivre l'état de session et les deux drapeaux**

Dans `src/main/pomodoroOverlay.ts`, ajouter au niveau du module, à côté de `let overlayWindow` :

```ts
// Deux raisons indépendantes d'afficher l'overlay : le bouton « épingler »
// de la fenêtre principale, et la réduction de celle-ci pendant une
// session. L'overlay est visible si l'une OU l'autre est vraie — sinon,
// restaurer la fenêtre effacerait un épinglage manuel que l'utilisateur
// vient de demander explicitement.
let manuallyPinned = false;
let autoShownByMinimize = false;
let hasActiveSession = false;

function applyOverlayVisibility(): void {
  if (manuallyPinned || autoShownByMinimize) overlayWindow?.show();
  else overlayWindow?.hide();
}
```

- [ ] **Step 2: Alimenter `hasActiveSession` depuis le relais existant**

Le process principal relaie déjà chaque instantané d'état ; il lui suffit de le lire au passage — aucun nouveau canal IPC n'est nécessaire. Remplacer le corps du relais `pomodoro:state-changed` par :

```ts
  ipcMain.on('pomodoro:state-changed', (_event, state) => {
    hasActiveSession = state !== null && state?.session?.status !== 'idle';
    // Une session qui se termine pendant que la fenêtre est réduite doit
    // faire disparaître l'overlay : sans ça il resterait affiché, figé sur
    // la dernière phase, jusqu'à la prochaine restauration de fenêtre.
    if (!hasActiveSession && autoShownByMinimize) {
      autoShownByMinimize = false;
      applyOverlayVisibility();
    }
    overlayWindow?.webContents.send('pomodoro:state', state);
  });
```

- [ ] **Step 3: Remplacer le handler d'épinglage manuel**

```ts
  ipcMain.on('pomodoro:set-pinned', (_event, pinned: boolean) => {
    manuallyPinned = pinned;
    applyOverlayVisibility();
  });
```

- [ ] **Step 4: Écouter la réduction et la restauration de la fenêtre principale**

Toujours dans `createPomodoroOverlay`, après le branchement des canaux IPC :

```ts
  // `src/main/index.ts` appelle `createPomodoroOverlay` après
  // `mainWindow = createWindow()`, donc la fenêtre existe forcément ici —
  // le `if` n'est qu'un garde de typage, pas un cas de repli.
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.on('minimize', () => {
      if (!hasActiveSession) return;
      autoShownByMinimize = true;
      applyOverlayVisibility();
    });
    mainWindow.on('restore', () => {
      autoShownByMinimize = false;
      applyOverlayVisibility();
    });
    // `hide()` (fermeture interceptée, clic sur l'icône du tray) n'émet pas
    // 'minimize' : sans ces deux-là, réduire l'app dans le tray pendant une
    // session n'afficherait rien.
    mainWindow.on('hide', () => {
      if (!hasActiveSession) return;
      autoShownByMinimize = true;
      applyOverlayVisibility();
    });
    mainWindow.on('show', () => {
      autoShownByMinimize = false;
      applyOverlayVisibility();
    });
  }
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, les 137 tests existants toujours verts.

- [ ] **Step 6: Commit**

```bash
git add src/main/pomodoroOverlay.ts
git commit -m "feat: show the pomodoro overlay automatically while the window is away"
```

---

### Task 2: Aperçu du prochain engagement au survol du tray

**Files:**
- Modify: `src/main/tray.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Create: `src/renderer/src/hooks/useTrayNextEngagement.ts`
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Produces: `window.api.setTrayNextEngagement(label: string | null)` et le hook `useTrayNextEngagement()`

- [ ] **Step 1: Rendre l'infobulle du tray modifiable**

Dans `src/main/tray.ts`, remplacer la ligne `tray.setToolTip('Saint Daily');` par un état et une fonction exportée :

```ts
export function setTrayNextEngagement(label: string | null): void {
  // L'infobulle est la seule surface de l'app visible sans ouvrir la
  // fenêtre : elle garde toujours le nom du produit en première ligne,
  // pour rester identifiable parmi les autres icônes du tray.
  tray?.setToolTip(label ? `Saint Daily\n${label}` : 'Saint Daily');
}
```

et, dans `createTray`, remplacer l'appel direct par `setTrayNextEngagement(null);`.

- [ ] **Step 2: Brancher le canal IPC**

Dans `src/main/index.ts`, importer `setTrayNextEngagement` depuis `./tray` et ajouter, dans le bloc `app.whenReady().then(…)`, à côté des autres branchements :

```ts
    ipcMain.on('tray:set-next-engagement', (_event, label: string | null) => {
      setTrayNextEngagement(label);
    });
```

- [ ] **Step 3: Exposer la méthode dans le preload**

Dans `src/preload/index.ts`, dans l'objet `api`, à côté de `focusWindow` :

```ts
  setTrayNextEngagement: (label: string | null): void => {
    ipcRenderer.send('tray:set-next-engagement', label);
  },
```

- [ ] **Step 4: Déclarer la méthode dans les types du renderer**

Dans `src/renderer/src/env.d.ts`, interface `SaintDailyApi`, à côté de `focusWindow` :

```ts
  setTrayNextEngagement: (label: string | null) => void;
```

- [ ] **Step 5: Écrire le hook**

Créer `src/renderer/src/hooks/useTrayNextEngagement.ts` :

```ts
import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';

// Une requête par minute, sur une seule ligne : l'infobulle n'a pas besoin
// d'être à la seconde près, mais elle doit refléter une tâche créée il y a
// deux minutes. Elle interroge donc elle-même plutôt que de consommer un
// état monté au démarrage et jamais rafraîchi — l'app tourne des jours
// dans le tray.
const REFRESH_INTERVAL_MS = 60_000;

interface NextEngagementRow {
  name: string;
  scheduled_at: string;
  deleted_at?: string | null;
}

function formatLabel(row: NextEngagementRow): string {
  const at = new Date(row.scheduled_at);
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate();
  const day = sameDay ? "aujourd'hui" : at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `Prochain : ${row.name} — ${day} à ${time}`;
}

/**
 * Tient à jour l'infobulle de l'icône du tray avec le prochain engagement
 * planifié. Monté une seule fois, dans `AppShell`.
 */
export function useTrayNextEngagement(): void {
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data, error } = await getSupabaseClient()
        .from('engagement')
        // `select('*')` et tri des supprimés côté client : nommer
        // `deleted_at` ferait échouer la requête tant que la migration de
        // la corbeille n'est pas appliquée à la base live.
        .select('*')
        .is('archived_at', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5);
      if (cancelled || error) return;
      const next = ((data ?? []) as NextEngagementRow[]).find((row) => !row.deleted_at);
      window.api?.setTrayNextEngagement?.(next ? formatLabel(next) : null);
    }

    void refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
```

- [ ] **Step 6: Monter le hook**

Dans `src/renderer/src/components/AppShell.tsx`, importer `useTrayNextEngagement` et l'appeler sans argument à côté de `useEngagementReminders()`.

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 8: Commit**

```bash
git add src/main/tray.ts src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts src/renderer/src/hooks/useTrayNextEngagement.ts src/renderer/src/components/AppShell.tsx
git commit -m "feat: show the next scheduled engagement in the tray tooltip"
```

---

### Task 3: Lancer un Pomodoro depuis l'agenda

**Files:**
- Modify: `src/renderer/src/screens/Pomodoro.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`

**Interfaces:**
- `TaskPopover` gagne un lien vers `/pomodoro?skillId=<id de la tâche>`

- [ ] **Step 1: Accepter une tâche planifiée comme cible d'un lien profond**

`Pomodoro.tsx` construit aujourd'hui `skills` en excluant tout ce qui a un `scheduledAt`, et `selectedSkill` cherche uniquement dans cette liste : un lien profond pointant vers une tâche ne résoudrait donc rien, et l'écran resterait vide sans expliquer pourquoi.

Le sélecteur, lui, doit continuer à ne proposer que des skills — une liste contenant les 56 occurrences d'une série récurrente serait inutilisable.

Remplacer la ligne qui calcule `selectedSkill` par :

```tsx
  // Le sélecteur ne liste que des skills, mais une cible arrivée par lien
  // profond peut être une tâche planifiée (« Démarrer un pomodoro » depuis
  // le calendrier). On la résout donc dans l'ensemble des engagements
  // praticables, projets exclus — ils n'ont pas d'historique de pratique.
  const selectedSkill =
    engagements.find((e) => e.id === skillId && !e.isProject && !e.archivedAt) ?? null;
```

- [ ] **Step 2: Ajouter le lien dans `TaskPopover.tsx`**

`TaskPopover` est présentationnel et reçoit sa tâche en prop. Ajouter, dans la rangée de boutons du bas, à côté des autres actions :

```tsx
          <Link to={`/pomodoro?skillId=${task.id}`} className={buttonClassName('secondary', 'sm')}>
            Démarrer un pomodoro
          </Link>
```

en important `Link` depuis `react-router-dom` et `buttonClassName` depuis `./Button` si ce n'est pas déjà fait.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Pomodoro.tsx src/renderer/src/components/TaskPopover.tsx
git commit -m "feat: start a pomodoro on a task straight from the calendar"
```

---

### Task 4: Mode focus plein écran

**Files:**
- Create: `src/renderer/src/screens/Focus.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`

**Interfaces:**
- Produces: la route `/focus/:engagementId`, rendue **sans** le rail de navigation

- [ ] **Step 1: Restructurer les routes pour qu'un écran puisse sortir du rail**

Aujourd'hui `AuthGate` et `PomodoroProvider` sont écrits directement dans l'élément de la route qui rend `AppShell` : rien ne peut donc être authentifié et connecté au Pomodoro sans hériter du rail.

Extraire un layout dans `src/renderer/src/App.tsx`, à côté de `AuthProviderLayout` :

```tsx
// Sépare « être authentifié et connecté au Pomodoro » de « avoir le rail
// de navigation », pour que le mode focus puisse être l'un sans l'autre.
// Hisser `PomodoroProvider` ici lui fait aussi survivre à l'entrée et à la
// sortie du mode focus : une session en cours n'est pas interrompue.
function AppProvidersLayout() {
  return (
    <AuthGate>
      <PomodoroProvider>
        <Outlet />
      </PomodoroProvider>
    </AuthGate>
  );
}
```

Puis remplacer la route qui portait `AuthGate`/`PomodoroProvider`/`AppShell` par cette structure, en gardant **toutes** les routes existantes exactement où elles sont, y compris le `path="*"` qui doit rester sous `AppShell` :

```tsx
        <Route element={<AppProvidersLayout />}>
          <Route path="focus/:engagementId" element={<Focus />} />
          <Route element={<AppShell />}>
            {/* … toutes les routes existantes, inchangées … */}
          </Route>
        </Route>
```

- [ ] **Step 2: Écrire l'écran**

Créer `src/renderer/src/screens/Focus.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useMilestones } from '../hooks/useMilestones';
import { usePomodoro } from '../lib/pomodoro';
import MilestoneChecklist from '../components/MilestoneChecklist';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const PHASE_LABELS: Record<string, string> = {
  work: 'Travail',
  shortBreak: 'Pause courte',
  longBreak: 'Pause longue',
};

export default function Focus() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const { engagements, loading, error } = useEngagements();
  const engagement = engagements.find((e) => e.id === engagementId) ?? null;
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(engagementId ?? null);
  const { session, durations, start } = usePomodoro();
  const [actionError, setActionError] = useState<string | null>(null);
  // Le compte à rebours est purement local : l'état Pomodoro n'est poussé
  // qu'aux transitions de phase, pas à chaque seconde.
  const [now, setNow] = useState(() => Date.now());

  const runningHere = session && session.skillId === engagementId ? session : null;

  useEffect(() => {
    if (!runningHere) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningHere]);

  if (loading && engagements.length === 0) {
    return <EmptyState role="status">Chargement…</EmptyState>;
  }

  if (!engagement) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-900 px-8">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted">Cet engagement n'existe plus.</p>
        )}
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  async function handleAddMilestone(label: string) {
    setActionError(null);
    const { error: addError } = await addMilestone(label);
    if (addError) setActionError(addError);
  }

  async function handleToggleMilestone(id: string, completed: boolean) {
    setActionError(null);
    const { error: toggleError } = await toggleMilestone(id, completed);
    if (toggleError) setActionError(toggleError);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 px-8 py-10">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Mode focus</p>
          <h1 className="mt-2 font-serif text-[38px] leading-tight text-champagne">{engagement.name}</h1>
          {engagement.tags.length > 0 && (
            <p className="mt-2 text-[13px] text-muted">{engagement.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
          {engagement.notes && <p className="mt-4 text-sm text-champagne">{engagement.notes}</p>}
        </div>

        <div className="border border-ink-700 bg-ink-800 px-6 py-5">
          {runningHere ? (
            <div className="flex items-baseline gap-4">
              <span className="font-serif text-[44px] tabular-nums text-accent-bright">
                {formatRemaining(runningHere.phaseEndsAt - now)}
              </span>
              <span className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">
                {PHASE_LABELS[runningHere.phase] ?? runningHere.phase}
              </span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={!durations}
              onClick={() => durations && start(engagement.id, engagement.name, durations.workMinutes)}
            >
              Démarrer un pomodoro
            </Button>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold text-champagne">Sous-tâches</h2>
          <MilestoneChecklist
            milestones={milestones}
            onToggle={handleToggleMilestone}
            onAdd={handleAddMilestone}
            error={milestonesError ?? actionError}
          />
        </div>

        <div>
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Quitter le mode focus
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Avant d'écrire ce fichier, lire `src/renderer/src/components/MilestoneChecklist.tsx` et `src/renderer/src/hooks/useMilestones.ts`** et ajuster les appels ci-dessus aux signatures réelles (`onToggle`, `onAdd`, `error`, valeurs de retour d'`addMilestone`/`toggleMilestone`) plutôt que de supposer.

- [ ] **Step 3: Ajouter les points d'entrée**

Dans `src/renderer/src/screens/DetailSkill.tsx`, à côté du lien « Démarrer un pomodoro » existant :

```tsx
          <Link to={`/focus/${skill.id}`} className={buttonClassName('secondary', 'sm')}>
            Focus
          </Link>
```

Dans `src/renderer/src/components/TaskPopover.tsx`, à côté du lien Pomodoro ajouté au Task 3 :

```tsx
          <Link to={`/focus/${task.id}`} className={buttonClassName('secondary', 'sm')}>
            Focus
          </Link>
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Focus.tsx src/renderer/src/App.tsx src/renderer/src/screens/DetailSkill.tsx src/renderer/src/components/TaskPopover.tsx
git commit -m "feat: add a distraction-free focus mode for a single engagement"
```

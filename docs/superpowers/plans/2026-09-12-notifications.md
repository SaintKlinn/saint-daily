# Rappels programmés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifier l'utilisateur qu'une tâche planifiée approche (délai configurable) puis qu'elle commence, sans jamais déverser de rappels périmés.

**Architecture:** Une fonction pure décide quels déclencheurs sont dus à un instant donné ; un hook monté une seule fois dans `AppShell` l'interroge toutes les 20 secondes et affiche les notifications natives. Aucune brique nouvelle côté process principal hormis un canal IPC pour ramener la fenêtre au premier plan.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind + Supabase + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-daily-tool-backlog-design.md` (chantier 2)

## Global Constraints

- Toute copie visible est **en français**.
- Palette limitée aux jetons existants de `src/renderer/src/theme/colors.ts`.
- **Aucune nouvelle dépendance npm.** On utilise l'API `Notification` du renderer, déjà employée par `src/renderer/src/lib/pomodoro.tsx`.
- Logique pure dans `src/renderer/src/lib/*.ts`, testée avec Vitest. **Aucun test de composant React.**
- Toute erreur remontée à l'écran (`role="alert"`, `text-danger`), jamais avalée.
- Accessibilité : `aria-label` sur tout champ sans libellé visible, anneau de focus visible.
- Le réglage global existant `notificationsEnabled` gouverne ces rappels, comme il gouverne déjà ceux du Pomodoro. Pas de réglage par engagement.

### Contrainte de déploiement propre à ce chantier

La migration de ce chantier **ne sera appliquée à la base live qu'après le merge** (l'utilisateur est absent et seul lui peut l'exécuter). Le code doit donc rester fonctionnel tant que la colonne n'existe pas : la lecture des réglages retombe sur la valeur par défaut au lieu de produire `undefined`. C'est explicitement demandé au Task 1, ne pas le "simplifier".

---

### Task 1: Migration et réglage du délai

**Files:**
- Create: `supabase/migrations/0009_reminder_lead_minutes.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useSettings.ts`
- Modify: `src/renderer/src/screens/Reglages.tsx`

**Interfaces:**
- Produces: `SkillAppSettings.reminderLeadMinutes: number` (défaut 10), lisible et modifiable depuis Réglages.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0009_reminder_lead_minutes.sql` :

```sql
begin;

alter table saint_daily.app_settings
  add column reminder_lead_minutes integer not null default 10;

commit;
```

- [ ] **Step 2: Ajouter le champ au type**

Dans `src/renderer/src/lib/types.ts`, interface `SkillAppSettings`, ajouter la ligne juste après `reminderThresholdDays: number;` :

```ts
  reminderLeadMinutes: number;
```

- [ ] **Step 3: Câbler le champ dans `useSettings.ts`**

Quatre modifications dans `src/renderer/src/hooks/useSettings.ts` :

1. Dans `interface SettingsRow`, après `reminder_threshold_days: number;` :

```ts
  reminder_lead_minutes: number;
```

2. Dans `fromRow`, après `reminderThresholdDays: row.reminder_threshold_days,` :

```ts
    // `?? 10` volontaire : la migration qui ajoute cette colonne est
    // appliquée à la base live après le déploiement du code. Sans ce
    // repli, `reminderLeadMinutes` vaudrait `undefined` entre les deux et
    // l'instant du rappel se calculerait à NaN — aucun rappel ne partirait
    // jamais, en silence.
    reminderLeadMinutes: row.reminder_lead_minutes ?? 10,
```

3. Dans `toRow`, après la ligne `reminderThresholdDays` :

```ts
    ...(patch.reminderLeadMinutes !== undefined ? { reminder_lead_minutes: patch.reminderLeadMinutes } : {}),
```

4. Dans `DEFAULT_SETTINGS`, après `reminderThresholdDays: 5,` :

```ts
  reminderLeadMinutes: 10,
```

- [ ] **Step 4: Ajouter le champ dans `Reglages.tsx`**

Ajouter ce gestionnaire juste après la fonction `handleNotificationsChange` existante :

```tsx
  async function handleReminderLeadChange(value: number) {
    setActionError(null);
    const { error: updateError } = await updateSettings({ reminderLeadMinutes: value });
    if (updateError) setActionError(updateError);
  }
```

Puis, dans le JSX, insérer ce bloc **immédiatement après** le composant `<Toggle … label="Notifications natives" … />` :

```tsx
        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <div>
            <p className="text-[15px] text-champagne">Rappel avant une tâche planifiée</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Combien de minutes à l'avance prévenir qu'une tâche planifiée approche
            </p>
          </div>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.reminderLeadMinutes}
              onChange={(e) => handleReminderLeadChange(Number(e.target.value))}
              aria-label="Délai du rappel avant une tâche, en minutes"
              className={`w-10 bg-transparent text-right font-data text-[15px] text-champagne ${FOCUS_RING}`}
            />
            <span className="font-data text-[15px] text-champagne">min</span>
          </label>
        </div>
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, les 109 tests existants toujours verts.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0009_reminder_lead_minutes.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useSettings.ts src/renderer/src/screens/Reglages.tsx
git commit -m "feat: add a configurable lead time for scheduled-task reminders"
```

---

### Task 2: Logique pure des rappels dus

**Files:**
- Create: `src/renderer/src/lib/reminders.ts`
- Test: `src/renderer/src/lib/reminders.test.ts`

**Interfaces:**
- Produces: `ReminderEngagement`, `ReminderKind`, `DueReminder`, `REMINDER_TOLERANCE_MS`, `reminderKey`, `dueReminders`, `reminderMessage`

- [ ] **Step 1: Écrire le fichier de tests**

```ts
import { describe, expect, it } from 'vitest';
import { dueReminders, reminderKey, reminderMessage, REMINDER_TOLERANCE_MS } from './reminders';

const NOW = new Date('2026-09-12T10:00:00Z');

function engagement(overrides: Partial<{ id: string; name: string; scheduledAt: string | null; archivedAt: string | null }> = {}) {
  return {
    id: 'e1',
    name: 'Cours de guitare',
    scheduledAt: '2026-09-12T10:10:00Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('dueReminders', () => {
  it('returns nothing without engagements', () => {
    expect(dueReminders([], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('fires the lead reminder exactly when the lead time is reached', () => {
    // Planifiée à 10:10, délai 10 min => déclencheur à 10:00 pile.
    const due = dueReminders([engagement()], {}, NOW, 10, new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ engagementId: 'e1', kind: 'lead', stale: false });
  });

  it('does not fire before the lead time', () => {
    const due = dueReminders([engagement()], {}, NOW, 5, new Set());
    expect(due).toEqual([]);
  });

  it('fires the start reminder once the scheduled time is reached', () => {
    const due = dueReminders([engagement({ scheduledAt: '2026-09-12T10:00:00Z' })], {}, NOW, 10, new Set());
    expect(due.map((r) => r.kind)).toEqual(['lead', 'start']);
  });

  it('marks a trigger older than the tolerance as stale', () => {
    const long = new Date(NOW.getTime() - REMINDER_TOLERANCE_MS - 1000).toISOString();
    const due = dueReminders([engagement({ scheduledAt: long })], {}, NOW, 0, new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: 'start', stale: true });
  });

  it('keeps a trigger just inside the tolerance fresh', () => {
    const recent = new Date(NOW.getTime() - 30_000).toISOString();
    const due = dueReminders([engagement({ scheduledAt: recent })], {}, NOW, 0, new Set());
    expect(due[0]).toMatchObject({ kind: 'start', stale: false });
  });

  it('skips engagements that are not scheduled', () => {
    expect(dueReminders([engagement({ scheduledAt: null })], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('skips archived engagements', () => {
    expect(dueReminders([engagement({ archivedAt: '2026-09-01T00:00:00Z' })], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('skips engagements that already have a practice entry', () => {
    expect(dueReminders([engagement()], { e1: 1 }, NOW, 10, new Set())).toEqual([]);
  });

  it('skips triggers already fired', () => {
    const fired = new Set([reminderKey('e1', 'lead')]);
    expect(dueReminders([engagement()], {}, NOW, 10, fired)).toEqual([]);
  });

  it('emits only the start trigger when the lead time is zero', () => {
    const due = dueReminders([engagement({ scheduledAt: '2026-09-12T10:00:00Z' })], {}, NOW, 0, new Set());
    expect(due.map((r) => r.kind)).toEqual(['start']);
  });

  it('ignores an unparseable scheduled date instead of throwing', () => {
    expect(dueReminders([engagement({ scheduledAt: 'pas une date' })], {}, NOW, 10, new Set())).toEqual([]);
  });
});

describe('reminderKey', () => {
  it('is stable and distinguishes the two kinds', () => {
    expect(reminderKey('abc', 'lead')).toBe('abc:lead');
    expect(reminderKey('abc', 'start')).toBe('abc:start');
  });
});

describe('reminderMessage', () => {
  it('wording depends on the kind', () => {
    const base = { engagementId: 'e1', name: 'Cours de guitare', key: 'e1:lead', stale: false };
    expect(reminderMessage({ ...base, kind: 'lead' }, 10)).toBe('Cours de guitare dans 10 min');
    expect(reminderMessage({ ...base, kind: 'start' }, 10)).toBe('Cours de guitare commence maintenant');
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm test -- --run src/renderer/src/lib/reminders.test.ts`
Expected: FAIL — le module `./reminders` n'existe pas.

- [ ] **Step 3: Écrire l'implémentation**

```ts
export interface ReminderEngagement {
  id: string;
  name: string;
  scheduledAt: string | null;
  archivedAt: string | null;
}

export type ReminderKind = 'lead' | 'start';

export interface DueReminder {
  engagementId: string;
  name: string;
  kind: ReminderKind;
  key: string;
  /**
   * Déclencheur dépassé depuis trop longtemps pour être montré. Il est
   * quand même renvoyé, pour que l'appelant le marque comme vu : sans ça
   * il reviendrait à chaque vérification suivante.
   */
  stale: boolean;
}

/**
 * Au-delà de ce retard, un rappel n'est plus affiché. Au réveil d'une
 * machine restée en veille, afficher d'un coup tous les rappels des
 * dernières heures est plus nuisible qu'utile — et un « dans 10 min »
 * arrivant deux heures trop tard est simplement faux.
 */
export const REMINDER_TOLERANCE_MS = 2 * 60_000;

export function reminderKey(engagementId: string, kind: ReminderKind): string {
  return `${engagementId}:${kind}`;
}

/**
 * Déclencheurs dus à l'instant `now` et pas encore traités.
 *
 * Un engagement est éligible s'il est planifié, non archivé et n'a encore
 * aucune entrée de pratique — exactement le critère qu'utilise déjà la
 * liste « Tâches à faire » de l'Accueil pour décider qu'une tâche reste à
 * faire. Une tâche cochée ne se rappelle donc plus.
 */
export function dueReminders(
  engagements: ReminderEngagement[],
  entryCountByEngagement: Record<string, number>,
  now: Date,
  leadMinutes: number,
  fired: ReadonlySet<string>
): DueReminder[] {
  const nowMs = now.getTime();
  const due: DueReminder[] = [];

  for (const engagement of engagements) {
    if (!engagement.scheduledAt) continue;
    if (engagement.archivedAt) continue;
    if ((entryCountByEngagement[engagement.id] ?? 0) > 0) continue;

    const startMs = new Date(engagement.scheduledAt).getTime();
    if (!Number.isFinite(startMs)) continue;

    const triggers: { kind: ReminderKind; at: number }[] = [{ kind: 'start', at: startMs }];
    // À délai nul, le rappel d'anticipation tomberait à la même seconde
    // que celui de départ : deux notifications identiques d'affilée.
    if (leadMinutes > 0) {
      triggers.unshift({ kind: 'lead', at: startMs - leadMinutes * 60_000 });
    }

    for (const trigger of triggers) {
      const key = reminderKey(engagement.id, trigger.kind);
      if (fired.has(key)) continue;
      if (trigger.at > nowMs) continue;
      due.push({
        engagementId: engagement.id,
        name: engagement.name,
        kind: trigger.kind,
        key,
        stale: nowMs - trigger.at > REMINDER_TOLERANCE_MS,
      });
    }
  }

  return due;
}

export function reminderMessage(reminder: DueReminder, leadMinutes: number): string {
  return reminder.kind === 'lead'
    ? `${reminder.name} dans ${leadMinutes} min`
    : `${reminder.name} commence maintenant`;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test -- --run src/renderer/src/lib/reminders.test.ts`
Expected: PASS, tous les tests.

- [ ] **Step 5: Vérifier le typage et la suite complète**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, tous les tests toujours verts.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/reminders.ts src/renderer/src/lib/reminders.test.ts
git commit -m "feat: add pure scheduling logic for task reminders"
```

---

### Task 3: Canal IPC de mise au premier plan, hook, et montage

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Create: `src/renderer/src/hooks/useEngagementReminders.ts`
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `dueReminders`, `reminderMessage`, `ReminderEngagement` de `../lib/reminders`
- Produces: `window.api.focusWindow()` et `useEngagementReminders(engagements, entryCountByEngagement, notificationsEnabled, leadMinutes)`

- [ ] **Step 1: Ajouter le canal IPC côté process principal**

Dans `src/main/index.ts`, dans le bloc `app.whenReady().then(() => { … })`, ajouter juste après la ligne `ipcMain.handle('get-app-version', …)` :

```ts
    // Clic sur une notification de rappel : la fenêtre est peut-être
    // cachée dans le tray (sa fermeture est interceptée en `hide()`),
    // donc `focus()` seul ne suffirait pas à la faire réapparaître.
    ipcMain.on('window:focus', () => {
      if (!mainWindow) return;
      mainWindow.show();
      mainWindow.focus();
    });
```

- [ ] **Step 2: Exposer la méthode dans le preload**

Dans `src/preload/index.ts`, dans l'objet `api`, ajouter après la ligne `getAutoLaunch: …` :

```ts
  focusWindow: (): void => {
    ipcRenderer.send('window:focus');
  },
```

- [ ] **Step 3: Déclarer la méthode dans les types du renderer**

Dans `src/renderer/src/env.d.ts`, dans l'interface `SaintDailyApi`, ajouter à côté des autres méthodes de premier niveau (avant la propriété `pomodoro`) :

```ts
  focusWindow: () => void;
```

- [ ] **Step 4: Écrire le hook**

Créer `src/renderer/src/hooks/useEngagementReminders.ts` :

```ts
import { useEffect, useRef } from 'react';
import { dueReminders, reminderMessage, type ReminderEngagement } from '../lib/reminders';

// Vingt secondes : assez fin pour qu'un rappel parte bien dans sa fenêtre
// de tolérance de deux minutes, assez espacé pour rester négligeable.
const CHECK_INTERVAL_MS = 20_000;

/**
 * Surveille les tâches planifiées et pousse une notification native au
 * moment voulu. Monté une seule fois, dans `AppShell`.
 *
 * La fenêtre principale tourne avec `backgroundThrottling: false` (voir
 * `src/main/index.ts`), donc cet intervalle continue de tourner même
 * fenêtre masquée dans le tray — c'est précisément le cas d'usage.
 */
export function useEngagementReminders(
  engagements: ReminderEngagement[],
  entryCountByEngagement: Record<string, number>,
  notificationsEnabled: boolean,
  leadMinutes: number
): void {
  const firedRef = useRef<Set<string>>(new Set());
  // Les données changent à chaque rafraîchissement des engagements. Les
  // lire dans une ref plutôt qu'en dépendance de l'effet évite de
  // reconstruire l'intervalle à chaque re-render, ce qui repousserait
  // indéfiniment la prochaine vérification.
  const dataRef = useRef({ engagements, entryCountByEngagement, leadMinutes });
  dataRef.current = { engagements, entryCountByEngagement, leadMinutes };

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();

    const interval = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      const { engagements: list, entryCountByEngagement: counts, leadMinutes: lead } = dataRef.current;
      for (const reminder of dueReminders(list, counts, new Date(), lead, firedRef.current)) {
        // Marqué comme vu qu'il soit affiché ou périmé : sinon un rappel
        // manqué reviendrait à chaque vérification jusqu'à la fin des
        // temps.
        firedRef.current.add(reminder.key);
        if (reminder.stale) continue;
        const notification = new Notification('Saint Daily', { body: reminderMessage(reminder, lead) });
        notification.onclick = () => window.api?.focusWindow?.();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [notificationsEnabled]);
}
```

- [ ] **Step 5: Monter le hook dans `AppShell.tsx`**

Trois modifications dans `src/renderer/src/components/AppShell.tsx`.

1. Ajouter les imports, à côté des imports de hooks existants :

```tsx
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { useEngagementReminders } from '../hooks/useEngagementReminders';
```

2. Juste après la ligne `const hasSyncedRecurrenceRef = useRef(false);`, ajouter :

```tsx
  const { settings } = useSettings();
  // Seuls les engagements planifiés peuvent déclencher un rappel : on ne
  // demande les entrées que pour ceux-là, pas pour tout le catalogue.
  const scheduledEngagements = useMemo(
    () => engagements.filter((e) => e.scheduledAt && !e.archivedAt),
    [engagements]
  );
  const { entriesBySkill } = useAllPracticeEntries(scheduledEngagements.map((e) => e.id));
  const entryCountByEngagement = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [engagementId, entries] of Object.entries(entriesBySkill)) {
      counts[engagementId] = entries.length;
    }
    return counts;
  }, [entriesBySkill]);

  useEngagementReminders(
    scheduledEngagements,
    entryCountByEngagement,
    settings?.notificationsEnabled ?? false,
    settings?.reminderLeadMinutes ?? 10
  );
```

3. Compléter l'import de React en tête de fichier pour inclure `useMemo` :

```tsx
import { useEffect, useMemo, useRef } from 'react';
```

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, tous les tests toujours verts.

- [ ] **Step 7: Commit**

```bash
git add src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts src/renderer/src/hooks/useEngagementReminders.ts src/renderer/src/components/AppShell.tsx
git commit -m "feat: notify before and at the start of a scheduled task"
```

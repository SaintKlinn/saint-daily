# Task Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-level priority to tasks — settable at creation, editable from the calendar popover, shown as a colored indicator on Accueil and the calendar.

**Architecture:** An additive migration adds a `priority` column to `engagement` (same convention as the existing `generic_level`). A new shared module (`lib/priority.ts`) centralizes the 4 levels' labels and colors so the 4 consuming files (creation form, popover, Accueil, calendar) never duplicate that mapping. `useEngagements()`'s `createEngagement`/`updateEngagement` are extended to carry the field; the UI reuses the existing button-group preset pattern already shipped for duration presets.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `@supabase/supabase-js`, PostgreSQL (Supabase-hosted)

**Spec:** [docs/superpowers/specs/2026-09-10-tache-priorite-design.md](../specs/2026-09-10-tache-priorite-design.md)

## Global Constraints

- **Priority applies to tasks only in the UI** — the column exists on all of `engagement` (skills included) to keep one table, but no skill screen ever shows or sets it.
- **4 levels**: `aucune` (default) / `basse` / `moyenne` / `elevee`.
- **`aucune` = zero visual change** — no dot on Accueil, no left-border accent on the calendar, identical to current behavior.
- **`elevee` reuses the existing `danger` red** (`#F87171`) — same semantic weight as this app's existing error color.
- **`moyenne`/`basse` get two new dedicated colors** — never reuse `accent.bright` (gold), which already means "active/primary" everywhere else in this app.
- **No sort-order change** — Accueil's "Tâches à faire" and the calendar both stay sorted by time; priority is a visual cue only.
- **Priority is editable after creation** via a selector in the calendar's `TaskPopover`, writing immediately on click (no separate save step) — no other field becomes editable in this plan.
- **No comments explaining WHAT code does, only non-obvious WHY.**
- **French UI copy.**

---

## Task 1: Migration, shared types, colors, and the priority hook plumbing

**Files:**
- Create: `supabase/migrations/0006_task_priority.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/theme/colors.ts`
- Create: `src/renderer/src/lib/priority.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `Priority` type (`'aucune' | 'basse' | 'moyenne' | 'elevee'`) exported from `lib/types.ts`; `Engagement.priority: Priority`; `PRIORITY_LEVELS: Priority[]`, `PRIORITY_LABELS: Record<Priority, string>`, `PRIORITY_COLORS: Record<Priority, string | null>` exported from `lib/priority.ts`; `createEngagement`'s input gains an optional `priority?: Priority`; `updateEngagement`'s patch type accepts `priority`. Every later task relies on these exact names.

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0006_task_priority.sql`:

```sql
-- Un seul niveau parmi quatre, même convention que generic_level déjà
-- en place sur cette table. S'applique à tout `engagement` (skills
-- compris) pour rester une seule table, mais ne s'affiche que sur les
-- tâches côté UI. Aucune donnée existante à réécrire : toute ligne déjà
-- présente prend 'aucune' via le défaut de colonne.
begin;

alter table saint_daily.engagement add column priority text not null default 'aucune'
  check (priority in ('aucune', 'basse', 'moyenne', 'elevee'));

commit;
```

- [ ] **Step 2: Update `lib/types.ts`**

Read `src/renderer/src/lib/types.ts`. Find:

```ts
export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';

export interface Engagement {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  createdAt: string;
}
```

Replace with:

```ts
export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export type Priority = 'aucune' | 'basse' | 'moyenne' | 'elevee';

export interface Engagement {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  priority: Priority;
  createdAt: string;
}
```

- [ ] **Step 3: Update `theme/colors.ts`**

Read `src/renderer/src/theme/colors.ts`. Find:

```ts
  danger: '#F87171',
} as const;
```

Replace with:

```ts
  danger: '#F87171',
  // `elevee` reprend la valeur de `danger` telle quelle (même charge
  // sémantique : urgence) — dupliquée ici plutôt que référencée, un
  // objet littéral ne peut pas s'auto-référencer pendant sa propre
  // évaluation. `moyenne`/`basse` évitent volontairement accent.bright,
  // qui signale déjà "actif/primaire" ailleurs dans l'app (nav, boutons).
  priority: {
    elevee: '#F87171',
    moyenne: '#D2894A',
    basse: '#6FA8A3',
  },
} as const;
```

- [ ] **Step 4: Create `lib/priority.ts`**

```ts
import { colors } from '../theme/colors';
import type { Priority } from './types';

export const PRIORITY_LEVELS: Priority[] = ['aucune', 'basse', 'moyenne', 'elevee'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  aucune: 'Aucune',
  basse: 'Basse',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
};

// `aucune` n'a pas de couleur : ça laisse l'UI dans son état actuel
// (pas de pastille, pas de liseré) plutôt que d'introduire une couleur
// "neutre" qui ajouterait un élément visuel qui n'existe pas aujourd'hui.
export const PRIORITY_COLORS: Record<Priority, string | null> = {
  aucune: null,
  basse: colors.priority.basse,
  moyenne: colors.priority.moyenne,
  elevee: colors.priority.elevee,
};
```

- [ ] **Step 5: Update `hooks/useEngagements.ts`**

Read `src/renderer/src/hooks/useEngagements.ts`. Find:

```ts
import type { Engagement, GenericLevel } from '../lib/types';

interface EngagementRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tags: string[];
  generic_level: GenericLevel;
  archived_at: string | null;
  scheduled_at: string | null;
  scheduled_ends_at: string | null;
  created_at: string;
}

function fromRow(row: EngagementRow): Engagement {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    genericLevel: row.generic_level,
    archivedAt: row.archived_at,
    scheduledAt: row.scheduled_at,
    scheduledEndsAt: row.scheduled_ends_at,
    createdAt: row.created_at,
  };
}
```

Replace with:

```ts
import type { Engagement, GenericLevel, Priority } from '../lib/types';

interface EngagementRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tags: string[];
  generic_level: GenericLevel;
  archived_at: string | null;
  scheduled_at: string | null;
  scheduled_ends_at: string | null;
  priority: Priority;
  created_at: string;
}

function fromRow(row: EngagementRow): Engagement {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    genericLevel: row.generic_level,
    archivedAt: row.archived_at,
    scheduledAt: row.scheduled_at,
    scheduledEndsAt: row.scheduled_ends_at,
    priority: row.priority,
    createdAt: row.created_at,
  };
}
```

Find:

```ts
  async function createEngagement(input: {
    name: string;
    tags: string[];
    genericLevel?: GenericLevel;
    notes?: string | null;
    scheduledAt?: string | null;
    scheduledEndsAt?: string | null;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement')
      .insert({
        user_id: session.user.id,
        name: input.name,
        tags: input.tags,
        ...(input.genericLevel ? { generic_level: input.genericLevel } : {}),
        notes: input.notes ?? null,
        scheduled_at: input.scheduledAt ?? null,
        scheduled_ends_at: input.scheduledEndsAt ?? null,
      });
```

Replace with:

```ts
  async function createEngagement(input: {
    name: string;
    tags: string[];
    genericLevel?: GenericLevel;
    notes?: string | null;
    scheduledAt?: string | null;
    scheduledEndsAt?: string | null;
    priority?: Priority;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement')
      .insert({
        user_id: session.user.id,
        name: input.name,
        tags: input.tags,
        ...(input.genericLevel ? { generic_level: input.genericLevel } : {}),
        notes: input.notes ?? null,
        scheduled_at: input.scheduledAt ?? null,
        scheduled_ends_at: input.scheduledEndsAt ?? null,
        ...(input.priority ? { priority: input.priority } : {}),
      });
```

Find:

```ts
  async function updateEngagement(
    id: string,
    patch: Partial<Pick<Engagement, 'name' | 'notes' | 'tags' | 'genericLevel'>>
  ) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
      })
      .eq('id', id);
```

Replace with:

```ts
  async function updateEngagement(
    id: string,
    patch: Partial<Pick<Engagement, 'name' | 'notes' | 'tags' | 'genericLevel' | 'priority'>>
  ) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      })
      .eq('id', id);
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. `fromRow` (the only place in the codebase that constructs a full `Engagement` object) is updated in Step 5 to include `priority`, and nothing else constructs one from scratch — every other consumer only reads fields off an already-built `Engagement` or patches it through `Partial<Pick<...>>`, neither of which requires touching a new required field. If it fails, something else in the codebase builds an `Engagement`-shaped object this task didn't account for — find it and add `priority` there too.

- [ ] **Step 7: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0006_task_priority.sql src/renderer/src/lib/types.ts src/renderer/src/theme/colors.ts src/renderer/src/lib/priority.ts src/renderer/src/hooks/useEngagements.ts
git commit -m "feat: add task priority to the data layer"
```

This does **not** apply the migration to the live database — that's Task 5.

---

## Task 2: Priority selector on task creation

**Files:**
- Modify: `src/renderer/src/screens/NouvelleTache.tsx`

**Interfaces:**
- Consumes: `PRIORITY_LEVELS`, `PRIORITY_LABELS` (Task 1), `createEngagement`'s `priority` param (Task 1).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Read the current file**

Read `src/renderer/src/screens/NouvelleTache.tsx` to confirm it still matches what's quoted below before editing.

- [ ] **Step 2: Add the import and state**

Find:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';
```

Replace with:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { Priority } from '../lib/types';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';
```

Find:

```tsx
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
```

Replace with:

```tsx
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('aucune');
  const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 3: Pass priority to `createEngagement`**

Find:

```tsx
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: startDate.toISOString(),
      scheduledEndsAt,
    });
```

Replace with:

```tsx
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: startDate.toISOString(),
      scheduledEndsAt,
      priority,
    });
```

- [ ] **Step 4: Add the priority selector JSX**

Find:

```tsx
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Durée</p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDurationMinutes(preset)}
                aria-pressed={durationMinutes === preset}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${durationMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>
        {error && (
```

Replace with:

```tsx
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Durée</p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDurationMinutes(preset)}
                aria-pressed={durationMinutes === preset}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${durationMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Priorité</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRIORITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(level)}
                aria-pressed={priority === level}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${priority === level ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {PRIORITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
        {error && (
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 7: Manual dev-launch sanity check**

Run `npm run dev` (start it directly via Bash in the worktree, then point the Browser preview tool's `preview_start` at the exact `http://localhost:<port>` it binds to — never a `name` parameter, which is known to launch the server rooted at the wrong checkout when working in a git worktree). Navigate to `/#/taches/nouvelle`. Confirm: the priority selector renders below the duration selector, defaults to "Aucune" highlighted, clicking another level highlights it instead. The live database doesn't have the migration applied yet at this point in the plan (Task 5 applies it), so actually submitting the form is expected to fail with a "column not found" error — that's normal here, not a bug; don't try to work around it.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/screens/NouvelleTache.tsx
git commit -m "feat: add a priority selector to task creation"
```

---

## Task 3: Priority editing from the calendar popover, and the calendar's visual indicator

**Files:**
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `PRIORITY_LEVELS`, `PRIORITY_LABELS`, `PRIORITY_COLORS` (Task 1), `updateEngagement`'s `priority` patch field (Task 1).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Read both current files**

Read `src/renderer/src/components/TaskPopover.tsx` and `src/renderer/src/screens/Calendrier.tsx` in full to confirm they still match what's quoted below before editing.

- [ ] **Step 2: Add the priority selector to `TaskPopover.tsx`**

Find:

```tsx
import RayCorner from './RayCorner';
import Button from './Button';
import type { Engagement } from '../lib/types';

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${day} · ${time(start)} – ${time(end)}`;
}

export default function TaskPopover({
  task,
  onClose,
  onComplete,
  completing,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60" onClick={onClose}>
      <div
        className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <RayCorner variant={1} />
        <div className="relative">
          <p className="font-serif text-xl text-champagne">{task.name}</p>
          {task.tags.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <p className="relative font-data text-[13px] text-muted">
          {formatSlot(task.scheduledAt as string, task.scheduledEndsAt as string)}
        </p>
        <div className="relative mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" variant="primary" onClick={onComplete} disabled={completing}>
            {completing ? 'Marquage…' : 'Marquer comme faite'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
import RayCorner from './RayCorner';
import Button from './Button';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { Engagement, Priority } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${day} · ${time(start)} – ${time(end)}`;
}

export default function TaskPopover({
  task,
  onClose,
  onComplete,
  completing,
  onPriorityChange,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60" onClick={onClose}>
      <div
        className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <RayCorner variant={1} />
        <div className="relative">
          <p className="font-serif text-xl text-champagne">{task.name}</p>
          {task.tags.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <p className="relative font-data text-[13px] text-muted">
          {formatSlot(task.scheduledAt as string, task.scheduledEndsAt as string)}
        </p>
        <div className="relative flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Priorité</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRIORITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onPriorityChange(level)}
                aria-pressed={task.priority === level}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${task.priority === level ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {PRIORITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
        <div className="relative mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" variant="primary" onClick={onComplete} disabled={completing}>
            {completing ? 'Marquage…' : 'Marquer comme faite'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire priority editing and the visual indicator into `Calendrier.tsx`**

Find:

```tsx
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import Button from '../components/Button';
import TaskPopover from '../components/TaskPopover';
import { ChevronLeftIcon } from '../components/icons';
import type { Engagement } from '../lib/types';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import { PRIORITY_COLORS } from '../lib/priority';
import Button from '../components/Button';
import TaskPopover from '../components/TaskPopover';
import { ChevronLeftIcon } from '../components/icons';
import type { Engagement, Priority } from '../lib/types';
```

Find:

```tsx
  const { engagements, error: engagementsError, setArchived } = useEngagements();
```

Replace with:

```tsx
  const { engagements, error: engagementsError, setArchived, updateEngagement } = useEngagements();
```

Find:

```tsx
  async function handleCompleteTask(taskId: string) {
```

Replace with:

```tsx
  async function handleChangePriority(taskId: string, priority: Priority) {
    const { error } = await updateEngagement(taskId, { priority });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    // `popoverTask` est un instantané local, pas dérivé de `engagements` —
    // sans cette mise à jour, le sélecteur du popover resterait affiché
    // sur l'ancienne priorité jusqu'à sa fermeture/réouverture, alors que
    // l'écriture a bien réussi.
    setPopoverTask((current) => (current && current.id === taskId ? { ...current, priority } : current));
  }

  async function handleCompleteTask(taskId: string) {
```

Find:

```tsx
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setPopoverTask(task)}
                    className="absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-1.5 py-0.5 text-left"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-sans text-[11px] font-semibold text-champagne">{task.name}</p>
                  </button>
                );
              })}
```

Replace with:

```tsx
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                const priorityColor = PRIORITY_COLORS[task.priority];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setPopoverTask(task)}
                    className={`absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-1.5 py-0.5 text-left ${priorityColor ? 'border-l-[3px]' : ''}`}
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      ...(priorityColor ? { borderLeftColor: priorityColor } : {}),
                    }}
                  >
                    <p className="truncate font-sans text-[11px] font-semibold text-champagne">{task.name}</p>
                  </button>
                );
              })}
```

Find:

```tsx
      {popoverTask && (
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
        />
      )}
```

Replace with:

```tsx
      {popoverTask && (
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
          onPriorityChange={(priority) => handleChangePriority(popoverTask.id, priority)}
        />
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 6: Manual dev-launch sanity check**

Run `npm run dev` in the worktree (Bash directly, then `preview_start` with a `url`, never `name`). Since the live database doesn't have this plan's migration applied yet, you cannot create a real task with a non-default priority through the running app at this point — verify what you can through code reading instead: confirm `TaskPopover`'s new selector renders (you can temporarily construct a fake task object via the browser console/an in-memory fetch shim if you want to see the popover live, the way an implementer in an earlier sub-project already did for a similar situation — clean up any such shim before finishing, it must never be committed). Confirm the calendar block's conditional `border-l-[3px]`/`borderLeftColor` logic reads correctly from the code: `PRIORITY_COLORS.aucune` is `null`, so a default-priority task's block should be visually identical to today.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: make task priority editable from the calendar popover, with a visual indicator"
```

---

## Task 4: Priority dot on Accueil

**Files:**
- Modify: `src/renderer/src/screens/Accueil.tsx`

**Interfaces:**
- Consumes: `PRIORITY_COLORS` (Task 1).
- Produces: nothing further downstream — last code task before the manual migration step.

- [ ] **Step 1: Read the current file**

Read `src/renderer/src/screens/Accueil.tsx` to confirm it still matches what's quoted below before editing.

- [ ] **Step 2: Add the import**

Find:

```tsx
import { CheckIcon, PlusIcon } from '../components/icons';
import { colors } from '../theme/colors';
```

Replace with:

```tsx
import { CheckIcon, PlusIcon } from '../components/icons';
import { PRIORITY_COLORS } from '../lib/priority';
import { colors } from '../theme/colors';
```

- [ ] **Step 3: Add the priority dot next to the task name**

Find:

```tsx
                <div className="flex-1">
                  <p className="font-serif text-lg text-champagne">{task.name}</p>
                  {task.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </div>
```

Replace with:

```tsx
                <div className="flex-1">
                  <p className="flex items-center gap-2 font-serif text-lg text-champagne">
                    {PRIORITY_COLORS[task.priority] && (
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: PRIORITY_COLORS[task.priority] as string }}
                      />
                    )}
                    {task.name}
                  </p>
                  {task.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </div>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 6: Manual dev-launch sanity check**

Same environment caveat as Tasks 2-3: the live database doesn't have the migration yet, so this can only be verified by code reading at this point (confirm the dot only renders when `PRIORITY_COLORS[task.priority]` is truthy, i.e. never for `'aucune'`) — full live verification happens in Task 5, after the migration is applied.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/screens/Accueil.tsx
git commit -m "feat: show a priority dot on tasks in Tâches à faire"
```

---

## Task 5: Apply the migration and verify end-to-end

**Files:** none (no code changes — this task applies what Task 1 already produced, against the real, live Supabase project).

**Interfaces:**
- Consumes: `supabase/migrations/0006_task_priority.sql` (Task 1) and every code change from Tasks 2-4.
- Produces: nothing further downstream — this is the last task in the plan.

**⚠️ This task requires the real user, not just the implementer.** Applying SQL to the live database is an action only the user can take — the implementer must stop and ask for explicit confirmation before Step 1, the same way sub-projects 1 and 2's migrations were handled. Do not simulate, skip, or assume this happened.

- [ ] **Step 1: Ask the user to apply the migration to the live Supabase project**

Give the user this exact instruction: open the Supabase SQL editor for the project, and run **only** the contents of `supabase/migrations/0006_task_priority.sql` — not the whole `migrations/` folder — in one execution (it's wrapped in `begin;`/`commit;`). Wait for the user to confirm the migration succeeded before continuing.

- [ ] **Step 2: Verify against the live database**

Launch the app (`npm run dev`, worktree-correct method: Bash directly + `preview_start` with a `url`) and, using the existing `/dev-login` mechanism, confirm:

- Creating a task via `/taches/nouvelle` with each of the 4 priority levels succeeds (no "column not found" error).
- A task created with "Élevée", "Moyenne", or "Basse" shows the correct colored dot on Accueil's "Tâches à faire", and the correct colored left-border accent on the matching calendar block. A task created with "Aucune" shows neither — visually identical to a pre-this-plan task.
- Opening the popover on an existing task and changing its priority updates the selector's highlighted state immediately (no need to close/reopen the popover), and the change is reflected on Accueil/the calendar block after the popover closes.
- Reload the page and confirm the changed priority persisted (a real database write, not just local state).
- Nothing else on Accueil, `/skills`, `/taches/nouvelle`, or the calendar regressed.

If any of these fail, the fix belongs in whichever earlier task produced the mismatch — do not patch around it with a new, undocumented change in this task.

- [ ] **Step 3: Report the result**

No commit in this task (nothing new to commit — Tasks 1-4 already captured every file change). State clearly whether all checks in Step 2 passed. This is the final task of the plan.

---

## Self-Review

**Spec coverage:** Colonne `priority` + contrainte à 4 valeurs → Task 1. Sélecteur à la création → Task 2. Sélecteur modifiable depuis le popover, écriture immédiate → Task 3. Pastille sur l'Accueil, liseré sur le calendrier, "Aucune" = inchangé partout → Task 3 (calendrier) + Task 4 (Accueil). Couleurs (élevée = danger, moyenne/basse nouvelles, jamais accent.bright) → Task 1. Tri inchangé → aucune tâche n'y touche (confirmé : aucun changement aux `.sort()` existants dans Accueil.tsx ou Calendrier.tsx). Étape manuelle Supabase → Task 5. Hors scope (les 4 autres pièces du sous-projet 3, édition au-delà de la priorité, priorité sur les skills) → aucune tâche n'y touche. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate X" steps — every step shows real code. Task 3's Step 3 includes an explicit WHY comment for the `popoverTask` local-state sync (a real staleness bug that would otherwise ship: `updateEngagement` refreshes `engagements`, but `popoverTask` is a separate snapshot that wouldn't follow along without the explicit `setPopoverTask` call) — caught and fixed during planning, not left as a gap.

**Type consistency:** `Priority`/`Engagement.priority` (Task 1) match their use in `createEngagement`/`updateEngagement` (Task 1), `NouvelleTache.tsx` (Task 2), `TaskPopover.tsx`/`Calendrier.tsx` (Task 3), and `Accueil.tsx` (Task 4) exactly. `PRIORITY_LEVELS`/`PRIORITY_LABELS`/`PRIORITY_COLORS` (Task 1) are imported with the exact same names everywhere they're consumed. `TaskPopover`'s new `onPriorityChange: (priority: Priority) => void` prop (Task 3) matches its call site in `Calendrier.tsx` exactly (`onPriorityChange={(priority) => handleChangePriority(popoverTask.id, priority)}`). No drift found.

# Sous-tâches et Regroupement par Projet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent additions to close out sub-project 3: a lightweight checklist on tasks (reusing the existing skill-milestones mechanism), and a way to group tasks/skills under an explicit "project" — itself just an engagement that is never scheduled or practiced.

**Architecture:** Sous-tâches need zero new data-layer work — `EngagementMilestone`/`useMilestones` already operate on any `engagementId`, so this is purely a UI addition (a new `MilestoneChecklist` component, reused inside `TaskPopover`). Regroupement par projet needs one small additive migration (`is_project`, `project_id`) plus new screens mirroring the existing skill screens' structure, and a mechanical fix everywhere the app currently assumes "no `scheduledAt` = skill" (a project shares that same signal and must be explicitly excluded).

**Tech Stack:** React 19 + TypeScript, Tailwind — no new dependencies, no new pure logic (no Vitest additions expected in this plan).

**Spec:** `docs/superpowers/specs/2026-09-11-taches-avancees-design.md` (section 3, "Sous-tâches et regroupement par projet")

## Global Constraints

- Sous-tâches reuse `useMilestones`/`EngagementMilestone` exactly as they exist today — no new columns, no new hook. **Correction to the spec:** the spec's wording ("même UI d'ajout/cochage/**suppression**") overstates what `useMilestones` actually supports — reading the current hook shows only `addMilestone` and `toggleMilestone`, no deletion of any kind, for skills either. This plan reuses exactly what exists: add + toggle, no delete.
- A project is an `engagement` with `isProject: true`. It is never scheduled (`scheduledAt` stays `null`) and never practiced (no `practice_entry` rows are ever created for it) — nothing in this plan writes practice data for a project.
- Single level only: a project's own `projectId` is never set (not enforced at the SQL level, enforced by simply never offering the project selector on the project-creation screen itself).
- Every existing "is this engagement a skill" check in the codebase is currently `!e.scheduledAt` alone. A project shares that same signal (`scheduledAt: null`) and must be excluded everywhere that check appears, or it will silently show up as a skill. Grepped and confirmed exactly 5 call sites (see Task 2).
- This project's comment convention: no comments explaining WHAT code does, only non-obvious WHY.

---

### Task 1: Data layer — migration, types, `useEngagements` extensions

**Files:**
- Create: `supabase/migrations/0008_project_grouping.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`

**Interfaces:**
- Produces: `Engagement` gains `isProject: boolean` and `projectId: string | null`.
- Produces: `createEngagement`, `createEngagements`, and `updateEngagement` all gain optional `isProject?: boolean` and `projectId?: string | null`, using the same `!== undefined` conditional-spread pattern already used for `scheduledAt`/`recurrenceSeriesId` (not the truthy-check pattern used for `priority`/`recurrenceType` — a boolean's `false` must not be silently dropped).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_project_grouping.sql`:

```sql
begin;

alter table saint_daily.engagement
  add column is_project boolean not null default false,
  add column project_id uuid references saint_daily.engagement(id);

commit;
```

- [ ] **Step 2: Extend `types.ts`**

`src/renderer/src/lib/types.ts` currently reads:

```ts
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
  recurrenceSeriesId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
  createdAt: string;
}
```

Replace with:

```ts
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
  recurrenceSeriesId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
  isProject: boolean;
  projectId: string | null;
  createdAt: string;
}
```

- [ ] **Step 3: Extend `EngagementRow` and `fromRow`**

`src/renderer/src/hooks/useEngagements.ts` lines 7-43 currently read:

```ts
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
  recurrence_series_id: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
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
    recurrenceSeriesId: row.recurrence_series_id,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    recurrenceWeekdays: row.recurrence_weekdays,
    createdAt: row.created_at,
  };
}
```

Replace with:

```ts
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
  recurrence_series_id: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  is_project: boolean;
  project_id: string | null;
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
    recurrenceSeriesId: row.recurrence_series_id,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    recurrenceWeekdays: row.recurrence_weekdays,
    isProject: row.is_project,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 4: Extend `createEngagement`, `createEngagements`, and `updateEngagement`**

In `createEngagement`'s input type (`src/renderer/src/hooks/useEngagements.ts`), currently:

```ts
  async function createEngagement(input: {
    name: string;
    tags: string[];
    genericLevel?: GenericLevel;
    notes?: string | null;
    scheduledAt?: string | null;
    scheduledEndsAt?: string | null;
    priority?: Priority;
    recurrenceSeriesId?: string | null;
    recurrenceType?: RecurrenceType;
    recurrenceInterval?: number | null;
    recurrenceWeekdays?: number[] | null;
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
        ...(input.recurrenceSeriesId !== undefined ? { recurrence_series_id: input.recurrenceSeriesId } : {}),
        ...(input.recurrenceType ? { recurrence_type: input.recurrenceType } : {}),
        ...(input.recurrenceInterval !== undefined ? { recurrence_interval: input.recurrenceInterval } : {}),
        ...(input.recurrenceWeekdays !== undefined ? { recurrence_weekdays: input.recurrenceWeekdays } : {}),
      });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }
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
    recurrenceSeriesId?: string | null;
    recurrenceType?: RecurrenceType;
    recurrenceInterval?: number | null;
    recurrenceWeekdays?: number[] | null;
    isProject?: boolean;
    projectId?: string | null;
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
        ...(input.recurrenceSeriesId !== undefined ? { recurrence_series_id: input.recurrenceSeriesId } : {}),
        ...(input.recurrenceType ? { recurrence_type: input.recurrenceType } : {}),
        ...(input.recurrenceInterval !== undefined ? { recurrence_interval: input.recurrenceInterval } : {}),
        ...(input.recurrenceWeekdays !== undefined ? { recurrence_weekdays: input.recurrenceWeekdays } : {}),
        ...(input.isProject !== undefined ? { is_project: input.isProject } : {}),
        ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
      });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }
```

Then, `createEngagements`'s input type and row mapping currently read:

```ts
  async function createEngagements(
    inputs: Array<{
      name: string;
      tags: string[];
      genericLevel?: GenericLevel;
      notes?: string | null;
      scheduledAt?: string | null;
      scheduledEndsAt?: string | null;
      priority?: Priority;
      recurrenceSeriesId?: string | null;
      recurrenceType?: RecurrenceType;
      recurrenceInterval?: number | null;
      recurrenceWeekdays?: number[] | null;
    }>
  ) {
    if (!session) return { error: 'Non connecté' };
    if (inputs.length === 0) return { error: null };
    const rows = inputs.map((input) => ({
      user_id: session.user.id,
      name: input.name,
      tags: input.tags,
      ...(input.genericLevel ? { generic_level: input.genericLevel } : {}),
      notes: input.notes ?? null,
      scheduled_at: input.scheduledAt ?? null,
      scheduled_ends_at: input.scheduledEndsAt ?? null,
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.recurrenceSeriesId !== undefined ? { recurrence_series_id: input.recurrenceSeriesId } : {}),
      ...(input.recurrenceType ? { recurrence_type: input.recurrenceType } : {}),
      ...(input.recurrenceInterval !== undefined ? { recurrence_interval: input.recurrenceInterval } : {}),
      ...(input.recurrenceWeekdays !== undefined ? { recurrence_weekdays: input.recurrenceWeekdays } : {}),
    }));
    const { error: insertError } = await getSupabaseClient().from('engagement').insert(rows);
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }
```

Replace with:

```ts
  async function createEngagements(
    inputs: Array<{
      name: string;
      tags: string[];
      genericLevel?: GenericLevel;
      notes?: string | null;
      scheduledAt?: string | null;
      scheduledEndsAt?: string | null;
      priority?: Priority;
      recurrenceSeriesId?: string | null;
      recurrenceType?: RecurrenceType;
      recurrenceInterval?: number | null;
      recurrenceWeekdays?: number[] | null;
      isProject?: boolean;
      projectId?: string | null;
    }>
  ) {
    if (!session) return { error: 'Non connecté' };
    if (inputs.length === 0) return { error: null };
    const rows = inputs.map((input) => ({
      user_id: session.user.id,
      name: input.name,
      tags: input.tags,
      ...(input.genericLevel ? { generic_level: input.genericLevel } : {}),
      notes: input.notes ?? null,
      scheduled_at: input.scheduledAt ?? null,
      scheduled_ends_at: input.scheduledEndsAt ?? null,
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.recurrenceSeriesId !== undefined ? { recurrence_series_id: input.recurrenceSeriesId } : {}),
      ...(input.recurrenceType ? { recurrence_type: input.recurrenceType } : {}),
      ...(input.recurrenceInterval !== undefined ? { recurrence_interval: input.recurrenceInterval } : {}),
      ...(input.recurrenceWeekdays !== undefined ? { recurrence_weekdays: input.recurrenceWeekdays } : {}),
      ...(input.isProject !== undefined ? { is_project: input.isProject } : {}),
      ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
    }));
    const { error: insertError } = await getSupabaseClient().from('engagement').insert(rows);
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }
```

Then, `updateEngagement`'s `Pick<>` and update payload currently read:

```ts
  async function updateEngagement(
    id: string,
    patch: Partial<
      Pick<
        Engagement,
        | 'name'
        | 'notes'
        | 'tags'
        | 'genericLevel'
        | 'priority'
        | 'scheduledAt'
        | 'scheduledEndsAt'
        | 'recurrenceSeriesId'
        | 'recurrenceType'
        | 'recurrenceInterval'
        | 'recurrenceWeekdays'
      >
    >
  ) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduled_at: patch.scheduledAt } : {}),
        ...(patch.scheduledEndsAt !== undefined ? { scheduled_ends_at: patch.scheduledEndsAt } : {}),
        ...(patch.recurrenceSeriesId !== undefined ? { recurrence_series_id: patch.recurrenceSeriesId } : {}),
        ...(patch.recurrenceType !== undefined ? { recurrence_type: patch.recurrenceType } : {}),
        ...(patch.recurrenceInterval !== undefined ? { recurrence_interval: patch.recurrenceInterval } : {}),
        ...(patch.recurrenceWeekdays !== undefined ? { recurrence_weekdays: patch.recurrenceWeekdays } : {}),
      })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }
```

Replace with:

```ts
  async function updateEngagement(
    id: string,
    patch: Partial<
      Pick<
        Engagement,
        | 'name'
        | 'notes'
        | 'tags'
        | 'genericLevel'
        | 'priority'
        | 'scheduledAt'
        | 'scheduledEndsAt'
        | 'recurrenceSeriesId'
        | 'recurrenceType'
        | 'recurrenceInterval'
        | 'recurrenceWeekdays'
        | 'projectId'
      >
    >
  ) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduled_at: patch.scheduledAt } : {}),
        ...(patch.scheduledEndsAt !== undefined ? { scheduled_ends_at: patch.scheduledEndsAt } : {}),
        ...(patch.recurrenceSeriesId !== undefined ? { recurrence_series_id: patch.recurrenceSeriesId } : {}),
        ...(patch.recurrenceType !== undefined ? { recurrence_type: patch.recurrenceType } : {}),
        ...(patch.recurrenceInterval !== undefined ? { recurrence_interval: patch.recurrenceInterval } : {}),
        ...(patch.recurrenceWeekdays !== undefined ? { recurrence_weekdays: patch.recurrenceWeekdays } : {}),
        ...(patch.projectId !== undefined ? { project_id: patch.projectId } : {}),
      })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }
```

**Note:** `updateEngagement`'s `Pick<>` intentionally does NOT include `isProject` — nothing in this plan ever changes an existing engagement's project/skill/task identity after creation (only which project it belongs to, via `projectId`). Only `createEngagement`/`createEngagements` can set `isProject`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all existing tests pass unchanged (this task adds no new pure logic).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_project_grouping.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts
git commit -m "feat: add project-grouping fields to the engagement data layer"
```

---

### Task 2: Exclude projects from every existing "is this a skill" filter

**Files:**
- Modify: `src/renderer/src/screens/Accueil.tsx:26,29`
- Modify: `src/renderer/src/screens/DetailSkill.tsx:34`
- Modify: `src/renderer/src/screens/ListeSkills.tsx:24`
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx:18`
- Modify: `src/renderer/src/screens/Pomodoro.tsx:23`

**Interfaces:**
- Consumes: `Engagement.isProject` (Task 1).
- Produces: nothing consumed by later tasks — this task is self-contained.

Every one of these lines currently reads `engagements.filter((e) => !e.scheduledAt)` (or `activeEngagements.filter((e) => !e.scheduledAt)`) — grepped repo-wide (`grep -rn "!e.scheduledAt" src/renderer/src` or equivalent) to confirm this is the complete list; no other file matches this pattern. A project has `scheduledAt: null` just like a skill, so without this fix a project would appear as a skill in every one of these 5 screens.

- [ ] **Step 1: Fix `Accueil.tsx`**

`src/renderer/src/screens/Accueil.tsx` lines 26 and 29 currently read:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

and

```tsx
  const activeSkills = useMemo(() => activeEngagements.filter((e) => !e.scheduledAt), [activeEngagements]);
```

Replace with:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
```

and

```tsx
  const activeSkills = useMemo(() => activeEngagements.filter((e) => !e.scheduledAt && !e.isProject), [activeEngagements]);
```

- [ ] **Step 2: Fix `DetailSkill.tsx`**

`src/renderer/src/screens/DetailSkill.tsx` line 34 currently reads:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

Replace with:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
```

- [ ] **Step 3: Fix `ListeSkills.tsx`**

`src/renderer/src/screens/ListeSkills.tsx` line 24 currently reads:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

Replace with:

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
```

- [ ] **Step 4: Fix `NouvelleEntree.tsx`**

`src/renderer/src/screens/NouvelleEntree.tsx` line 18 currently reads:

```tsx
  const skills = engagements.filter((e) => !e.scheduledAt);
```

Replace with:

```tsx
  const skills = engagements.filter((e) => !e.scheduledAt && !e.isProject);
```

- [ ] **Step 5: Fix `Pomodoro.tsx`**

`src/renderer/src/screens/Pomodoro.tsx` line 23 currently reads:

```tsx
  const skills = engagements.filter((e) => !e.scheduledAt);
```

Replace with:

```tsx
  const skills = engagements.filter((e) => !e.scheduledAt && !e.isProject);
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 8: Manual verification**

This can only be fully verified once Task 4 (project creation screen) exists — note that dependency, and re-check this task's effect after Task 4 lands: create a project, then confirm it does NOT appear in Accueil's "Rappels dus"/stats, ListeSkills, DetailSkill's skill lookup (i.e. `/skills/<project-id>` shows "Introuvable", not the project), NouvelleEntree's skill picker, or Pomodoro's skill picker.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/DetailSkill.tsx src/renderer/src/screens/ListeSkills.tsx src/renderer/src/screens/NouvelleEntree.tsx src/renderer/src/screens/Pomodoro.tsx
git commit -m "fix: exclude projects from every existing skill filter"
```

---

### Task 3: Sous-tâches — checklist on tasks via a shared `MilestoneChecklist` component

**Files:**
- Create: `src/renderer/src/components/MilestoneChecklist.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`

**Interfaces:**
- Consumes: `useMilestones(engagementId: string | null)` from `../hooks/useMilestones` (already exists, unchanged) — called directly inside `TaskPopover`, not passed down from `Calendrier.tsx`, since the popover already fully owns the one task it displays.
- Consumes: `EngagementMilestone` from `../lib/types` (already exists).
- Produces: `MilestoneChecklist` component, `{ milestones, onToggle, onAdd, error }` props — used only by `TaskPopover` in this plan.

**Deliberate scope note:** `DetailSkill.tsx`'s own inline milestone checklist (with its completion celebration-pulse animation) is left completely untouched by this task — this is a new, simpler component for tasks, not a refactor of the already-shipped skill screen. The new component skips the celebration pulse (checkbox + strikethrough only) to keep the popover's footprint small; the underlying `toggleMilestone`/`addMilestone` behavior is identical either way.

- [ ] **Step 1: Create `MilestoneChecklist`**

Create `src/renderer/src/components/MilestoneChecklist.tsx`:

```tsx
import { useState } from 'react';
import type { EngagementMilestone } from '../lib/types';
import { CheckIcon } from './icons';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function MilestoneChecklist({
  milestones,
  onToggle,
  onAdd,
  error,
}: {
  milestones: EngagementMilestone[];
  onToggle: (id: string, completed: boolean) => void;
  onAdd: (label: string) => Promise<{ error: string | null }>;
  error: string | null;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Sous-tâches</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-0 border-l border-ink-700 pl-[14px]">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center py-1.5">
              <label className="flex cursor-pointer items-center gap-2">
                <span className="relative -ml-[21px] flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={!!m.completedAt}
                    onChange={(e) => onToggle(m.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                  >
                    {m.completedAt && <CheckIcon size={10} />}
                  </span>
                </span>
                <span className={`text-sm ${m.completedAt ? 'text-muted line-through' : 'text-champagne'}`}>
                  {m.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <NewMilestoneForm onAdd={onAdd} />
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        setSubmitting(true);
        setError(null);
        const { error: addError } = await onAdd(label);
        setSubmitting(false);
        if (addError) {
          setError(addError);
          return;
        }
        input.value = '';
      }}
      className="mt-1 flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input
          name="label"
          aria-label="Nouvelle sous-tâche"
          placeholder="Nouvelle sous-tâche"
          disabled={submitting}
          className={`flex-1 border border-ink-700 bg-ink-900 px-2.5 py-1 text-xs text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Wire it into `TaskPopover`**

`src/renderer/src/components/TaskPopover.tsx` lines 1-6 currently read:

```tsx
import RayCorner from './RayCorner';
import Button from './Button';
import RecurrenceEditor from './RecurrenceEditor';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { RecurrenceRule } from '../lib/recurrence';
import type { Engagement, Priority } from '../lib/types';
```

Replace with:

```tsx
import RayCorner from './RayCorner';
import Button from './Button';
import RecurrenceEditor from './RecurrenceEditor';
import MilestoneChecklist from './MilestoneChecklist';
import { useMilestones } from '../hooks/useMilestones';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { RecurrenceRule } from '../lib/recurrence';
import type { Engagement, Priority } from '../lib/types';
```

Then, inside the component (`export default function TaskPopover({ ... }) {`), directly after the opening `{` and before the `return (`, add:

```tsx
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(task.id);
```

Then, find the closing of the "Reporter" section, right before the conditional recurrence editor:

```tsx
        {canEditRecurrence && (
          <RecurrenceEditor
            type={task.recurrenceType}
            interval={task.recurrenceInterval}
            weekdays={task.recurrenceWeekdays}
            onChange={onRecurrenceChange}
            disabled={recurrenceBusy}
          />
        )}
        {error && (
```

Insert the checklist directly after the "Reporter" block and before the recurrence editor's conditional (order in the popover, top to bottom: Priorité, Reporter, Sous-tâches, Récurrence, error, buttons):

```tsx
        {canEditRecurrence && (
          <RecurrenceEditor
            type={task.recurrenceType}
            interval={task.recurrenceInterval}
            weekdays={task.recurrenceWeekdays}
            onChange={onRecurrenceChange}
            disabled={recurrenceBusy}
          />
        )}
        <MilestoneChecklist
          milestones={milestones}
          onToggle={toggleMilestone}
          onAdd={addMilestone}
          error={milestonesError}
        />
        {error && (
```

(Only the `<MilestoneChecklist ... />` block is new here — the surrounding `{canEditRecurrence && (...)}` and `{error && (` lines are shown only to anchor exactly where the new block goes.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 5: Manual verification**

Start the app, open a task's popover on the Calendrier, and confirm:
- A "Sous-tâches" section appears with an "Ajouter" form, even when the task has none yet.
- Adding a sub-task shows it immediately in the list.
- Checking it toggles the strikethrough/checkbox state and persists across closing/reopening the popover.
- Opening a *skill's* detail page still shows its own, unrelated "Jalons" section exactly as before (unaffected by this change).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/MilestoneChecklist.tsx src/renderer/src/components/TaskPopover.tsx
git commit -m "feat: add a sub-task checklist to the task popover"
```

---

### Task 4: Project screens, navigation, and routing

**Files:**
- Modify: `src/renderer/src/components/icons.tsx`
- Create: `src/renderer/src/screens/NouveauProjet.tsx`
- Create: `src/renderer/src/screens/ListeProjets.tsx`
- Create: `src/renderer/src/screens/DetailProjet.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `createEngagement` (with `isProject`), `engagements` (filtered by `isProject`/`projectId`) from `useEngagements()` (Task 1).
- Produces: routes `/projets`, `/projets/nouveau`, `/projets/:id` — consumed by Task 5/6's `Link`/navigation if needed, and by the new nav item.

- [ ] **Step 1: Add `FolderIcon`**

`src/renderer/src/components/icons.tsx` ends with the `CalendarIcon` function. Add a new function at the end of the file, after `CalendarIcon`:

```tsx
export function FolderIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h7A1.5 1.5 0 0 1 20 9v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V7z" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `NouveauProjet.tsx`**

Create `src/renderer/src/screens/NouveauProjet.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField, TextAreaField } from '../components/FormField';

export default function NouveauProjet() {
  const navigate = useNavigate();
  const { createEngagement } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
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
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      notes: notes || null,
      isProject: true,
    });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/projets');
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={2} />
      <div className="relative">
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouveau projet</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Regrouper des engagements</h1>
      </div>
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        <FormField label="Nom" required value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Tags (séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Maison, Perso"
        />
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create `ListeProjets.tsx`**

Create `src/renderer/src/screens/ListeProjets.tsx`:

```tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';

export default function ListeProjets() {
  const { engagements, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[30px] text-champagne">Projets</h1>
        <Link to="/projets/nouveau" className={buttonClassName('primary')}>
          + Nouveau projet
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projets/${project.id}`}
            className="flex items-center gap-5 bg-ink-800 px-[22px] py-5 transition-colors duration-200 hover:bg-ink-700"
          >
            <div className="flex-1">
              <span className="font-serif text-[19px] text-champagne">{project.name}</span>
              {project.tags.length > 0 && (
                <p className="mt-1 text-[13px] text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
              )}
            </div>
          </Link>
        ))}
        {projects.length === 0 && <EmptyState>Aucun projet pour l'instant.</EmptyState>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `DetailProjet.tsx`**

Create `src/renderer/src/screens/DetailProjet.tsx`:

```tsx
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import Introuvable from './Introuvable';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import { ChevronLeftIcon } from '../components/icons';

export default function DetailProjet() {
  const { id } = useParams<{ id: string }>();
  const { engagements, loading, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const project = projects.find((p) => p.id === id);
  const children = useMemo(() => engagements.filter((e) => e.projectId === id), [engagements, id]);

  // Même garde que DetailSkill.tsx : `loading` repasse à true à chaque
  // refresh (y compris après une simple modification), donc la comparer
  // seule ferait clignoter tout l'écran sur « Chargement… » à chaque édition.
  if (loading && projects.length === 0) {
    return <EmptyState role="status">Chargement…</EmptyState>;
  }
  if (!project) {
    if (error) {
      return (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      );
    }
    return <Introuvable />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/projets"
        className="flex w-fit items-center gap-2 font-sans text-[13px] text-muted transition-colors duration-150 hover:text-champagne"
      >
        <ChevronLeftIcon />
        Retour
      </Link>

      <div className="relative overflow-hidden border border-ink-700 bg-ink-900 p-6">
        <RayCorner variant={0} />
        <h1 className="relative font-serif text-[30px] text-champagne">{project.name}</h1>
        {project.tags.length > 0 && (
          <p className="relative mt-1.5 text-[13px] text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        {project.notes && <p className="relative mt-3 text-sm text-champagne">{project.notes}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-sans text-sm font-semibold text-champagne">Engagements liés</h2>
        {children.length === 0 ? (
          <EmptyState>Aucun engagement rattaché à ce projet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
            {children.map((child) => (
              <Link
                key={child.id}
                to={child.scheduledAt ? '/calendrier' : `/skills/${child.id}`}
                className="flex items-center gap-3 bg-ink-800 px-[18px] py-4 transition-colors duration-200 hover:bg-ink-700"
              >
                <span className="font-data text-[10px] uppercase tracking-[0.08em] text-muted">
                  {child.scheduledAt ? 'Tâche' : 'Skill'}
                </span>
                <span className="font-serif text-champagne">{child.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

**Known limitation, accepted for this plan:** a task child links to `/calendrier` generally (there is no per-task detail route to deep-link to — tasks are only ever viewed via the Calendrier popover). This is a minor navigation rough edge, not a defect; a skill child correctly deep-links straight to `/skills/<id>`.

- [ ] **Step 5: Register the routes**

`src/renderer/src/App.tsx` currently imports screens at the top (among others):

```tsx
import NouvelleTache from './screens/NouvelleTache';
import Calendrier from './screens/Calendrier';
import DetailSkill from './screens/DetailSkill';
import ListeSkills from './screens/ListeSkills';
import NouveauSkill from './screens/NouveauSkill';
```

Add three new imports directly after `import NouveauSkill from './screens/NouveauSkill';`:

```tsx
import NouveauSkill from './screens/NouveauSkill';
import NouveauProjet from './screens/NouveauProjet';
import ListeProjets from './screens/ListeProjets';
import DetailProjet from './screens/DetailProjet';
```

Then, the route list currently reads:

```tsx
          <Route index element={<Accueil />} />
          <Route path="skills" element={<ListeSkills />} />
          <Route path="skills/nouveau" element={<NouveauSkill />} />
          <Route path="skills/:id" element={<DetailSkill />} />
          <Route path="entree/nouvelle" element={<NouvelleEntree />} />
          <Route path="taches/nouvelle" element={<NouvelleTache />} />
          <Route path="calendrier" element={<Calendrier />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="*" element={<Introuvable />} />
```

Replace with:

```tsx
          <Route index element={<Accueil />} />
          <Route path="skills" element={<ListeSkills />} />
          <Route path="skills/nouveau" element={<NouveauSkill />} />
          <Route path="skills/:id" element={<DetailSkill />} />
          <Route path="entree/nouvelle" element={<NouvelleEntree />} />
          <Route path="taches/nouvelle" element={<NouvelleTache />} />
          <Route path="calendrier" element={<Calendrier />} />
          <Route path="projets" element={<ListeProjets />} />
          <Route path="projets/nouveau" element={<NouveauProjet />} />
          <Route path="projets/:id" element={<DetailProjet />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="*" element={<Introuvable />} />
```

- [ ] **Step 6: Add the nav item**

`src/renderer/src/components/AppShell.tsx` lines 6-20 currently read:

```tsx
import { HomeIcon, ListIcon, CalendarIcon, GearIcon } from './icons';
import { colors } from '../theme/colors';
import { useEngagements } from '../hooks/useEngagements';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, planMissingOccurrences } from '../lib/recurrence';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/calendrier', label: 'Calendrier', Icon: CalendarIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];
```

Replace with:

```tsx
import { HomeIcon, ListIcon, CalendarIcon, FolderIcon, GearIcon } from './icons';
import { colors } from '../theme/colors';
import { useEngagements } from '../hooks/useEngagements';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, planMissingOccurrences } from '../lib/recurrence';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/calendrier', label: 'Calendrier', Icon: CalendarIcon },
  { to: '/projets', label: 'Projets', Icon: FolderIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 9: Manual verification**

Start the app and confirm:
- A 5th icon appears in the nav rail, between Calendrier and Réglages, linking to `/projets`.
- `/projets` shows an empty state ("Aucun projet pour l'instant.") with a working "+ Nouveau projet" link.
- Creating a project navigates back to `/projets` and the new project appears in the list.
- Clicking a project opens `/projets/:id`, showing its name/tags/notes and "Aucun engagement rattaché à ce projet." (no children yet — Task 5/6 add the ability to attach one).
- Re-run Task 2's manual check now that a project can actually be created: confirm it does NOT appear in ListeSkills, Accueil, NouvelleEntree's or Pomodoro's skill pickers, and that `/skills/<project-id>` shows "Introuvable".

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/components/icons.tsx src/renderer/src/screens/NouveauProjet.tsx src/renderer/src/screens/ListeProjets.tsx src/renderer/src/screens/DetailProjet.tsx src/renderer/src/App.tsx src/renderer/src/components/AppShell.tsx
git commit -m "feat: add project list, creation, and detail screens with navigation"
```

---

### Task 5: Project selector at creation (tasks and skills)

**Files:**
- Modify: `src/renderer/src/screens/NouvelleTache.tsx`
- Modify: `src/renderer/src/screens/NouveauSkill.tsx`

**Interfaces:**
- Consumes: `engagements` (filtered by `isProject`) from `useEngagements()` (Task 1), routes from Task 4 (not directly — just needs projects to exist to populate the dropdown).
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Add the project selector to `NouvelleTache.tsx`**

Line 1 currently reads:

```tsx
import { useState, type FormEvent } from 'react';
```

Replace with:

```tsx
import { useMemo, useState, type FormEvent } from 'react';
```

Line 3 currently reads:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

No change needed to this line itself, but the import block also needs `SelectField` alongside the existing `FormField` import. Line 10 currently reads:

```tsx
import { FormField } from '../components/FormField';
```

Replace with:

```tsx
import { FormField, SelectField } from '../components/FormField';
```

Then, line 43 currently reads:

```tsx
  const { engagements, createEngagement, createEngagements } = useEngagements();
```

(This line is unchanged — `engagements` is already destructured.) Directly after the existing state declarations, before `async function handleSubmit`, add:

```tsx
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const [projectId, setProjectId] = useState('');
```

Then, inside `handleSubmit`, both `createEngagement` calls (the first occurrence, and the batched follow-up occurrences) need `projectId: projectId || null` added. The first call currently reads:

```tsx
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: startDate.toISOString(),
      scheduledEndsAt,
      priority,
      recurrenceSeriesId,
      recurrenceType,
      recurrenceInterval: rule.interval,
      recurrenceWeekdays: rule.weekdays,
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
      recurrenceSeriesId,
      recurrenceType,
      recurrenceInterval: rule.interval,
      recurrenceWeekdays: rule.weekdays,
      projectId: projectId || null,
    });
```

The batched follow-up creation currently reads:

```tsx
        await createEngagements(
          occurrenceSlots.map((slot) => ({
            name: name.trim(),
            tags,
            scheduledAt: slot.scheduledAt,
            scheduledEndsAt: slot.scheduledEndsAt,
            priority,
            recurrenceSeriesId,
            recurrenceType,
            recurrenceInterval: rule.interval,
            recurrenceWeekdays: rule.weekdays,
          }))
        );
```

Replace with:

```tsx
        await createEngagements(
          occurrenceSlots.map((slot) => ({
            name: name.trim(),
            tags,
            scheduledAt: slot.scheduledAt,
            scheduledEndsAt: slot.scheduledEndsAt,
            priority,
            recurrenceSeriesId,
            recurrenceType,
            recurrenceInterval: rule.interval,
            recurrenceWeekdays: rule.weekdays,
            projectId: projectId || null,
          }))
        );
```

(A recurring task's follow-up occurrences inherit the same project as the first — consistent with how they already inherit `priority`.)

Finally, in the JSX, the "Récurrence" `<div>` block is followed directly by the `error` paragraph:

```tsx
        </div>
        {error && (
```

Insert a project selector directly after the "Récurrence" block's closing `</div>` and before `{error && (`:

```tsx
        </div>
        <SelectField label="Projet (optionnel)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Aucun</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        {error && (
```

- [ ] **Step 2: Add the project selector to `NouveauSkill.tsx`**

Line 1 currently reads:

```tsx
import { useState, type FormEvent } from 'react';
```

Replace with:

```tsx
import { useMemo, useState, type FormEvent } from 'react';
```

Line 7 currently reads:

```tsx
import { FormField, SelectField, TextAreaField } from '../components/FormField';
```

(No change — `SelectField` is already imported here for `genericLevel`.)

Line 11 currently reads:

```tsx
  const { createEngagement } = useEngagements();
```

Replace with:

```tsx
  const { engagements, createEngagement } = useEngagements();
```

Directly after the existing state declarations (after `const [submitting, setSubmitting] = useState(false);`), add:

```tsx
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const [projectId, setProjectId] = useState('');
```

Then, the `createEngagement` call currently reads:

```tsx
    const { error: createError } = await createEngagement({ name: name.trim(), tags, genericLevel, notes: notes || null });
```

Replace with:

```tsx
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      genericLevel,
      notes: notes || null,
      projectId: projectId || null,
    });
```

Finally, in the JSX, the `TextAreaField` for notes is followed directly by the `error` paragraph:

```tsx
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        {error && (
```

Insert a project selector between them:

```tsx
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <SelectField label="Projet (optionnel)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Aucun</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        {error && (
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 5: Manual verification**

Start the app, create a project (via Task 4's screen) named e.g. "Rénovation cuisine", then:
- On "Nouvelle tâche", confirm the "Projet" dropdown lists it, create a task assigned to it, and confirm on `/projets/<id>` that the task now appears under "Engagements liés" labeled "Tâche".
- On "Nouveau skill", confirm the same dropdown appears, create a skill assigned to the project, and confirm it appears on the project's detail page labeled "Skill", correctly deep-linking to `/skills/<id>`.
- Create one more task/skill with "Aucun" selected and confirm it does NOT show up on any project's detail page.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/NouvelleTache.tsx src/renderer/src/screens/NouveauSkill.tsx
git commit -m "feat: add a project selector to task and skill creation"
```

---

### Task 6: Project selector after creation (edit from the task popover and skill detail)

**Files:**
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `engagements` (filtered by `isProject`) from `useEngagements()` (Task 1), `updateEngagement` with `projectId` (Task 1).
- Produces: `TaskPopover` gains `projects: Engagement[]` and `onProjectChange: (projectId: string | null) => void` props — final piece of this plan, nothing later consumes them.

- [ ] **Step 1: Add an editable project selector to `DetailSkill.tsx`**

Line 34 currently reads (already fixed by Task 2 to exclude projects — this step builds on that):

```tsx
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
```

Directly after this line, add:

```tsx
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
```

Then, find `handleLevelChange`:

```tsx
  async function handleLevelChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateEngagement(skill.id, { genericLevel: e.target.value as GenericLevel });
    if (error) setActionError(error);
  }
```

Add a new handler directly after it:

```tsx
  async function handleProjectChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateEngagement(skill.id, { projectId: e.target.value || null });
    if (error) setActionError(error);
  }
```

Then, in the JSX, the genericLevel selector currently reads:

```tsx
          <label className="relative flex items-center gap-1.5 border border-accent-mid px-3.5 py-2 font-data text-[11px] uppercase tracking-[0.08em] text-accent-mid">
            {LEVEL_LABELS[skill.genericLevel]}
            <ChevronDownIcon />
            <select
              value={skill.genericLevel}
              onChange={handleLevelChange}
              aria-label="Niveau"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {(Object.keys(LEVEL_LABELS) as GenericLevel[]).map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
```

Add a matching project selector directly after this `</label>` (still inside the same `<div className="flex items-center gap-3">`):

```tsx
          <label className="relative flex items-center gap-1.5 border border-ink-700 px-3.5 py-2 font-data text-[11px] uppercase tracking-[0.08em] text-muted">
            {skill.projectId ? (projects.find((p) => p.id === skill.projectId)?.name ?? 'Projet') : 'Aucun projet'}
            <ChevronDownIcon />
            <select
              value={skill.projectId ?? ''}
              onChange={handleProjectChange}
              aria-label="Projet"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Aucun projet</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
```

- [ ] **Step 2: Add the project selector to `TaskPopover`**

`src/renderer/src/components/TaskPopover.tsx`'s prop list currently reads:

```tsx
export default function TaskPopover({
  task,
  onClose,
  onComplete,
  completing,
  onPriorityChange,
  onSnooze,
  canEditRecurrence,
  onRecurrenceChange,
  recurrenceBusy,
  error,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
  onSnooze: (mode: 'aujourdhui' | 'demain') => void;
  canEditRecurrence: boolean;
  onRecurrenceChange: (rule: RecurrenceRule) => void;
  recurrenceBusy: boolean;
  error: string | null;
}) {
```

Replace with:

```tsx
export default function TaskPopover({
  task,
  onClose,
  onComplete,
  completing,
  onPriorityChange,
  onSnooze,
  canEditRecurrence,
  onRecurrenceChange,
  recurrenceBusy,
  projects,
  onProjectChange,
  error,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
  onSnooze: (mode: 'aujourdhui' | 'demain') => void;
  canEditRecurrence: boolean;
  onRecurrenceChange: (rule: RecurrenceRule) => void;
  recurrenceBusy: boolean;
  projects: Engagement[];
  onProjectChange: (projectId: string | null) => void;
  error: string | null;
}) {
```

Then, the `MilestoneChecklist` block (added by Task 3) is followed directly by the `error` paragraph:

```tsx
        <MilestoneChecklist
          milestones={milestones}
          onToggle={toggleMilestone}
          onAdd={addMilestone}
          error={milestonesError}
        />
        {error && (
```

Insert a project selector between them:

```tsx
        <MilestoneChecklist
          milestones={milestones}
          onToggle={toggleMilestone}
          onAdd={addMilestone}
          error={milestonesError}
        />
        <div className="relative flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Projet</p>
          <select
            value={task.projectId ?? ''}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className={`border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-sm text-champagne ${FOCUS_RING}`}
          >
            <option value="">Aucun</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
```

- [ ] **Step 3: Wire `handleChangeProject` into `Calendrier.tsx`**

The hook destructuring currently reads:

```tsx
  const { engagements, error: engagementsError, setArchived, updateEngagement, createEngagements, deleteEngagements } = useEngagements();
```

(No change needed — `engagements` and `updateEngagement` are already destructured.) Directly after `const activeEngagements = useMemo(...)`, add:

```tsx
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
```

Then, directly after the existing `handleChangePriority` function, add:

```tsx
  async function handleChangeProject(taskId: string, projectId: string | null) {
    const { error } = await updateEngagement(taskId, { projectId });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    setPopoverTask((current) => (current && current.id === taskId ? { ...current, projectId } : current));
  }
```

Finally, find where `<TaskPopover>` is rendered:

```tsx
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
          onPriorityChange={(priority) => handleChangePriority(popoverTask.id, priority)}
          onSnooze={(mode) => handleSnooze(popoverTask.id, mode)}
          canEditRecurrence={isNextOccurrenceInSeries(popoverTask, activeEngagements)}
          onRecurrenceChange={(rule) => handleChangeRecurrence(popoverTask.id, rule)}
          recurrenceBusy={recurrenceBusy}
          error={actionError}
        />
```

Replace with:

```tsx
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
          onPriorityChange={(priority) => handleChangePriority(popoverTask.id, priority)}
          onSnooze={(mode) => handleSnooze(popoverTask.id, mode)}
          canEditRecurrence={isNextOccurrenceInSeries(popoverTask, activeEngagements)}
          onRecurrenceChange={(rule) => handleChangeRecurrence(popoverTask.id, rule)}
          recurrenceBusy={recurrenceBusy}
          projects={projects}
          onProjectChange={(projectId) => handleChangeProject(popoverTask.id, projectId)}
          error={actionError}
        />
```

(Read the actual current file first to confirm the exact surrounding lines for both the hook destructure and the `<TaskPopover>` call — this file has been modified by several earlier tasks/plans, so match against what's actually there rather than assuming stale line numbers.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 6: Manual verification**

Start the app, with at least one project already created:
- Open a skill's detail page, confirm a "Aucun projet" selector appears next to the level selector, assign it to a project, and confirm the project's detail page now lists that skill.
- Open a task's popover on the Calendrier, confirm a "Projet" selector appears (pre-filled "Aucun"), assign it to a project, close and reopen the popover, and confirm the selection persisted.
- Reassign a task from one project to another, and confirm it moves accordingly on both projects' detail pages (no longer listed on the old one, now listed on the new one).
- Reload the app and confirm everything persisted correctly.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/screens/DetailSkill.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: edit a task's or skill's project from the popover and detail screen"
```

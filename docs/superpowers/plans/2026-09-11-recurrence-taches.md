# Récurrence sur les Tâches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task repeat on a daily / weekly / every-N-days schedule. Occurrences are real, independent `engagement` rows generated ahead of time into a rolling 8-week window; the rule is editable only from the earliest not-yet-completed occurrence of a series, and editing it discards the other not-yet-completed future occurrences and regenerates them.

**Architecture:** A small set of pure, fully-testable planning functions (`src/renderer/src/lib/recurrence.ts`) decide *what* occurrences should exist; three thin call sites do the actual IO (creating/deleting rows) at the three moments occurrences need to change: app load (silent background top-up), task creation (the series' first fill), and rule edits (delete + regenerate). No new pure-logic surface is added beyond `recurrence.ts` — everything else is UI wiring following patterns already established by the priority and report-rapide features.

**Tech Stack:** React 19 + TypeScript, Vitest for the pure logic, Supabase for persistence — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-taches-avancees-design.md` (section 2, "Récurrence sur les tâches")

## Global Constraints

- Recurrence types for this version: `aucune` (default) / `quotidien` / `hebdomadaire` (with selectable weekdays) / `tous_les_n_jours` (with an interval N). No monthly or "Nth weekday of month" patterns.
- The rolling generation window is **8 weeks (56 days)** ahead of today, exported as a single constant (`RECURRENCE_WINDOW_DAYS`) so all three call sites agree.
- The recurrence rule is editable **only from the earliest not-yet-archived occurrence of a series**. Editing it deletes (real deletion, not archiving — these rows never occurred and carry no history) every other not-yet-archived future occurrence of the same series, then regenerates the window under the new rule.
- Skills never participate in recurrence — this feature is scoped entirely to tasks (engagements with `scheduledAt` set).
- Conflict detection (a generated occurrence's time range overlapping an unrelated task) only needs to be surfaced to the user at the two moments a user just took an action — creating a recurring task, or editing its rule. The silent background window top-up (Task 3) does not show a banner — surfacing one at a random app-launch moment the user didn't ask for would be more surprising than helpful; the overlap is still visible directly on the calendar grid either way.
- This project's comment convention: no comments explaining WHAT code does, only non-obvious WHY.

---

### Task 1: Data layer — migration, types, `useEngagements` extensions

**Files:**
- Create: `supabase/migrations/0007_task_recurrence.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`

**Interfaces:**
- Produces: `Engagement` gains `recurrenceSeriesId: string | null`, `recurrenceType: RecurrenceType`, `recurrenceInterval: number | null`, `recurrenceWeekdays: number[] | null`. `RecurrenceType = 'aucune' | 'quotidien' | 'hebdomadaire' | 'tous_les_n_jours'`, exported from `types.ts`.
- Produces: `useEngagements()` gains `deleteEngagement(id: string): Promise<{ error: string | null }>` in its return object. `createEngagement`'s input and `updateEngagement`'s patch both gain the 4 new fields as optional/partial, following the exact conditional-spread pattern already used for `priority`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_task_recurrence.sql`:

```sql
begin;

alter table saint_daily.engagement
  add column recurrence_series_id uuid,
  add column recurrence_type text not null default 'aucune'
    check (recurrence_type in ('aucune', 'quotidien', 'hebdomadaire', 'tous_les_n_jours')),
  add column recurrence_interval integer,
  add column recurrence_weekdays integer[];

commit;
```

- [ ] **Step 2: Extend `types.ts`**

`src/renderer/src/lib/types.ts` currently reads:

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

Replace with:

```ts
export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export type Priority = 'aucune' | 'basse' | 'moyenne' | 'elevee';
export type RecurrenceType = 'aucune' | 'quotidien' | 'hebdomadaire' | 'tous_les_n_jours';

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

- [ ] **Step 3: Extend `EngagementRow` and `fromRow`**

`src/renderer/src/hooks/useEngagements.ts` lines 1-35 currently read:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
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

Replace with:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { Engagement, GenericLevel, Priority, RecurrenceType } from '../lib/types';

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

- [ ] **Step 4: Extend `createEngagement` and `updateEngagement`, add `deleteEngagement`**

Lines 66-127 (from `createEngagement` through the end of the file) currently read:

```ts
  // `genericLevel` optionnel : sans objet pour une tâche ponctuelle,
  // laissée absente du payload pour que la colonne applique son propre
  // défaut plutôt que de dupliquer 'debutant' ici.
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
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function updateEngagement(
    id: string,
    patch: Partial<
      Pick<Engagement, 'name' | 'notes' | 'tags' | 'genericLevel' | 'priority' | 'scheduledAt' | 'scheduledEndsAt'>
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
      })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  async function setArchived(id: string, archived: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  return { engagements, loading, error, refresh, createEngagement, updateEngagement, setArchived };
}
```

Replace with:

```ts
  // `genericLevel` optionnel : sans objet pour une tâche ponctuelle,
  // laissée absente du payload pour que la colonne applique son propre
  // défaut plutôt que de dupliquer 'debutant' ici.
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

  async function setArchived(id: string, archived: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  // Première suppression réelle de l'app — volontairement scopée aux
  // occurrences de récurrence auto-générées et jamais échues (voir spec) :
  // rien d'autre dans le codebase n'appelle cette fonction.
  async function deleteEngagement(id: string) {
    const { error: deleteError } = await getSupabaseClient().from('engagement').delete().eq('id', id);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
    await refresh();
    return { error: null };
  }

  return { engagements, loading, error, refresh, createEngagement, updateEngagement, setArchived, deleteEngagement };
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Other screens like `NouveauSkill.tsx` don't pass the new fields — they're all optional, so this must stay green.)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all existing tests pass unchanged (this task adds no new pure logic).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0007_task_recurrence.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts
git commit -m "feat: add recurrence fields to the engagement data layer"
```

---

### Task 2: Pure recurrence planning logic

**Files:**
- Create: `src/renderer/src/lib/recurrence.ts`
- Create: `src/renderer/src/lib/recurrence.test.ts`

**Interfaces:**
- Consumes: `addDays(date: Date, days: number): Date` from `../lib/calendarLayout` (already exists, unchanged).
- Produces (all exported from `recurrence.ts`, consumed by Tasks 3-5):
  - `export const RECURRENCE_WINDOW_DAYS = 56;`
  - `export interface RecurrenceRule { type: RecurrenceType; interval: number | null; weekdays: number[] | null; }`
  - `export function nextAnchorDate(rule: RecurrenceRule, lastOccurrenceDate: Date): Date`
  - `export function generateOccurrences(rule: RecurrenceRule, fromDate: Date, untilDate: Date): Date[]`
  - `export interface EngagementLike { id: string; name: string; tags: string[]; priority: Priority; scheduledAt: string | null; scheduledEndsAt: string | null; archivedAt: string | null; recurrenceSeriesId: string | null; recurrenceType: RecurrenceType; recurrenceInterval: number | null; recurrenceWeekdays: number[] | null; }` — a real `Engagement` satisfies this structurally (same field names, superset of fields), so callers never need to construct or convert it.
  - `export interface OccurrenceSlot { seriesId: string; scheduledAt: string; scheduledEndsAt: string; }`
  - `export interface PlannedOccurrence extends OccurrenceSlot { templateId: string; }`
  - `export function planMissingOccurrences(engagements: EngagementLike[], windowEnd: Date): PlannedOccurrence[]`
  - `export interface ScheduleConflict { scheduledAt: string; }`
  - `export function detectConflicts(occurrences: OccurrenceSlot[], existingTasks: EngagementLike[]): ScheduleConflict[]`
  - `export function isNextOccurrenceInSeries(task: EngagementLike, allEngagements: EngagementLike[]): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/lib/recurrence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  detectConflicts,
  generateOccurrences,
  isNextOccurrenceInSeries,
  nextAnchorDate,
  planMissingOccurrences,
  type EngagementLike,
  type RecurrenceRule,
} from './recurrence';

function engagement(overrides: Partial<EngagementLike> & { id: string }): EngagementLike {
  return {
    id: overrides.id,
    name: overrides.name ?? 'Tâche',
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 'aucune',
    scheduledAt: overrides.scheduledAt ?? null,
    scheduledEndsAt: overrides.scheduledEndsAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    recurrenceSeriesId: overrides.recurrenceSeriesId ?? null,
    recurrenceType: overrides.recurrenceType ?? 'aucune',
    recurrenceInterval: overrides.recurrenceInterval ?? null,
    recurrenceWeekdays: overrides.recurrenceWeekdays ?? null,
  };
}

describe('generateOccurrences', () => {
  it('returns nothing for "aucune"', () => {
    const rule: RecurrenceRule = { type: 'aucune', interval: null, weekdays: null };
    expect(generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 20, 9, 0))).toEqual([]);
  });

  it('generates one date per day for "quotidien"', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 11, 9, 0));
    expect(result).toHaveLength(5);
    expect(result[0].toISOString()).toBe(new Date(2026, 8, 7, 9, 0).toISOString());
    expect(result[4].toISOString()).toBe(new Date(2026, 8, 11, 9, 0).toISOString());
  });

  it('steps by N days for "tous_les_n_jours"', () => {
    const rule: RecurrenceRule = { type: 'tous_les_n_jours', interval: 3, weekdays: null };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 16, 9, 0));
    expect(result.map((d) => d.getDate())).toEqual([7, 10, 13, 16]);
  });

  it('only includes matching weekdays for "hebdomadaire"', () => {
    // 7 sept. 2026 est un lundi (day 1); [1, 3] = lundi + mercredi
    const rule: RecurrenceRule = { type: 'hebdomadaire', interval: null, weekdays: [1, 3] };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 20, 9, 0));
    expect(result.map((d) => d.getDate())).toEqual([7, 9, 14, 16]);
  });

  it('returns nothing when the window is already closed', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    expect(generateOccurrences(rule, new Date(2026, 8, 10, 9, 0), new Date(2026, 8, 7, 9, 0))).toEqual([]);
  });
});

describe('nextAnchorDate', () => {
  it('advances by 1 day for "quotidien"', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
  });

  it('advances by 1 day for "hebdomadaire" (the weekday filter does the rest)', () => {
    const rule: RecurrenceRule = { type: 'hebdomadaire', interval: null, weekdays: [1] };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
  });

  it('advances by the interval for "tous_les_n_jours"', () => {
    const rule: RecurrenceRule = { type: 'tous_les_n_jours', interval: 5, weekdays: null };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 12, 9, 0).toISOString());
  });
});

describe('planMissingOccurrences', () => {
  it('returns nothing when there are no recurring series', () => {
    const engagements = [engagement({ id: 'a', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString() })];
    expect(planMissingOccurrences(engagements, new Date(2026, 8, 20))).toEqual([]);
  });

  it('fills the window for a series behind schedule', () => {
    const engagements = [
      engagement({
        id: 'a',
        name: 'Arroser les plantes',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString(),
      }),
    ];
    const planned = planMissingOccurrences(engagements, new Date(2026, 8, 10, 9, 0));
    expect(planned).toHaveLength(3); // 8, 9, 10 sept.
    expect(planned.every((p) => p.seriesId === 'serie-1' && p.templateId === 'a')).toBe(true);
    const first = planned[0];
    expect(first.scheduledAt).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
    // durée (15 min) préservée sur chaque occurrence générée
    expect(new Date(first.scheduledEndsAt).getTime() - new Date(first.scheduledAt).getTime()).toBe(15 * 60_000);
  });

  it('ignores an archived occurrence when finding the latest in a series', () => {
    const engagements = [
      engagement({
        id: 'a',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString(),
      }),
      engagement({
        id: 'b',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 9, 9, 15).toISOString(),
        archivedAt: new Date().toISOString(),
      }),
    ];
    const planned = planMissingOccurrences(engagements, new Date(2026, 8, 9, 9, 0));
    // la dernière occurrence NON archivée est "a" (7 sept.) — "b" (9 sept., archivée) est ignorée,
    // donc la génération reprend au 8 sept., pas au 10.
    expect(planned.map((p) => p.scheduledAt)).toEqual([
      new Date(2026, 8, 8, 9, 0).toISOString(),
      new Date(2026, 8, 9, 9, 0).toISOString(),
    ]);
  });

  it('excludes engagements with recurrenceType "aucune"', () => {
    const engagements = [
      engagement({ id: 'a', recurrenceSeriesId: 'serie-1', recurrenceType: 'aucune', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString() }),
    ];
    expect(planMissingOccurrences(engagements, new Date(2026, 8, 20))).toEqual([]);
  });
});

describe('detectConflicts', () => {
  it('returns nothing when nothing overlaps', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'other', scheduledAt: new Date(2026, 8, 7, 14, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 14, 30).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([]);
  });

  it('flags an occurrence that overlaps an unrelated task', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'other', scheduledAt: new Date(2026, 8, 7, 9, 15).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 45).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([{ scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString() }]);
  });

  it('ignores an overlap with a sibling of the same series', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'sibling', recurrenceSeriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 15).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 45).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([]);
  });
});

describe('isNextOccurrenceInSeries', () => {
  it('is true when no other non-archived sibling starts earlier', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString() });
    const sibling = engagement({ id: 'b', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(true);
  });

  it('is false when a non-archived sibling starts earlier', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    const sibling = engagement({ id: 'b', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(false);
  });

  it('ignores an earlier sibling that is archived', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    const sibling = engagement({
      id: 'b',
      recurrenceSeriesId: 's1',
      recurrenceType: 'quotidien',
      scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString(),
      archivedAt: new Date().toISOString(),
    });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(true);
  });

  it('is false for a task with no recurrence', () => {
    const task = engagement({ id: 'a', recurrenceType: 'aucune', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- recurrence`
Expected: FAIL with "Cannot find module './recurrence'" or similar — the file doesn't exist yet.

- [ ] **Step 3: Implement `recurrence.ts`**

Create `src/renderer/src/lib/recurrence.ts`:

```ts
import { addDays } from './calendarLayout';
import type { Priority, RecurrenceType } from './types';

export const RECURRENCE_WINDOW_DAYS = 56;

export interface RecurrenceRule {
  type: RecurrenceType;
  interval: number | null;
  weekdays: number[] | null;
}

// "tous les N jours" doit repartir de la dernière occurrence + N jours pour
// garder la cadence ; quotidien/hebdomadaire avancent toujours d'un jour (le
// filtre du jour de la semaine fait le tri pour hebdomadaire).
export function nextAnchorDate(rule: RecurrenceRule, lastOccurrenceDate: Date): Date {
  if (rule.type === 'tous_les_n_jours') return addDays(lastOccurrenceDate, rule.interval ?? 1);
  return addDays(lastOccurrenceDate, 1);
}

// `fromDate` est un point d'ancrage, pas nécessairement une occurrence
// elle-même (cas hebdomadaire : seuls les jours de la semaine sélectionnés
// comptent) — l'heure de `fromDate` est conservée sur chaque date générée.
export function generateOccurrences(rule: RecurrenceRule, fromDate: Date, untilDate: Date): Date[] {
  if (rule.type === 'aucune') return [];
  const occurrences: Date[] = [];
  const step = rule.type === 'tous_les_n_jours' ? rule.interval ?? 1 : 1;
  let cursor = new Date(fromDate);
  while (cursor.getTime() <= untilDate.getTime()) {
    if (rule.type === 'hebdomadaire') {
      if ((rule.weekdays ?? []).includes(cursor.getDay())) occurrences.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    } else {
      occurrences.push(new Date(cursor));
      cursor = addDays(cursor, step);
    }
  }
  return occurrences;
}

export interface EngagementLike {
  id: string;
  name: string;
  tags: string[];
  priority: Priority;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  archivedAt: string | null;
  recurrenceSeriesId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
}

export interface OccurrenceSlot {
  seriesId: string;
  scheduledAt: string;
  scheduledEndsAt: string;
}

export interface PlannedOccurrence extends OccurrenceSlot {
  templateId: string;
}

// Pure — ne touche pas le réseau. `windowEnd` est fourni par l'appelant
// (aujourd'hui + RECURRENCE_WINDOW_DAYS) plutôt que calculé ici, pour rester
// testable avec une date fixe.
export function planMissingOccurrences(engagements: EngagementLike[], windowEnd: Date): PlannedOccurrence[] {
  const bySeriesId = new Map<string, EngagementLike[]>();
  for (const e of engagements) {
    if (e.archivedAt || !e.recurrenceSeriesId || e.recurrenceType === 'aucune' || !e.scheduledAt || !e.scheduledEndsAt) {
      continue;
    }
    const list = bySeriesId.get(e.recurrenceSeriesId) ?? [];
    list.push(e);
    bySeriesId.set(e.recurrenceSeriesId, list);
  }

  const planned: PlannedOccurrence[] = [];
  for (const [seriesId, occurrences] of bySeriesId) {
    const latest = occurrences.reduce((a, b) =>
      new Date(a.scheduledAt as string) > new Date(b.scheduledAt as string) ? a : b
    );
    const durationMs =
      new Date(latest.scheduledEndsAt as string).getTime() - new Date(latest.scheduledAt as string).getTime();
    const rule: RecurrenceRule = {
      type: latest.recurrenceType,
      interval: latest.recurrenceInterval,
      weekdays: latest.recurrenceWeekdays,
    };
    const anchor = nextAnchorDate(rule, new Date(latest.scheduledAt as string));
    const dates = generateOccurrences(rule, anchor, windowEnd);
    for (const date of dates) {
      planned.push({
        seriesId,
        templateId: latest.id,
        scheduledAt: date.toISOString(),
        scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
      });
    }
  }
  return planned;
}

export interface ScheduleConflict {
  scheduledAt: string;
}

export function detectConflicts(occurrences: OccurrenceSlot[], existingTasks: EngagementLike[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const occ of occurrences) {
    const occStart = new Date(occ.scheduledAt).getTime();
    const occEnd = new Date(occ.scheduledEndsAt).getTime();
    const overlaps = existingTasks.some((t) => {
      if (t.recurrenceSeriesId === occ.seriesId) return false;
      if (!t.scheduledAt || !t.scheduledEndsAt) return false;
      const tStart = new Date(t.scheduledAt).getTime();
      const tEnd = new Date(t.scheduledEndsAt).getTime();
      return tStart < occEnd && tEnd > occStart;
    });
    if (overlaps) conflicts.push({ scheduledAt: occ.scheduledAt });
  }
  return conflicts;
}

export function isNextOccurrenceInSeries(task: EngagementLike, allEngagements: EngagementLike[]): boolean {
  if (!task.recurrenceSeriesId || task.recurrenceType === 'aucune' || !task.scheduledAt) return false;
  const taskTime = new Date(task.scheduledAt).getTime();
  return !allEngagements.some((e) => {
    if (e.archivedAt || e.id === task.id || e.recurrenceSeriesId !== task.recurrenceSeriesId) return false;
    if (!e.scheduledAt) return false;
    return new Date(e.scheduledAt).getTime() < taskTime;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- recurrence`
Expected: PASS, all 19 tests green.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/recurrence.ts src/renderer/src/lib/recurrence.test.ts
git commit -m "feat: add pure recurrence planning logic"
```

---

### Task 3: Silent background window top-up

**Files:**
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useEngagements()` (already exists; this is a second, independent call to it, exactly like every screen already does). Consumes `planMissingOccurrences`, `RECURRENCE_WINDOW_DAYS` from `../lib/recurrence` (Task 2) and `addDays` from `../lib/calendarLayout` (already exists).
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Add the sync effect to `AppShell`**

`src/renderer/src/components/AppShell.tsx` lines 1-20 currently read:

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import RailFlare from './RailFlare';
import UpdateBanner from './UpdateBanner';
import { HomeIcon, ListIcon, CalendarIcon, GearIcon } from './icons';
import { colors } from '../theme/colors';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/calendrier', label: 'Calendrier', Icon: CalendarIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];

export default function AppShell() {
  return (
```

Replace with:

```tsx
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import RailFlare from './RailFlare';
import UpdateBanner from './UpdateBanner';
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

export default function AppShell() {
  const { engagements, loading, createEngagement } = useEngagements();

  useEffect(() => {
    if (loading) return;
    async function syncRecurringSeries() {
      const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
      const planned = planMissingOccurrences(engagements, windowEnd);
      for (const occurrence of planned) {
        const template = engagements.find((e) => e.id === occurrence.templateId);
        if (!template) continue;
        await createEngagement({
          name: template.name,
          tags: template.tags,
          priority: template.priority,
          scheduledAt: occurrence.scheduledAt,
          scheduledEndsAt: occurrence.scheduledEndsAt,
          recurrenceSeriesId: occurrence.seriesId,
          recurrenceType: template.recurrenceType,
          recurrenceInterval: template.recurrenceInterval,
          recurrenceWeekdays: template.recurrenceWeekdays,
        });
      }
    }
    syncRecurringSeries();
    // Ne dépend que de `loading` : ne doit tourner qu'une fois par
    // chargement de l'app, pas à chaque render où `engagements` change —
    // y compris à cause des créations que cette synchronisation fait
    // elle-même, ce qui boucherait sinon. Ce projet n'a pas d'eslint (voir
    // package.json) — rien à désactiver, juste une omission volontaire.
  }, [loading]);

  return (
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass — this task adds no new pure logic.

- [ ] **Step 4: Manual verification**

Applies once the migration (Task 1) is live and there's at least one recurring task (created manually in the database, or wait for Task 4 to create one through the UI):

- Start the app with a recurring series whose latest occurrence is older than 8 weeks from today. Confirm new occurrences silently appear (check the Calendrier a few weeks out, or re-query the table) without any banner or visible interruption.
- Start the app with a series already fully topped up. Confirm no duplicate occurrences are created (re-running the effect via a reload should be a no-op).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/AppShell.tsx
git commit -m "feat: silently top up recurring task series on app load"
```

---

### Task 4: Recurrence selector on task creation

**Files:**
- Modify: `src/renderer/src/screens/NouvelleTache.tsx`

**Interfaces:**
- Consumes: `RecurrenceRule`, `RECURRENCE_WINDOW_DAYS`, `nextAnchorDate`, `generateOccurrences`, `detectConflicts` from `../lib/recurrence` (Task 2). Consumes `addDays` from `../lib/calendarLayout` (already exists). Consumes `RecurrenceType` from `../lib/types` (Task 1).
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Add state and the recurrence selector UI**

`src/renderer/src/screens/NouvelleTache.tsx` lines 1-36 currently read:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { Priority } from '../lib/types';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const DURATION_PRESETS = [15, 30, 45, 60, 90];

// datetime-local exige "YYYY-MM-DDTHH:mm" en heure locale, sans le "Z" ni le
// décalage qu'a un ISO string — cette conversion n'est nécessaire que quand
// on arrive ici via un clic sur un créneau du calendrier (Task 4).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NouvelleTache() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createEngagement } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const preselectedScheduledAt = searchParams.get('scheduledAt');
  const [scheduledAt, setScheduledAt] = useState(
    preselectedScheduledAt ? toDatetimeLocalValue(preselectedScheduledAt) : ''
  );
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('aucune');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

Replace with:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, detectConflicts, generateOccurrences, nextAnchorDate, type RecurrenceRule } from '../lib/recurrence';
import type { Priority, RecurrenceType } from '../lib/types';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const DURATION_PRESETS = [15, 30, 45, 60, 90];
const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'tous_les_n_jours', label: 'Tous les N jours' },
];
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
];

// datetime-local exige "YYYY-MM-DDTHH:mm" en heure locale, sans le "Z" ni le
// décalage qu'a un ISO string — cette conversion n'est nécessaire que quand
// on arrive ici via un clic sur un créneau du calendrier (Task 4).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NouvelleTache() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { engagements, createEngagement } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const preselectedScheduledAt = searchParams.get('scheduledAt');
  const [scheduledAt, setScheduledAt] = useState(
    preselectedScheduledAt ? toDatetimeLocalValue(preselectedScheduledAt) : ''
  );
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('aucune');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('aucune');
  const [recurrenceInterval, setRecurrenceInterval] = useState(2);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

Note: only the imports block and the two lines adding `recurrenceType`/`recurrenceInterval`/`recurrenceWeekdays` state (plus `conflictMessage` state and `engagements` in the hook destructure) are new here — `toDatetimeLocalValue` itself is unchanged from the current file, shown above only for context/anchoring.

- [ ] **Step 2: Extend `handleSubmit` to create the follow-up occurrences**

Lines 38-69 currently read:

```tsx
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    if (!scheduledAt) {
      setError('La planification est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const startDate = new Date(scheduledAt);
    const scheduledEndsAt = new Date(startDate.getTime() + durationMinutes * 60_000).toISOString();
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: startDate.toISOString(),
      scheduledEndsAt,
      priority,
    });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/');
  }
```

Replace with:

```tsx
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    if (!scheduledAt) {
      setError('La planification est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setConflictMessage(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const startDate = new Date(scheduledAt);
    const durationMs = durationMinutes * 60_000;
    const scheduledEndsAt = new Date(startDate.getTime() + durationMs).toISOString();
    const recurrenceSeriesId = recurrenceType !== 'aucune' ? crypto.randomUUID() : null;
    const rule: RecurrenceRule = {
      type: recurrenceType,
      interval: recurrenceType === 'tous_les_n_jours' ? recurrenceInterval : null,
      weekdays: recurrenceType === 'hebdomadaire' ? recurrenceWeekdays : null,
    };
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
    if (createError) {
      setSubmitting(false);
      setError(createError);
      return;
    }

    if (recurrenceType !== 'aucune' && recurrenceSeriesId) {
      const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
      const anchor = nextAnchorDate(rule, startDate);
      const dates = generateOccurrences(rule, anchor, windowEnd);
      const occurrenceSlots = dates.map((date) => ({
        seriesId: recurrenceSeriesId,
        scheduledAt: date.toISOString(),
        scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
      }));
      const conflicts = detectConflicts(occurrenceSlots, engagements);
      for (const slot of occurrenceSlots) {
        await createEngagement({
          name: name.trim(),
          tags,
          scheduledAt: slot.scheduledAt,
          scheduledEndsAt: slot.scheduledEndsAt,
          priority,
          recurrenceSeriesId,
          recurrenceType,
          recurrenceInterval: rule.interval,
          recurrenceWeekdays: rule.weekdays,
        });
      }
      if (conflicts.length > 0) {
        setSubmitting(false);
        setConflictMessage(
          `${conflicts.length} occurrence${conflicts.length > 1 ? 's' : ''} en conflit avec une autre tâche déjà planifiée.`
        );
        return;
      }
    }

    setSubmitting(false);
    navigate('/');
  }
```

- [ ] **Step 3: Add the recurrence selector to the form**

Lines 108-124 (the priority `<div>` block) currently read:

```tsx
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
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
```

Replace with:

```tsx
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
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Récurrence</p>
          <div className="flex flex-wrap items-center gap-2">
            {RECURRENCE_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRecurrenceType(option.value)}
                aria-pressed={recurrenceType === option.value}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${recurrenceType === option.value ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {recurrenceType === 'hebdomadaire' && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = recurrenceWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() =>
                      setRecurrenceWeekdays((current) =>
                        selected ? current.filter((d) => d !== day.value) : [...current, day.value]
                      )
                    }
                    aria-pressed={selected}
                    className={`font-data text-xs px-2.5 py-1 transition-colors duration-150 ${FOCUS_RING} ${selected ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          )}
          {recurrenceType === 'tous_les_n_jours' && (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={2}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Math.max(2, Number(e.target.value) || 2))}
                className={`w-16 border border-ink-700 bg-ink-800 px-2 py-1 font-data text-xs text-champagne ${FOCUS_RING}`}
              />
              <span className="text-xs text-muted">jours</span>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {conflictMessage && (
          <p role="alert" className="text-sm text-danger">
            {conflictMessage}
          </p>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass — no new pure logic in this task.

- [ ] **Step 6: Manual verification**

Start the app, create a task with "Hebdomadaire" recurrence (pick 2 weekdays), and confirm:
- The created task and its follow-up occurrences (up to 8 weeks out) appear on the Calendrier, all on the selected weekdays, all at the same time and duration.
- Creating a "Tous les N jours" (N=3) task produces occurrences exactly 3 days apart.
- Deliberately schedule a recurring task so one of its future occurrences lands on a time already occupied by another task — confirm the conflict message appears after submit and the task is still created (not blocked).
- A non-recurring task ("Aucune") behaves exactly as before this plan (single row, no extra generation).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/screens/NouvelleTache.tsx
git commit -m "feat: add a recurrence selector to task creation"
```

---

### Task 5: Rule editing from the calendar popover

**Files:**
- Create: `src/renderer/src/components/RecurrenceEditor.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `RecurrenceRule`, `RECURRENCE_WINDOW_DAYS`, `nextAnchorDate`, `generateOccurrences`, `detectConflicts`, `isNextOccurrenceInSeries` from `../lib/recurrence` (Task 2). Consumes `deleteEngagement` and `createEngagement` from `useEngagements()` (Task 1, already destructured for `createEngagement` by report-rapide's `handleSnooze`). Consumes `addDays` from `../lib/calendarLayout` (already imported in this file; `startOfDay` is also already imported there but not needed by this task).
- Produces: `RecurrenceEditor` component, `{ type, interval, weekdays, onChange }` props — used only by `TaskPopover` in this plan.
- Produces: `TaskPopover` gains `canEditRecurrence: boolean` and `onRecurrenceChange: (rule: RecurrenceRule) => void` props — final piece of this plan, nothing later consumes them.

- [ ] **Step 1: Create `RecurrenceEditor`**

Create `src/renderer/src/components/RecurrenceEditor.tsx`:

```tsx
import type { RecurrenceRule } from '../lib/recurrence';
import type { RecurrenceType } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'tous_les_n_jours', label: 'Tous les N jours' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
];

export default function RecurrenceEditor({
  type,
  interval,
  weekdays,
  onChange,
}: {
  type: RecurrenceType;
  interval: number | null;
  weekdays: number[] | null;
  onChange: (rule: RecurrenceRule) => void;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Récurrence</p>
      <div className="flex flex-wrap items-center gap-2">
        {RECURRENCE_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange({
                type: option.value,
                interval: option.value === 'tous_les_n_jours' ? interval ?? 2 : null,
                weekdays: option.value === 'hebdomadaire' ? weekdays ?? [] : null,
              })
            }
            aria-pressed={type === option.value}
            className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${type === option.value ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {type === 'hebdomadaire' && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {WEEKDAY_OPTIONS.map((day) => {
            const selected = (weekdays ?? []).includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() =>
                  onChange({
                    type,
                    interval,
                    weekdays: selected ? (weekdays ?? []).filter((d) => d !== day.value) : [...(weekdays ?? []), day.value],
                  })
                }
                aria-pressed={selected}
                className={`font-data text-xs px-2.5 py-1 transition-colors duration-150 ${FOCUS_RING} ${selected ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      )}
      {type === 'tous_les_n_jours' && (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={2}
            value={interval ?? 2}
            onChange={(e) => onChange({ type, interval: Math.max(2, Number(e.target.value) || 2), weekdays })}
            className={`w-16 border border-ink-700 bg-ink-800 px-2 py-1 font-data text-xs text-champagne ${FOCUS_RING}`}
          />
          <span className="text-xs text-muted">jours</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `RecurrenceEditor` into `TaskPopover`**

`src/renderer/src/components/TaskPopover.tsx` lines 1-33 currently read:

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
  onSnooze,
  error,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
  onSnooze: (mode: 'aujourdhui' | 'demain') => void;
  error: string | null;
}) {
```

Replace with:

```tsx
import RayCorner from './RayCorner';
import Button from './Button';
import RecurrenceEditor from './RecurrenceEditor';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { RecurrenceRule } from '../lib/recurrence';
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
  onSnooze,
  canEditRecurrence,
  onRecurrenceChange,
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
  error: string | null;
}) {
```

Then, the "Reporter" `<div>` block currently ends and is followed directly by the `error` paragraph:

```tsx
        <div className="relative flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Reporter</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSnooze('aujourdhui')}
              className={`font-data text-xs px-3 py-1.5 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Plus tard aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => onSnooze('demain')}
              className={`font-data text-xs px-3 py-1.5 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Demain
            </button>
          </div>
        </div>
        {error && (
```

Replace with:

```tsx
        <div className="relative flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Reporter</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSnooze('aujourdhui')}
              className={`font-data text-xs px-3 py-1.5 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Plus tard aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => onSnooze('demain')}
              className={`font-data text-xs px-3 py-1.5 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Demain
            </button>
          </div>
        </div>
        {canEditRecurrence && (
          <RecurrenceEditor
            type={task.recurrenceType}
            interval={task.recurrenceInterval}
            weekdays={task.recurrenceWeekdays}
            onChange={onRecurrenceChange}
          />
        )}
        {error && (
```

- [ ] **Step 3: Wire `handleChangeRecurrence` into `Calendrier.tsx`**

Line 7 currently reads:

```tsx
import { findNextFreeSlot } from '../lib/scheduling';
```

Replace with:

```tsx
import { findNextFreeSlot } from '../lib/scheduling';
import {
  RECURRENCE_WINDOW_DAYS,
  detectConflicts,
  generateOccurrences,
  isNextOccurrenceInSeries,
  nextAnchorDate,
  type RecurrenceRule,
} from '../lib/recurrence';
```

Then, the hook destructuring on line 32 currently reads:

```tsx
  const { engagements, error: engagementsError, setArchived, updateEngagement } = useEngagements();
```

Replace with:

```tsx
  const { engagements, error: engagementsError, setArchived, updateEngagement, createEngagement, deleteEngagement } = useEngagements();
```

Then, add a new state line directly after the existing `const [snoozeMessage, setSnoozeMessage] = useState<string | null>(null);` line:

```tsx
  const [snoozeMessage, setSnoozeMessage] = useState<string | null>(null);
  const [recurrenceMessage, setRecurrenceMessage] = useState<string | null>(null);
```

Then, directly after the existing `handleSnooze` function (before `handleCompleteTask`), add:

```tsx
  async function handleChangeRecurrence(taskId: string, rule: RecurrenceRule) {
    setActionError(null);
    setRecurrenceMessage(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task || !task.scheduledAt || !task.scheduledEndsAt) return;

    if (task.recurrenceSeriesId) {
      const siblings = activeEngagements.filter(
        (e) => e.recurrenceSeriesId === task.recurrenceSeriesId && e.id !== taskId
      );
      for (const sibling of siblings) {
        const { error: deleteError } = await deleteEngagement(sibling.id);
        if (deleteError) {
          setActionError(deleteError);
          return;
        }
      }
    }

    const seriesId = task.recurrenceSeriesId ?? crypto.randomUUID();
    const { error: updateError } = await updateEngagement(taskId, {
      recurrenceSeriesId: seriesId,
      recurrenceType: rule.type,
      recurrenceInterval: rule.interval,
      recurrenceWeekdays: rule.weekdays,
    });
    if (updateError) {
      setActionError(updateError);
      return;
    }

    setPopoverTask((current) =>
      current && current.id === taskId
        ? { ...current, recurrenceSeriesId: seriesId, recurrenceType: rule.type, recurrenceInterval: rule.interval, recurrenceWeekdays: rule.weekdays }
        : current
    );

    if (rule.type === 'aucune') return;

    const durationMs = new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime();
    const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
    const anchor = nextAnchorDate(rule, new Date(task.scheduledAt));
    const dates = generateOccurrences(rule, anchor, windowEnd);
    const occurrenceSlots = dates.map((date) => ({
      seriesId,
      scheduledAt: date.toISOString(),
      scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
    }));
    const otherTasks = activeEngagements.filter((e) => e.id !== taskId && e.recurrenceSeriesId !== seriesId);
    const conflicts = detectConflicts(occurrenceSlots, otherTasks);
    for (const slot of occurrenceSlots) {
      await createEngagement({
        name: task.name,
        tags: task.tags,
        priority: task.priority,
        scheduledAt: slot.scheduledAt,
        scheduledEndsAt: slot.scheduledEndsAt,
        recurrenceSeriesId: seriesId,
        recurrenceType: rule.type,
        recurrenceInterval: rule.interval,
        recurrenceWeekdays: rule.weekdays,
      });
    }
    if (conflicts.length > 0) {
      setRecurrenceMessage(
        `${conflicts.length} occurrence${conflicts.length > 1 ? 's' : ''} en conflit avec une autre tâche déjà planifiée.`
      );
    }
  }
```

Then, find the `snoozeMessage` banner:

```tsx
      {snoozeMessage && (
        <p role="status" className="text-sm text-accent-bright">
          {snoozeMessage}
        </p>
      )}
```

Add directly after it:

```tsx
      {recurrenceMessage && (
        <p role="alert" className="text-sm text-danger">
          {recurrenceMessage}
        </p>
      )}
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
          error={actionError}
        />
```

**Note:** `isNextOccurrenceInSeries` returns `false` for any task with `recurrenceType === 'aucune'` (see Task 2) — so a plain, never-recurring task never shows the editor at all, and only a task that IS the earliest non-archived occurrence of an actual series shows it. This matches the spec's "modifiable uniquement depuis la prochaine occurrence" exactly, with no separate "does this task recur at all" check needed at the call site.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass — no new pure logic in this task (the pure logic it calls was already tested in Task 2).

- [ ] **Step 6: Manual verification**

Start the app, create a recurring task (via Task 4's UI), then on the Calendrier:
- Open the **earliest** occurrence's popover — confirm the "Récurrence" editor appears, pre-filled with the current rule.
- Change the rule (e.g., quotidien → hebdomadaire with different days). Confirm: the other future occurrences of the old rule disappear from the calendar, new ones appear matching the new rule, and the popover's own occurrence reflects the change without needing to reopen it.
- Open a **later** (non-earliest) occurrence of the same series — confirm the "Récurrence" editor does NOT appear.
- Set the rule back to "Aucune" on the earliest occurrence — confirm all other future occurrences of that series are removed and no new ones are generated, leaving just the one task.
- Reload the app and confirm everything persisted correctly.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/RecurrenceEditor.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: edit a task's recurrence rule from the calendar popover"
```

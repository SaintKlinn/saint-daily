# Calendrier / agenda (sous-projet 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a week-view calendar/agenda screen to Saint Daily, where every scheduled task is a real time slot (start + end), created either through the existing task form or by clicking an empty slot on the grid.

**Architecture:** An additive migration adds `scheduled_ends_at` to `engagement` and a `show_practice_in_calendar` preference to `app_settings`. A new pure module (`lib/calendarLayout.ts`) computes week boundaries and block positions, TDD-covered. A new `Calendrier.tsx` screen renders a 7-day × 24-hour grid built from scratch (no calendar library), positioning task blocks with that pure module, joins the main nav, and reuses the existing `logEntry`/`setArchived` completion pattern from Accueil in a new lightweight popover. `NouvelleTache.tsx` gains a duration-preset selector (matching Pomodoro's existing preset pattern) so every task created from here on has both ends of its slot.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `motion/react`, `@supabase/supabase-js`, PostgreSQL (Supabase-hosted), Vitest

**Spec:** [docs/superpowers/specs/2026-09-07-calendrier-agenda-design.md](../specs/2026-09-07-calendrier-agenda-design.md)

## Global Constraints

- **Week view only** — no day/month views in this sub-project.
- **No calendar library** — hand-built grid, matching the rest of the app's convention of zero external UI dependencies.
- **No drag-and-drop, no editing an existing task** beyond "mark as done" — that's a future sub-project.
- **No recurrence, no scheduled notifications.**
- **A task created via the updated `NouvelleTache.tsx` always has both `scheduledAt` and `scheduledEndsAt`** — a "real slot" always has a start and an end.
- **`show_practice_in_calendar` defaults to `false`** — practice history is opt-in, off by default.
- **No comments explaining WHAT code does, only non-obvious WHY** — match the style already visible throughout these files.
- **French UI copy**, matching the rest of the app.

---

## Task 1: Migration and data-layer updates

**Files:**
- Create: `supabase/migrations/0005_calendar_agenda.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`
- Modify: `src/renderer/src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `Engagement.scheduledEndsAt: string | null`, `SkillAppSettings.showPracticeInCalendar: boolean`, `createEngagement`'s input gains an optional `scheduledEndsAt?: string | null`, `updateSettings`'s patch type accepts `showPracticeInCalendar`. Every later task relies on these exact names.

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0005_calendar_agenda.sql`:

```sql
-- Un « vrai créneau » a un début et une fin — scheduled_at seul (sous-projet
-- 1) ne suffit plus pour l'affichage calendrier. Additif, aucune donnée
-- existante n'est réécrite : les tâches déjà créées restent sans fin de
-- créneau et continuent de s'afficher normalement dans "Tâches à faire",
-- juste absentes du calendrier tant qu'aucune fin n'est connue.
begin;

alter table saint_daily.engagement add column scheduled_ends_at timestamptz;
alter table saint_daily.engagement add constraint engagement_scheduled_ends_at_check
  check (scheduled_ends_at is null or (scheduled_at is not null and scheduled_ends_at > scheduled_at));

alter table saint_daily.app_settings add column show_practice_in_calendar boolean not null default false;

commit;
```

- [ ] **Step 2: Update `lib/types.ts`**

Read `src/renderer/src/lib/types.ts`. Find:

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
  createdAt: string;
}
```

Find:

```ts
export interface SkillAppSettings {
  userId: string;
  reminderThresholdDays: number;
  notificationsEnabled: boolean;
  autoLaunchEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroCyclesBeforeLongBreak: number;
  pomodoroAutoAdvance: boolean;
}
```

Replace with:

```ts
export interface SkillAppSettings {
  userId: string;
  reminderThresholdDays: number;
  notificationsEnabled: boolean;
  autoLaunchEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroCyclesBeforeLongBreak: number;
  pomodoroAutoAdvance: boolean;
  showPracticeInCalendar: boolean;
}
```

- [ ] **Step 3: Update `hooks/useEngagements.ts`**

Read `src/renderer/src/hooks/useEngagements.ts`. Find:

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

Find:

```ts
  async function createEngagement(input: {
    name: string;
    tags: string[];
    genericLevel?: GenericLevel;
    notes?: string | null;
    scheduledAt?: string | null;
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

- [ ] **Step 4: Update `hooks/useSettings.ts`**

Read `src/renderer/src/hooks/useSettings.ts`. Find:

```ts
interface SettingsRow {
  user_id: string;
  reminder_threshold_days: number;
  notifications_enabled: boolean;
  auto_launch_enabled: boolean;
  pomodoro_work_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_cycles_before_long_break: number;
  pomodoro_auto_advance: boolean;
}

function fromRow(row: SettingsRow): SkillAppSettings {
  return {
    userId: row.user_id,
    reminderThresholdDays: row.reminder_threshold_days,
    notificationsEnabled: row.notifications_enabled,
    autoLaunchEnabled: row.auto_launch_enabled,
    pomodoroWorkMinutes: row.pomodoro_work_minutes,
    pomodoroShortBreakMinutes: row.pomodoro_short_break_minutes,
    pomodoroLongBreakMinutes: row.pomodoro_long_break_minutes,
    pomodoroCyclesBeforeLongBreak: row.pomodoro_cycles_before_long_break,
    pomodoroAutoAdvance: row.pomodoro_auto_advance,
  };
}
```

Replace with:

```ts
interface SettingsRow {
  user_id: string;
  reminder_threshold_days: number;
  notifications_enabled: boolean;
  auto_launch_enabled: boolean;
  pomodoro_work_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_cycles_before_long_break: number;
  pomodoro_auto_advance: boolean;
  show_practice_in_calendar: boolean;
}

function fromRow(row: SettingsRow): SkillAppSettings {
  return {
    userId: row.user_id,
    reminderThresholdDays: row.reminder_threshold_days,
    notificationsEnabled: row.notifications_enabled,
    autoLaunchEnabled: row.auto_launch_enabled,
    pomodoroWorkMinutes: row.pomodoro_work_minutes,
    pomodoroShortBreakMinutes: row.pomodoro_short_break_minutes,
    pomodoroLongBreakMinutes: row.pomodoro_long_break_minutes,
    pomodoroCyclesBeforeLongBreak: row.pomodoro_cycles_before_long_break,
    pomodoroAutoAdvance: row.pomodoro_auto_advance,
    showPracticeInCalendar: row.show_practice_in_calendar,
  };
}
```

Find:

```ts
    ...(patch.pomodoroAutoAdvance !== undefined ? { pomodoro_auto_advance: patch.pomodoroAutoAdvance } : {}),
  };
}
```

Replace with:

```ts
    ...(patch.pomodoroAutoAdvance !== undefined ? { pomodoro_auto_advance: patch.pomodoroAutoAdvance } : {}),
    ...(patch.showPracticeInCalendar !== undefined
      ? { show_practice_in_calendar: patch.showPracticeInCalendar }
      : {}),
  };
}
```

Find:

```ts
const DEFAULT_SETTINGS: Omit<SkillAppSettings, 'userId'> = {
  reminderThresholdDays: 5,
  notificationsEnabled: true,
  autoLaunchEnabled: true,
  pomodoroWorkMinutes: 25,
  pomodoroShortBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodoroCyclesBeforeLongBreak: 4,
  pomodoroAutoAdvance: true,
};
```

Replace with:

```ts
const DEFAULT_SETTINGS: Omit<SkillAppSettings, 'userId'> = {
  reminderThresholdDays: 5,
  notificationsEnabled: true,
  autoLaunchEnabled: true,
  pomodoroWorkMinutes: 25,
  pomodoroShortBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodoroCyclesBeforeLongBreak: 4,
  pomodoroAutoAdvance: true,
  showPracticeInCalendar: false,
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — these are additive changes (new optional fields), nothing existing breaks.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: PASS, 41/41 unchanged.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0005_calendar_agenda.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts src/renderer/src/hooks/useSettings.ts
git commit -m "feat: add scheduled_ends_at and the practice-history calendar preference"
```

This does **not** apply the migration to the live database — that's Task 6.

---

## Task 2: Pure calendar layout helpers (TDD)

**Files:**
- Create: `src/renderer/src/lib/calendarLayout.ts`
- Test: `src/renderer/src/lib/calendarLayout.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure, no data-layer dependency).
- Produces: `startOfWeek(reference: Date): Date`, `addDays(date: Date, days: number): Date`, `dayIndexInWeek(weekStart: Date, dateIso: string): number | null`, `blockPositionFromRange(startIso: string, endIso: string): {topPercent: number; heightPercent: number}`, `blockPositionFromDuration(startIso: string, durationMinutes: number): {topPercent: number; heightPercent: number}`. Task 4 and Task 5 both import from this file.

- [ ] **Step 1: Write the failing tests**

`src/renderer/src/lib/calendarLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfWeek } from './calendarLayout';

describe('startOfWeek', () => {
  it('returns the same Monday when given a Monday', () => {
    const monday = new Date(2026, 8, 7, 15, 30); // mardi... non, calculons: 7 sept 2026 est un lundi
    const result = startOfWeek(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls back to Monday when given a Wednesday', () => {
    const wednesday = new Date(2026, 8, 9, 10, 0);
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
  });

  it('rolls back to Monday when given a Sunday', () => {
    const sunday = new Date(2026, 8, 13, 23, 0);
    const result = startOfWeek(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
  });
});

describe('addDays', () => {
  it('adds positive days within the same month', () => {
    const start = new Date(2026, 8, 7);
    const result = addDays(start, 3);
    expect(result.getDate()).toBe(10);
    expect(result.getMonth()).toBe(8);
  });

  it('rolls over into the next month', () => {
    const start = new Date(2026, 8, 29);
    const result = addDays(start, 3);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(2);
  });

  it('supports negative days', () => {
    const start = new Date(2026, 8, 7);
    const result = addDays(start, -7);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(31);
  });
});

describe('dayIndexInWeek', () => {
  const weekStart = startOfWeek(new Date(2026, 8, 7));

  it('returns 0 for the week start itself', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 7, 9, 0).toISOString())).toBe(0);
  });

  it('returns 6 for the last day of the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 13, 23, 59).toISOString())).toBe(6);
  });

  it('returns 3 for a mid-week Thursday', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 10, 14, 0).toISOString())).toBe(3);
  });

  it('returns null for a date before the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 6, 23, 59).toISOString())).toBeNull();
  });

  it('returns null for a date after the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 14, 0, 0).toISOString())).toBeNull();
  });
});

describe('blockPositionFromDuration', () => {
  it('places a task starting at midnight at the top of the grid', () => {
    const { topPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 0, 0).toISOString(), 60);
    expect(topPercent).toBe(0);
  });

  it('places a task starting at noon at 50% down the grid', () => {
    const { topPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 12, 0).toISOString(), 30);
    expect(topPercent).toBeCloseTo(50, 5);
  });

  it('sizes a 30-minute task to roughly 2.08% of the day', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 30);
    expect(heightPercent).toBeCloseTo((30 / 1440) * 100, 5);
  });

  it('clamps a very short task to a minimum readable height', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 5);
    expect(heightPercent).toBeCloseTo((15 / 1440) * 100, 5);
  });

  it('never returns a negative height for a zero-or-negative duration', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 0);
    expect(heightPercent).toBeGreaterThan(0);
  });
});

describe('blockPositionFromRange', () => {
  it('derives the same result as blockPositionFromDuration for an equivalent start+end', () => {
    const start = new Date(2026, 8, 7, 9, 0);
    const end = new Date(2026, 8, 7, 9, 30);
    const fromRange = blockPositionFromRange(start.toISOString(), end.toISOString());
    const fromDuration = blockPositionFromDuration(start.toISOString(), 30);
    expect(fromRange.topPercent).toBeCloseTo(fromDuration.topPercent, 5);
    expect(fromRange.heightPercent).toBeCloseTo(fromDuration.heightPercent, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- calendarLayout`
Expected: FAIL with "Cannot find module './calendarLayout'" or similar — the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/renderer/src/lib/calendarLayout.ts`:

```ts
export function startOfWeek(reference: Date): Date {
  const day = reference.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Comparaison par composants de date locale plutôt que par arithmétique de
// millisecondes : un jour peut faire 23h ou 25h lors d'un changement
// d'heure, ce qui fausserait un simple `diffMs / DAY_MS`.
export function dayIndexInWeek(weekStart: Date, dateIso: string): number | null {
  const date = new Date(dateIso);
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    if (date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate()) {
      return i;
    }
  }
  return null;
}

export interface BlockPosition {
  topPercent: number;
  heightPercent: number;
}

const MINUTES_PER_DAY = 24 * 60;
// En dessous de 15 min affichées, le bloc devient illisible (juste un trait)
// — on préfère un bloc un peu trop grand à un bloc invisible.
const MIN_HEIGHT_PERCENT = (15 / MINUTES_PER_DAY) * 100;

export function blockPositionFromDuration(startIso: string, durationMinutes: number): BlockPosition {
  const start = new Date(startIso);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const topPercent = (startMinutes / MINUTES_PER_DAY) * 100;
  const heightPercent = Math.max((Math.max(0, durationMinutes) / MINUTES_PER_DAY) * 100, MIN_HEIGHT_PERCENT);
  return { topPercent, heightPercent };
}

export function blockPositionFromRange(startIso: string, endIso: string): BlockPosition {
  const durationMinutes = Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  return blockPositionFromDuration(startIso, durationMinutes);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- calendarLayout`
Expected: PASS, all tests green.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS, 41 previous + the new `calendarLayout.test.ts` tests, all green.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/calendarLayout.ts src/renderer/src/lib/calendarLayout.test.ts
git commit -m "feat: add pure week/block-position helpers for the calendar grid"
```

---

## Task 3: NouvelleTache — duration selector and URL pre-fill

**Files:**
- Modify: `src/renderer/src/screens/NouvelleTache.tsx`

**Interfaces:**
- Consumes: `createEngagement`'s `scheduledEndsAt` param (Task 1).
- Produces: nothing new for later tasks — Task 4's "click empty slot" flow relies on this screen accepting a `?scheduledAt=<ISO>` query param, which this task implements.

- [ ] **Step 1: Read the current file**

Read `src/renderer/src/screens/NouvelleTache.tsx` to confirm it still matches what's quoted below before editing.

- [ ] **Step 2: Replace the whole file**

`src/renderer/src/screens/NouvelleTache.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/');
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={2} />
      <div className="relative">
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouvelle tâche</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Ajouter une tâche</h1>
      </div>
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        <FormField label="Titre" value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Tags (optionnels, séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Perso, Urgent"
        />
        <FormField
          label="Planification"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
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

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 5: Manual dev-launch sanity check**

Run `npm run dev`. Navigate to `/#/taches/nouvelle` directly — confirm the duration presets render, default to 30 min highlighted, and creating a task works exactly as before (title + planification + a duration produces a task that appears on Accueil's "Tâches à faire"). Then navigate to `/#/taches/nouvelle?scheduledAt=2026-09-10T14%3A30%3A00.000Z` (a URL-encoded ISO string) — confirm the Planification field pre-fills to "10/09/2026 16:30" or your local-timezone equivalent of that instant, and duration still defaults to 30 min.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/NouvelleTache.tsx
git commit -m "feat: add a duration selector to task creation, pre-fillable from a URL"
```

---

## Task 4: Calendrier screen — week grid, navigation, empty-slot creation

**Files:**
- Create: `src/renderer/src/screens/Calendrier.tsx`
- Modify: `src/renderer/src/components/icons.tsx`
- Modify: `src/renderer/src/components/AppShell.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useEngagements()`, `blockPositionFromRange`/`dayIndexInWeek`/`startOfWeek`/`addDays` (Task 2).
- Produces: route `/calendrier`. Task 5 modifies `Calendrier.tsx` further to add the popover and the practice-history overlay — this task's job is a working read-only grid plus empty-slot creation.

- [ ] **Step 1: Add `CalendarIcon` to `components/icons.tsx`**

Read `src/renderer/src/components/icons.tsx`. Find the end of the file (after `CheckIcon`'s closing brace, currently the last export):

```ts
export function CheckIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}
```

Add immediately after it:

```ts

export function CalendarIcon({ size = 20, className }: IconProps) {
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
      <rect x="4" y="5.5" width="16" height="15" rx="1.5" />
      <path d="M4 10h16" />
      <path d="M8 3.5v3.5M16 3.5v3.5" />
    </svg>
  );
}
```

- [ ] **Step 2: Register the nav item in `components/AppShell.tsx`**

Read `src/renderer/src/components/AppShell.tsx`. Find:

```tsx
import { HomeIcon, ListIcon, GearIcon } from './icons';
import { colors } from '../theme/colors';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];
```

Replace with:

```tsx
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
```

- [ ] **Step 3: Register the route in `App.tsx`**

Read `src/renderer/src/App.tsx`. Find:

```tsx
import NouvelleTache from './screens/NouvelleTache';
import DetailSkill from './screens/DetailSkill';
```

Replace with:

```tsx
import NouvelleTache from './screens/NouvelleTache';
import Calendrier from './screens/Calendrier';
import DetailSkill from './screens/DetailSkill';
```

Find:

```tsx
          <Route path="taches/nouvelle" element={<NouvelleTache />} />
          <Route path="pomodoro" element={<Pomodoro />} />
```

Replace with:

```tsx
          <Route path="taches/nouvelle" element={<NouvelleTache />} />
          <Route path="calendrier" element={<Calendrier />} />
          <Route path="pomodoro" element={<Pomodoro />} />
```

- [ ] **Step 4: Create `screens/Calendrier.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { addDays, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import Button from '../components/Button';
import { ChevronLeftIcon } from '../components/icons';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_PX = 64; // doit rester en phase avec la classe Tailwind h-16 ci-dessous

export default function Calendrier() {
  const navigate = useNavigate();
  const { engagements, error: engagementsError } = useEngagements();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const scheduledTasks = useMemo(
    () => activeEngagements.filter((e) => e.scheduledAt && e.scheduledEndsAt),
    [activeEngagements]
  );

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekDaysList = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const tasksByDay = useMemo(() => {
    const byDay: Record<number, typeof scheduledTasks> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const task of scheduledTasks) {
      const index = dayIndexInWeek(weekStart, task.scheduledAt as string);
      if (index !== null) byDay[index].push(task);
    }
    return byDay;
  }, [scheduledTasks, weekStart]);

  const weekRangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }, [weekStart]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 7 * HOUR_ROW_PX;
  }, []);

  function handleEmptySlotClick(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    navigate(`/taches/nouvelle?scheduledAt=${encodeURIComponent(start.toISOString())}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-champagne">Calendrier</h1>
          <p className="mt-1 font-data text-[13px] text-muted">{weekRangeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Aujourd'hui
          </Button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
            className="flex h-9 w-9 items-center justify-center border border-ink-700 text-muted transition-colors hover:text-champagne"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
            className="flex h-9 w-9 items-center justify-center border border-ink-700 text-muted transition-colors hover:text-champagne"
          >
            <ChevronLeftIcon className="rotate-180" />
          </button>
        </div>
      </div>

      {engagementsError && (
        <p role="alert" className="text-sm text-danger">
          {engagementsError}
        </p>
      )}

      <div className="grid grid-cols-[50px_repeat(7,1fr)] border border-ink-700">
        <div />
        {weekDaysList.map((day, i) => (
          <div key={i} className="border-l border-ink-700 py-2 text-center">
            <p className="font-data text-[11px] uppercase text-muted">{DAY_LABELS[i]}</p>
            <p className="font-serif text-lg text-champagne">{day.getDate()}</p>
          </div>
        ))}
      </div>

      <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto border border-t-0 border-ink-700">
        <div className="grid grid-cols-[50px_repeat(7,1fr)]">
          <div>
            {HOURS.map((h) => (
              <div key={h} className="h-16 border-b border-ink-800 pr-2 text-right font-data text-[11px] text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {weekDaysList.map((day, dayIndex) => (
            <div key={dayIndex} className="relative border-l border-ink-800">
              {HOURS.map((h) => (
                <div
                  key={h}
                  onClick={() => handleEmptySlotClick(day, h)}
                  className="h-16 cursor-pointer border-b border-ink-800 hover:bg-ink-800/50"
                />
              ))}
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                return (
                  <div
                    key={task.id}
                    className="absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-1.5 py-0.5 text-left"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-sans text-[11px] font-semibold text-champagne">{task.name}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

This step ships the grid as read-only blocks (no click handler on the task block itself yet — clicking anywhere over a task block currently does nothing, since it's a `div`, not a `button`, so it won't trigger the underlying hour cell's `onClick` either). Task 5 turns these into clickable popovers.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 7: Manual dev-launch sanity check**

Run `npm run dev`. Confirm: "Calendrier" appears in the main nav between Skills and Réglages, with a calendar icon; clicking it navigates to `/calendrier` and shows the current week with today's date range in the header; a task created earlier (with a slot) appears as a block at roughly the right time on the right day; clicking Précédent/Suivant moves the header's date range by a week and updates which tasks show; clicking Aujourd'hui returns to the current week; clicking an empty grid cell navigates to `/taches/nouvelle` with the Planification field pre-filled to that hour.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/screens/Calendrier.tsx src/renderer/src/components/icons.tsx src/renderer/src/components/AppShell.tsx src/renderer/src/App.tsx
git commit -m "feat: add the calendar week view with navigation and empty-slot task creation"
```

---

## Task 5: Task popover and practice-history overlay

**Files:**
- Create: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `useEngagements()`'s `setArchived`, `usePracticeEntries(null)`'s `logEntry`, `useAllPracticeEntries`, `useSettings()`'s `settings`/`updateSettings` — all from Task 1 and the already-shipped sub-project 1 hooks.
- Produces: nothing further downstream — last task before the manual migration step.

- [ ] **Step 1: Create `components/TaskPopover.tsx`**

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

- [ ] **Step 2: Wire the popover and practice-history overlay into `Calendrier.tsx`**

Read the current `src/renderer/src/screens/Calendrier.tsx` (post-Task-4 state). Find:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { addDays, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import Button from '../components/Button';
import { ChevronLeftIcon } from '../components/icons';
```

Replace with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import Button from '../components/Button';
import TaskPopover from '../components/TaskPopover';
import { ChevronLeftIcon } from '../components/icons';
import type { Engagement } from '../lib/types';
```

Find:

```tsx
export default function Calendrier() {
  const navigate = useNavigate();
  const { engagements, error: engagementsError } = useEngagements();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const scheduledTasks = useMemo(
    () => activeEngagements.filter((e) => e.scheduledAt && e.scheduledEndsAt),
    [activeEngagements]
  );

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
```

Replace with (this adds every new hook call needed for this task, all of them independent of `weekStart`, so nothing here reads a variable before it's declared):

```tsx
export default function Calendrier() {
  const navigate = useNavigate();
  const { engagements, error: engagementsError, setArchived } = useEngagements();
  const { settings, updateSettings } = useSettings();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const scheduledTasks = useMemo(
    () => activeEngagements.filter((e) => e.scheduledAt && e.scheduledEndsAt),
    [activeEngagements]
  );
  const { entriesBySkill, refresh: refreshEntries } = useAllPracticeEntries(activeEngagements.map((e) => e.id));
  const { logEntry } = usePracticeEntries(null);
  const [popoverTask, setPopoverTask] = useState<Engagement | null>(null);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
```

Find (this is `tasksByDay`'s closing, immediately followed by `weekRangeLabel`'s opening — inserting `practiceEntriesByDay` here, rather than up near the top, is deliberate: it reads `weekStart`, which must already be declared, and by this point in the file it is):

```tsx
  const tasksByDay = useMemo(() => {
    const byDay: Record<number, typeof scheduledTasks> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const task of scheduledTasks) {
      const index = dayIndexInWeek(weekStart, task.scheduledAt as string);
      if (index !== null) byDay[index].push(task);
    }
    return byDay;
  }, [scheduledTasks, weekStart]);

  const weekRangeLabel = useMemo(() => {
```

Replace with:

```tsx
  const tasksByDay = useMemo(() => {
    const byDay: Record<number, typeof scheduledTasks> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const task of scheduledTasks) {
      const index = dayIndexInWeek(weekStart, task.scheduledAt as string);
      if (index !== null) byDay[index].push(task);
    }
    return byDay;
  }, [scheduledTasks, weekStart]);

  const practiceEntriesByDay = useMemo(() => {
    const byDay: Record<number, { id: string; skillName: string; practicedAt: string; durationMinutes: number }[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    if (!settings?.showPracticeInCalendar) return byDay;
    for (const skill of activeEngagements) {
      if (skill.scheduledAt) continue; // seuls les skills ont un historique de pratique, pas les tâches
      for (const entry of entriesBySkill[skill.id] ?? []) {
        const index = dayIndexInWeek(weekStart, entry.practicedAt);
        if (index !== null) {
          byDay[index].push({
            id: entry.id,
            skillName: skill.name,
            practicedAt: entry.practicedAt,
            durationMinutes: entry.durationMinutes,
          });
        }
      }
    }
    return byDay;
  }, [activeEngagements, entriesBySkill, settings?.showPracticeInCalendar, weekStart]);

  const weekRangeLabel = useMemo(() => {
```

Find (this is `handleEmptySlotClick`'s closing, immediately followed by the `return`):

```tsx
  function handleEmptySlotClick(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    navigate(`/taches/nouvelle?scheduledAt=${encodeURIComponent(start.toISOString())}`);
  }

  return (
```

Replace with:

```tsx
  function handleEmptySlotClick(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    navigate(`/taches/nouvelle?scheduledAt=${encodeURIComponent(start.toISOString())}`);
  }

  async function handleCompleteTask(taskId: string) {
    setCompleting(true);
    const { error } = await logEntry({ engagementId: taskId, durationMinutes: 0, note: null });
    if (error) {
      setActionError(error);
      setCompleting(false);
      return;
    }
    const { error: archiveError } = await setArchived(taskId, true);
    setCompleting(false);
    if (archiveError) {
      setActionError(archiveError);
      return;
    }
    setActionError(null);
    setPopoverTask(null);
    await refreshEntries();
  }

  return (
```

Find:

```tsx
      {engagementsError && (
        <p role="alert" className="text-sm text-danger">
          {engagementsError}
        </p>
      )}
```

Replace with:

```tsx
      {engagementsError && (
        <p role="alert" className="text-sm text-danger">
          {engagementsError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
```

Find:

```tsx
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Aujourd'hui
          </Button>
```

Replace with:

```tsx
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={settings?.showPracticeInCalendar ?? false}
              onChange={(e) => updateSettings({ showPracticeInCalendar: e.target.checked })}
            />
            Inclure l'historique de pratique
          </label>
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Aujourd'hui
          </Button>
```

Find:

```tsx
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                return (
                  <div
                    key={task.id}
                    className="absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-1.5 py-0.5 text-left"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-sans text-[11px] font-semibold text-champagne">{task.name}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Replace with:

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
              {practiceEntriesByDay[dayIndex].map((entry) => {
                const { topPercent, heightPercent } = blockPositionFromDuration(entry.practicedAt, entry.durationMinutes);
                return (
                  <div
                    key={entry.id}
                    className="absolute inset-x-0.5 overflow-hidden border border-ink-600 bg-ink-800/60 px-1.5 py-0.5 text-left opacity-70"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-data text-[10px] text-muted">{entry.skillName}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {popoverTask && (
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: PASS, unchanged (no new pure logic added in this task beyond what Task 2 already covers).

- [ ] **Step 5: Manual dev-launch sanity check**

Run `npm run dev`. Confirm: clicking a task block opens the popover with the correct title, tags, and time range; "Marquer comme faite" removes the block from the grid and the popover closes; "Fermer" or clicking outside the popover closes it without completing the task; checking "Inclure l'historique de pratique" shows completed practice sessions as muted, non-interactive blocks on the grid, and unchecking it hides them again; the preference survives a page reload (confirms it's persisted via `app_settings`, not local state).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: add the task popover and optional practice-history overlay to the calendar"
```

---

## Task 6: Apply the migration and verify end-to-end

**Files:** none (no code changes — this task applies what Task 1 already produced, against the real, live Supabase project).

**Interfaces:**
- Consumes: `supabase/migrations/0005_calendar_agenda.sql` (Task 1) and every code change from Tasks 2-5.
- Produces: nothing further downstream — this is the last task in the plan.

**⚠️ This task requires the real user, not just the implementer.** Applying SQL to the live database is an action only the user can take — the implementer must stop and ask for explicit confirmation before Step 1, the same way sub-project 1's migration was handled. Do not simulate, skip, or assume this happened.

- [ ] **Step 1: Ask the user to apply the migration to the live Supabase project**

Give the user this exact instruction: open the Supabase SQL editor for the project, and run **only** the contents of `supabase/migrations/0005_calendar_agenda.sql` — not the whole `migrations/` folder — in one execution (it's wrapped in `begin;`/`commit;`). Wait for the user to confirm the migration succeeded before continuing.

- [ ] **Step 2: Verify against the live database**

Launch the app (`npm run dev`) and, using the existing `/dev-login` mechanism, confirm:

- The Calendrier screen loads with no errors and shows the current week.
- Creating a task with a slot (via `/taches/nouvelle`'s duration presets, or by clicking an empty calendar cell) produces a task that appears correctly positioned on the grid.
- Opening the popover on that task and clicking "Marquer comme faite" removes it from the grid and it does not reappear after a page reload.
- Checking "Inclure l'historique de pratique" shows existing logged practice sessions as read-only blocks, without errors.
- Nothing on Accueil, `/skills`, or Pomodoro regressed (all of it depends on the same `engagement` table this migration alters).

If any of these fail, the fix belongs in whichever earlier task produced the mismatch — do not patch around it with a new, undocumented change in this task.

- [ ] **Step 3: Report the result**

No commit in this task (nothing new to commit — Tasks 1-5 already captured every file change). State clearly whether all checks in Step 2 passed. This is the final task of the plan.

---

## Self-Review

**Spec coverage:** Créneau début/fin sur `engagement` → Task 1. Vue semaine + navigation + grille faite maison → Task 4. Case "historique de pratique" (préférence `app_settings`, off par défaut) → Task 1 (colonne) + Task 5 (UI + overlay). Clic créneau vide → `/taches/nouvelle` pré-rempli → Task 4 + Task 3. Clic tâche existante → popover (voir + marquer comme faite, pas d'écran de détail) → Task 5. Sélecteur de durée sur le formulaire de tâche → Task 3. Item de nav principale entre Skills et Réglages → Task 4. Étape manuelle Supabase → Task 6. Hors scope (jour/mois, glisser-déposer, édition complète, récurrence, notifications, écosystème cross-app) → aucune tâche n'y touche. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate X" steps — every step shows real code. Caught one real defect on this pass: Task 5 Step 2's original find/replace ordering would have placed `practiceEntriesByDay`'s `useMemo` (which reads `weekStart`) textually before `weekStart`'s own `const` declaration — a genuine temporal-dead-zone crash, not a style nit. Restructured into three separately-targeted find/replace blocks so every new declaration lands after everything it reads. Also dropped an unused `skillId` field from the practice-history overlay's data in favor of `skillName`, which the block actually renders — the original design computed data nothing consumed.

**Type consistency:** `Engagement.scheduledEndsAt`/`SkillAppSettings.showPracticeInCalendar` (Task 1) match their use in `createEngagement` (Task 1), `NouvelleTache.tsx` (Task 3), and `Calendrier.tsx`/`TaskPopover.tsx` (Tasks 4-5) exactly. `blockPositionFromRange`/`blockPositionFromDuration`/`dayIndexInWeek`/`startOfWeek`/`addDays` (Task 2) match their call sites in `Calendrier.tsx` (Tasks 4-5) exactly — same names, same parameter order. `handleCompleteTask`'s `logEntry`/`setArchived` calls (Task 5) match the exact pattern and signatures already shipped in `Accueil.tsx` from sub-project 1. No drift found.

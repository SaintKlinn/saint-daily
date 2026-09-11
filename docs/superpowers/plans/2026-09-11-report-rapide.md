# Report Rapide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two one-click reschedule actions to a task's calendar popover — "Plus tard aujourd'hui" and "Demain" — each finding the next free calendar slot of the same duration and moving the task there.

**Architecture:** A pure, fully-testable scheduling function (`findNextFreeSlot`) computes the new slot from the task's current duration and the other tasks already on the calendar; the Calendrier screen owns calling it and persisting the result, exactly like it already owns priority changes and task completion. `TaskPopover` stays a thin presentational component that only calls back up.

**Tech Stack:** React 19 + TypeScript, Vitest for the pure logic, Supabase for persistence — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-taches-avancees-design.md` (section 1, "Report rapide")

## Global Constraints

- No working-hours restriction on the search: the whole day (0h–24h) is eligible, exactly as decided in the spec.
- "Plus tard aujourd'hui" searches starting from the current moment (not midnight) through the end of today, then cascades to later days if needed. "Demain" searches all of tomorrow (00:00–24:00), then cascades similarly.
- The found slot always has the same duration as the task's current `scheduledEndsAt - scheduledAt`.
- Search cascades day by day up to **30 days ahead**; beyond that, report failure rather than searching forever.
- Skills never factor into the search — only other tasks (engagements with both `scheduledAt` and `scheduledEndsAt` set).
- On success: close the popover and show a confirmation message with the new date/time. On failure (no slot found): keep the popover open, show an error, change nothing.
- This project's comment convention: no comments explaining WHAT code does, only non-obvious WHY.

---

### Task 1: `findNextFreeSlot` scheduling algorithm

**Files:**
- Modify: `src/renderer/src/lib/calendarLayout.ts` (add `startOfDay`, `endOfDay`)
- Modify: `src/renderer/src/lib/calendarLayout.test.ts` (tests for the two additions)
- Create: `src/renderer/src/lib/scheduling.ts`
- Create: `src/renderer/src/lib/scheduling.test.ts`

**Interfaces:**
- Produces: `startOfDay(date: Date): Date` and `endOfDay(date: Date): Date`, exported from `calendarLayout.ts` — Task 2 does not consume these directly (only `scheduling.ts` and `Calendrier.tsx`'s own `handleSnooze` do, via `startOfDay`).
- Produces: `export interface ExistingTaskSlot { scheduledAt: string; scheduledEndsAt: string }` and `export interface FreeSlot { scheduledAt: string; scheduledEndsAt: string }` and `export function findNextFreeSlot(fromDate: Date, durationMinutes: number, existingTasks: ExistingTaskSlot[], maxDaysAhead: number): FreeSlot | null`, exported from `scheduling.ts` — Task 2 imports and calls this exact signature.

- [ ] **Step 1: Write the failing tests for `startOfDay`/`endOfDay`**

Add to `src/renderer/src/lib/calendarLayout.test.ts`, after the existing `import` line, add `startOfDay` and `endOfDay` to the imported names:

```ts
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, endOfDay, startOfDay, startOfWeek } from './calendarLayout';
```

Then add these two new `describe` blocks anywhere after the existing ones:

```ts
describe('startOfDay', () => {
  it('zeroes the time components and keeps the same calendar day', () => {
    const result = startOfDay(new Date(2026, 8, 7, 15, 42, 10));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('endOfDay', () => {
  it('returns midnight at the start of the following day', () => {
    const result = endOfDay(new Date(2026, 8, 7, 15, 42, 10));
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(8);
    expect(result.getHours()).toBe(0);
  });

  it('rolls over into the next month at month end', () => {
    const result = endOfDay(new Date(2026, 8, 30, 10, 0));
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- calendarLayout`
Expected: FAIL — `startOfDay`/`endOfDay` are not exported from `./calendarLayout` yet.

- [ ] **Step 3: Implement `startOfDay` and `endOfDay`**

In `src/renderer/src/lib/calendarLayout.ts`, add these two functions directly after the existing `addDays` function (after its closing `}` on line 14):

```ts
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(24, 0, 0, 0);
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- calendarLayout`
Expected: PASS, all tests in this file green.

- [ ] **Step 5: Write the failing tests for `findNextFreeSlot`**

Create `src/renderer/src/lib/scheduling.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findNextFreeSlot, type ExistingTaskSlot } from './scheduling';

describe('findNextFreeSlot', () => {
  it('returns the requested slot unchanged when the day is completely free', () => {
    const from = new Date(2026, 8, 7, 14, 0);
    const result = findNextFreeSlot(from, 30, [], 30);
    expect(result).not.toBeNull();
    expect(result!.scheduledAt).toBe(from.toISOString());
    expect(new Date(result!.scheduledEndsAt).getTime() - from.getTime()).toBe(30 * 60_000);
  });

  it('returns the first gap after an existing task on the same day', () => {
    const from = new Date(2026, 8, 7, 9, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() },
    ];
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 7, 9, 30).toISOString());
  });

  it('skips a gap too small for the requested duration and returns the next one', () => {
    const from = new Date(2026, 8, 7, 9, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 10).toISOString() },
      { scheduledAt: new Date(2026, 8, 7, 9, 20).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 10, 0).toISOString() },
    ];
    // the gap between the two tasks (9:10-9:20) is only 10 minutes, too small for a 30-minute task
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 7, 10, 0).toISOString());
  });

  it('cascades to the next day when the current day has no free slot left', () => {
    const from = new Date(2026, 8, 7, 23, 50); // only 10 minutes left before midnight
    const result = findNextFreeSlot(from, 30, [], 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 8, 0, 0).toISOString());
  });

  it('returns null when no free slot exists within the day cap', () => {
    const from = new Date(2026, 8, 7, 0, 0);
    const existing: ExistingTaskSlot[] = Array.from({ length: 3 }, (_, i) => ({
      scheduledAt: new Date(2026, 8, 7 + i, 0, 0).toISOString(),
      scheduledEndsAt: new Date(2026, 8, 8 + i, 0, 0).toISOString(), // each task fills an entire day
    }));
    const result = findNextFreeSlot(from, 30, existing, 3);
    expect(result).toBeNull();
  });

  it('accounts for a task that started the previous day and overlaps into this one', () => {
    const from = new Date(2026, 8, 8, 0, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 23, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 8, 0, 20).toISOString() },
    ];
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 8, 0, 20).toISOString());
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm test -- scheduling`
Expected: FAIL with "Cannot find module './scheduling'" or similar — the file doesn't exist yet.

- [ ] **Step 7: Implement `findNextFreeSlot`**

Create `src/renderer/src/lib/scheduling.ts`:

```ts
import { addDays, endOfDay, startOfDay } from './calendarLayout';

export interface ExistingTaskSlot {
  scheduledAt: string;
  scheduledEndsAt: string;
}

export interface FreeSlot {
  scheduledAt: string;
  scheduledEndsAt: string;
}

// Day 0 starts exactly at `fromDate` (so "plus tard aujourd'hui" can't suggest
// a slot in the past); every later day starts at its own midnight instead.
export function findNextFreeSlot(
  fromDate: Date,
  durationMinutes: number,
  existingTasks: ExistingTaskSlot[],
  maxDaysAhead: number
): FreeSlot | null {
  const durationMs = durationMinutes * 60_000;

  for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
    const dayReference = dayOffset === 0 ? fromDate : addDays(fromDate, dayOffset);
    const windowStart = dayOffset === 0 ? fromDate : startOfDay(dayReference);
    const windowEnd = endOfDay(dayReference);

    const dayTasks = existingTasks
      .map((task) => ({ start: new Date(task.scheduledAt), end: new Date(task.scheduledEndsAt) }))
      .filter((task) => task.end > windowStart && task.start < windowEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = windowStart;
    for (const task of dayTasks) {
      if (task.start.getTime() - cursor.getTime() >= durationMs) {
        return {
          scheduledAt: cursor.toISOString(),
          scheduledEndsAt: new Date(cursor.getTime() + durationMs).toISOString(),
        };
      }
      if (task.end.getTime() > cursor.getTime()) cursor = task.end;
    }
    if (windowEnd.getTime() - cursor.getTime() >= durationMs) {
      return {
        scheduledAt: cursor.toISOString(),
        scheduledEndsAt: new Date(cursor.getTime() + durationMs).toISOString(),
      };
    }
  }

  return null;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- scheduling`
Expected: PASS, all 6 tests green.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions in any other test file.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/lib/calendarLayout.ts src/renderer/src/lib/calendarLayout.test.ts src/renderer/src/lib/scheduling.ts src/renderer/src/lib/scheduling.test.ts
git commit -m "feat: add findNextFreeSlot scheduling algorithm"
```

---

### Task 2: Wire "Plus tard aujourd'hui" / "Demain" into the calendar popover

**Files:**
- Modify: `src/renderer/src/hooks/useEngagements.ts:93-110` (`updateEngagement` gains `scheduledAt`/`scheduledEndsAt`)
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `findNextFreeSlot(fromDate, durationMinutes, existingTasks, maxDaysAhead): FreeSlot | null` and `ExistingTaskSlot` from `../lib/scheduling` (Task 1). Consumes `startOfDay(date: Date): Date` from `../lib/calendarLayout` (Task 1) — `Calendrier.tsx` already imports `addDays` from the same file.
- Produces: `TaskPopover` gains a new required prop `onSnooze: (mode: 'aujourdhui' | 'demain') => void` — no later task consumes this, it's the final piece of this plan.

- [ ] **Step 1: Extend `updateEngagement` to accept `scheduledAt`/`scheduledEndsAt`**

In `src/renderer/src/hooks/useEngagements.ts`, lines 93-110 currently read:

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
```

- [ ] **Step 2: Add the snooze buttons to `TaskPopover`**

In `src/renderer/src/components/TaskPopover.tsx`, lines 17-29 currently read:

```tsx
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
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
  onSnooze: (mode: 'aujourdhui' | 'demain') => void;
}) {
```

Then, lines 46-61 (the priority `<div>` block) currently end with:

```tsx
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
```

Add a new block directly after it (still before the `<div className="relative mt-2 flex justify-end gap-3">` buttons row):

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
```

- [ ] **Step 3: Wire `handleSnooze` into `Calendrier.tsx`**

In `src/renderer/src/screens/Calendrier.tsx`, line 6 currently reads:

```tsx
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
```

Replace with:

```tsx
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfDay, startOfWeek } from '../lib/calendarLayout';
import { findNextFreeSlot } from '../lib/scheduling';
```

Then, near the top of the file (after the existing `const HOUR_ROW_PX = 64;` line and before `export default function Calendrier()`), add:

```tsx
const MAX_SNOOZE_DAYS_AHEAD = 30;

function formatSnoozeConfirmation(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Reporté au ${day}, ${time}`;
}
```

Then, inside the `Calendrier` component, find the existing `const [actionError, setActionError] = useState<string | null>(null);` line and add a new state line directly after it:

```tsx
  const [actionError, setActionError] = useState<string | null>(null);
  const [snoozeMessage, setSnoozeMessage] = useState<string | null>(null);
```

Then, directly after the existing `handleChangePriority` function, add:

```tsx
  async function handleSnooze(taskId: string, mode: 'aujourdhui' | 'demain') {
    setSnoozeMessage(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task || !task.scheduledAt || !task.scheduledEndsAt) return;
    const durationMinutes = (new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime()) / 60_000;
    const now = new Date();
    const fromDate = mode === 'aujourdhui' ? now : startOfDay(addDays(now, 1));
    const otherTasks = scheduledTasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({ scheduledAt: t.scheduledAt as string, scheduledEndsAt: t.scheduledEndsAt as string }));
    const slot = findNextFreeSlot(fromDate, durationMinutes, otherTasks, MAX_SNOOZE_DAYS_AHEAD);
    if (!slot) {
      setActionError(`Aucun créneau libre dans les ${MAX_SNOOZE_DAYS_AHEAD} prochains jours.`);
      return;
    }
    const { error } = await updateEngagement(taskId, { scheduledAt: slot.scheduledAt, scheduledEndsAt: slot.scheduledEndsAt });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    setPopoverTask(null);
    setSnoozeMessage(formatSnoozeConfirmation(slot.scheduledAt));
  }
```

Then, find the block rendering `actionError`:

```tsx
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
```

Add directly after it:

```tsx
      {snoozeMessage && (
        <p role="status" className="text-sm text-accent-bright">
          {snoozeMessage}
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
        />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including Task 1's new `scheduling.test.ts` and the extended `calendarLayout.test.ts`.

- [ ] **Step 6: Manual verification**

Start the app, open the Calendrier, open a task's popover, and confirm:
- "Plus tard aujourd'hui" moves the task to the next free slot later today (or cascades to tomorrow if today has no room), closes the popover, and shows a confirmation message with the new date/time.
- "Demain" moves the task to the next free slot tomorrow (or cascades further if tomorrow is fully booked).
- The moved task's duration is unchanged.
- Reloading the app shows the task at its new time (persisted).
- With no free slot anywhere in the next 30 days (hard to test manually — a sanity check that the error path renders correctly is enough, e.g. by temporarily lowering `MAX_SNOOZE_DAYS_AHEAD` in a local, uncommitted edit while testing, then reverting).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/hooks/useEngagements.ts src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: add quick reschedule (plus tard aujourd'hui / demain) to the task popover"
```

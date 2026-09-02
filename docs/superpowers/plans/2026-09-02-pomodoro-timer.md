# Pomodoro Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skill-linked Pomodoro timer to Saint Daily: full work/break cycles, a persistent React context so the timer survives navigation, per-cycle checkpoint practice entries consolidated at Stop, and a pinnable always-on-top overlay window that mirrors the main window's timer state over IPC.

**Architecture:** The timer's state machine is a pure module (`lib/pomodoroLogic.ts`) with no React/Supabase/Electron dependency, wrapped by a React context (`PomodoroProvider`) mounted once above the authenticated routes so it survives screen navigation. The main window's renderer is the sole source of truth; it pushes state snapshots to the main process on every transition, which relays them to a second `BrowserWindow` (frameless, transparent, always-on-top) loading the same renderer bundle on a dedicated route with no `AppShell` chrome. Control actions (pause/resume/stop/advance) taken on the overlay flow back through main to the renderer, which is the only place state actually mutates.

**Tech Stack:** Electron (main/preload/renderer via `electron-vite`), React 19, TypeScript, Tailwind CSS, `motion/react` (already installed), `@supabase/supabase-js`, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-02-pomodoro-timer-design.md](../specs/2026-09-02-pomodoro-timer-design.md)

## Global Constraints

- **No new table** — checkpoints and the consolidated entry are ordinary `practice_entry` rows; session grouping lives only in renderer memory (`loggedEntryIds`), never in the database.
- **`skill_app_settings` gains 5 columns** (durations + auto-advance) — no RLS change, the existing owner policy already covers them.
- **The renderer (main window) is the single source of truth** — the overlay window never mutates state directly; every control action it sends is relayed back to the main window's renderer, which applies it.
- **Remaining time is always derived from an absolute `phaseEndsAt` timestamp**, never from an accumulated tick count — Chromium can throttle `setInterval` in occluded/hidden windows.
- **State is pushed to IPC only on transitions**, not every tick — both windows independently compute their own live countdown display from the shared `phaseEndsAt`/`remainingMsAtPause`.
- **Consolidation is two sequential Supabase calls (delete checkpoints, insert one summary row), not a transaction** — documented, accepted limitation for v1 (see spec).
- **French UI, same visual language as the rest of the app** — Emerald Ink/Champagne, IBM Plex Serif/Sans/Mono, `RayCorner`/gradient-card treatment, Motion-driven entrances. No new palette or component language.
- **Errors are translated with `toFrenchError`** (`src/renderer/src/lib/errors.ts`) at the point they enter state — never shown raw.
- **Windows-only** — `alwaysOnTop`/`skipTaskbar` behavior is verified on Windows only, matching the rest of the app.
- **Tests**: Vitest unit tests for the pure state machine only (`pomodoroLogic.test.ts`), matching the existing `streaks.test.ts` precedent. No automated test for the overlay `BrowserWindow` itself — verified manually in the real Electron app (a bare browser preview has no `window.api`, so it cannot exercise the overlay at all).

---

## Task 1: Supabase migration — Pomodoro settings columns

**Files:**
- Create: `supabase/migrations/0002_pomodoro_settings.sql`

**Interfaces:**
- Consumes: `skill_app_settings` table (existing, from `0001_saint_daily_tables.sql`).
- Produces: 5 new columns on `skill_app_settings` — consumed by Task 2.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_pomodoro_settings.sql`:

```sql
-- Réglages du minuteur Pomodoro, ajoutés à la table de réglages existante
-- (pas de nouvelle table — voir spec 2026-09-02-pomodoro-timer-design.md).
-- Valeurs par défaut = technique Pomodoro classique.

alter table skill_app_settings
  add column pomodoro_work_minutes int not null default 25 check (pomodoro_work_minutes > 0),
  add column pomodoro_short_break_minutes int not null default 5 check (pomodoro_short_break_minutes > 0),
  add column pomodoro_long_break_minutes int not null default 15 check (pomodoro_long_break_minutes > 0),
  add column pomodoro_cycles_before_long_break int not null default 4 check (pomodoro_cycles_before_long_break > 0),
  add column pomodoro_auto_advance boolean not null default true;
```

- [ ] **Step 2: Apply the migration**

Open the Supabase SQL editor for the project shared with Saint Gym, paste the file's contents, and run it once.
Expected: no errors; the 5 new columns appear on `skill_app_settings` in the Table Editor, existing rows backfilled with the defaults above.

- [ ] **Step 3: Verify**

Run in the SQL editor:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'skill_app_settings' and column_name like 'pomodoro_%'
order by column_name;
```

Expected: 5 rows, defaults matching the migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_pomodoro_settings.sql
git commit -m "Add Pomodoro settings columns to skill_app_settings"
```

---

## Task 2: Extend settings type and hook with Pomodoro fields

**Files:**
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: `skill_app_settings` columns (Task 1); existing `SkillAppSettings` interface and `useSettings()` hook (both already in the codebase).
- Produces: `SkillAppSettings` gains `pomodoroWorkMinutes`, `pomodoroShortBreakMinutes`, `pomodoroLongBreakMinutes`, `pomodoroCyclesBeforeLongBreak: number`, `pomodoroAutoAdvance: boolean` — consumed by Task 5 (durations source) and Task 9 (Réglages form).

- [ ] **Step 1: Extend the type**

In `src/renderer/src/lib/types.ts`, replace the `SkillAppSettings` interface:

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

- [ ] **Step 2: Extend the hook's row mapping, defaults, and patch shape**

In `src/renderer/src/hooks/useSettings.ts`, replace the `SettingsRow` interface, `fromRow`, `toRow`, and `DEFAULT_SETTINGS`:

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

function toRow(patch: Partial<Omit<SkillAppSettings, 'userId'>>) {
  return {
    ...(patch.reminderThresholdDays !== undefined ? { reminder_threshold_days: patch.reminderThresholdDays } : {}),
    ...(patch.notificationsEnabled !== undefined ? { notifications_enabled: patch.notificationsEnabled } : {}),
    ...(patch.autoLaunchEnabled !== undefined ? { auto_launch_enabled: patch.autoLaunchEnabled } : {}),
    ...(patch.pomodoroWorkMinutes !== undefined ? { pomodoro_work_minutes: patch.pomodoroWorkMinutes } : {}),
    ...(patch.pomodoroShortBreakMinutes !== undefined
      ? { pomodoro_short_break_minutes: patch.pomodoroShortBreakMinutes }
      : {}),
    ...(patch.pomodoroLongBreakMinutes !== undefined
      ? { pomodoro_long_break_minutes: patch.pomodoroLongBreakMinutes }
      : {}),
    ...(patch.pomodoroCyclesBeforeLongBreak !== undefined
      ? { pomodoro_cycles_before_long_break: patch.pomodoroCyclesBeforeLongBreak }
      : {}),
    ...(patch.pomodoroAutoAdvance !== undefined ? { pomodoro_auto_advance: patch.pomodoroAutoAdvance } : {}),
  };
}

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

Nothing else in the file changes — `refresh`, `updateSettings`, and the insert-on-first-visit fallback already spread `toRow(...)`, so they pick up the new columns automatically.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify live**

With the dev server running (`preview_start` on the `saint-daily-dev` launch config) and authenticated via `/#/dev-login`, open the browser console and run:

```js
fetch('/__dev-login-credentials').then(r => r.json()); // sanity: dev server still up
```

then navigate to `/#/reglages` and confirm the screen still renders without error (it doesn't read the new fields yet — this step only proves the hook didn't break the existing screen).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/types.ts src/renderer/src/hooks/useSettings.ts
git commit -m "Add Pomodoro duration/auto-advance fields to SkillAppSettings"
```

---

## Task 3: Pure Pomodoro state-machine module

**Files:**
- Create: `src/renderer/src/lib/pomodoroLogic.ts`
- Create: `src/renderer/src/lib/pomodoroLogic.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: types `PomodoroPhase`, `PomodoroStatus`, `PomodoroDurations`, `PomodoroSession`; functions `startSession`, `phaseDurationMinutes`, `nextPhase`, `completePhase`, `advancePhase`, `pauseSession`, `resumeSession`, `partialMinutesElapsed`, `consolidateDuration`, `checkpointNoteLabel` — all consumed by Task 5 (`PomodoroProvider`) and Task 6/7 (screens compute ring-fill fractions from `phaseDurationMinutes`).

- [ ] **Step 1: Write the failing tests**

`src/renderer/src/lib/pomodoroLogic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  checkpointNoteLabel,
  completePhase,
  consolidateDuration,
  nextPhase,
  partialMinutesElapsed,
  pauseSession,
  phaseDurationMinutes,
  resumeSession,
  startSession,
  type PomodoroDurations,
  type PomodoroSession,
} from './pomodoroLogic';

const durations: PomodoroDurations = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

function baseSession(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    skillId: 'skill-1',
    skillName: 'Piano',
    phase: 'work',
    status: 'running',
    cycleIndex: 0,
    phaseEndsAt: 0,
    remainingMsAtPause: null,
    loggedEntryIds: [],
    ...overrides,
  };
}

describe('startSession', () => {
  it('starts in the work phase, cycle 0, running, with no logged entries', () => {
    const now = Date.parse('2026-09-02T10:00:00Z');
    const session = startSession('skill-1', 'Piano', durations, now);
    expect(session.phase).toBe('work');
    expect(session.status).toBe('running');
    expect(session.cycleIndex).toBe(0);
    expect(session.phaseEndsAt).toBe(now + 25 * 60_000);
    expect(session.remainingMsAtPause).toBeNull();
    expect(session.loggedEntryIds).toEqual([]);
  });
});

describe('phaseDurationMinutes', () => {
  it('returns the right duration per phase', () => {
    expect(phaseDurationMinutes('work', durations)).toBe(25);
    expect(phaseDurationMinutes('shortBreak', durations)).toBe(5);
    expect(phaseDurationMinutes('longBreak', durations)).toBe(15);
  });
});

describe('nextPhase', () => {
  it('goes from work to a short break before the last cycle of the round', () => {
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 0 }), durations)).toEqual({
      phase: 'shortBreak',
      cycleIndex: 0,
    });
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 2 }), durations)).toEqual({
      phase: 'shortBreak',
      cycleIndex: 2,
    });
  });

  it('goes from work to a long break on the last cycle of the round', () => {
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 3 }), durations)).toEqual({
      phase: 'longBreak',
      cycleIndex: 3,
    });
  });

  it('goes from a short break back to work, incrementing the cycle index', () => {
    expect(nextPhase(baseSession({ phase: 'shortBreak', cycleIndex: 1 }), durations)).toEqual({
      phase: 'work',
      cycleIndex: 2,
    });
  });

  it('goes from a long break back to work, resetting the cycle index to 0', () => {
    expect(nextPhase(baseSession({ phase: 'longBreak', cycleIndex: 3 }), durations)).toEqual({
      phase: 'work',
      cycleIndex: 0,
    });
  });
});

describe('completePhase', () => {
  it('reports 25 logged minutes when a work phase completes, and auto-advances when asked', () => {
    const now = Date.parse('2026-09-02T10:25:00Z');
    const session = baseSession({ phase: 'work', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, true, now);
    expect(result.loggedMinutes).toBe(25);
    expect(result.next.phase).toBe('shortBreak');
    expect(result.next.status).toBe('running');
    expect(result.next.phaseEndsAt).toBe(now + 5 * 60_000);
  });

  it('reports 0 logged minutes when a break completes', () => {
    const now = Date.parse('2026-09-02T10:30:00Z');
    const session = baseSession({ phase: 'shortBreak', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, true, now);
    expect(result.loggedMinutes).toBe(0);
    expect(result.next.phase).toBe('work');
    expect(result.next.cycleIndex).toBe(1);
  });

  it('sets status to awaitingAdvance and does not set a new phaseEndsAt when auto-advance is off', () => {
    const now = Date.parse('2026-09-02T10:25:00Z');
    const session = baseSession({ phase: 'work', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, false, now);
    expect(result.next.status).toBe('awaitingAdvance');
    expect(result.next.phase).toBe('shortBreak');
    expect(result.next.phaseEndsAt).toBe(now); // unchanged, unused while awaitingAdvance
  });
});

describe('advancePhase', () => {
  it('starts the current (already-updated) phase running from now', () => {
    const now = Date.parse('2026-09-02T10:26:00Z');
    const session = baseSession({ phase: 'shortBreak', status: 'awaitingAdvance', phaseEndsAt: 0 });
    const result = advancePhase(session, durations, now);
    expect(result.status).toBe('running');
    expect(result.phaseEndsAt).toBe(now + 5 * 60_000);
  });
});

describe('pauseSession / resumeSession', () => {
  it('freezes the remaining time on pause and recomputes phaseEndsAt on resume', () => {
    const phaseEndsAt = Date.parse('2026-09-02T10:25:00Z');
    const pauseAt = Date.parse('2026-09-02T10:10:00Z'); // 15 min remaining
    const session = baseSession({ phaseEndsAt });
    const paused = pauseSession(session, pauseAt);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMsAtPause).toBe(15 * 60_000);

    const resumeAt = Date.parse('2026-09-02T10:12:00Z');
    const resumed = resumeSession(paused, resumeAt);
    expect(resumed.status).toBe('running');
    expect(resumed.remainingMsAtPause).toBeNull();
    expect(resumed.phaseEndsAt).toBe(resumeAt + 15 * 60_000);
  });
});

describe('partialMinutesElapsed', () => {
  it('rounds elapsed time to the nearest minute while running', () => {
    const now = Date.parse('2026-09-02T10:12:40Z'); // 12m40s into a 25m phase
    const session = baseSession({ phaseEndsAt: now + (25 * 60_000 - (12 * 60_000 + 40_000)) });
    expect(partialMinutesElapsed(session, durations, now)).toBe(13);
  });

  it('returns 0 when less than 30 seconds have elapsed', () => {
    const now = Date.parse('2026-09-02T10:00:20Z');
    const session = baseSession({ phaseEndsAt: now + (25 * 60_000 - 20_000) });
    expect(partialMinutesElapsed(session, durations, now)).toBe(0);
  });

  it('uses remainingMsAtPause instead of the clock when paused', () => {
    const session = baseSession({
      status: 'paused',
      phaseEndsAt: 0,
      remainingMsAtPause: 25 * 60_000 - 15 * 60_000, // 15 minutes elapsed
    });
    expect(partialMinutesElapsed(session, durations, Date.parse('2026-09-02T12:00:00Z'))).toBe(15);
  });

  it('returns 0 (not negative) for a break phase treated as work by mistake is out of scope; only work is ever queried', () => {
    const session = baseSession({ phase: 'work', phaseEndsAt: Date.parse('2026-09-02T10:25:00Z') });
    expect(partialMinutesElapsed(session, durations, Date.parse('2026-09-02T10:25:00Z'))).toBe(0);
  });
});

describe('consolidateDuration', () => {
  it('sums the logged minutes', () => {
    expect(consolidateDuration([25, 25, 13])).toBe(63);
  });

  it('returns 0 for no logged minutes', () => {
    expect(consolidateDuration([])).toBe(0);
  });
});

describe('checkpointNoteLabel', () => {
  it('formats as cycle N/M, 1-based', () => {
    expect(checkpointNoteLabel(0, 4)).toBe('Pomodoro — cycle 1/4');
    expect(checkpointNoteLabel(3, 4)).toBe('Pomodoro — cycle 4/4');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/src/lib/pomodoroLogic.test.ts`
Expected: FAIL — `Cannot find module './pomodoroLogic'`.

- [ ] **Step 3: Write the implementation**

`src/renderer/src/lib/pomodoroLogic.ts`:

```ts
// Machine à états pure du minuteur Pomodoro — aucune dépendance React/
// Supabase/Electron, pour rester testable en isolation (voir spec, section
// "Machine à états"). `usePomodoro` (hooks/PomodoroProvider) est la seule
// couche qui appelle Supabase et l'IPC ; ce module ne fait que calculer.

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'awaitingAdvance';

export interface PomodoroDurations {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface PomodoroSession {
  skillId: string;
  skillName: string; // dénormalisé pour l'overlay, qui n'a pas accès à useSkills
  phase: PomodoroPhase;
  status: PomodoroStatus;
  cycleIndex: number; // 0-based, remis à 0 après chaque pause longue
  phaseEndsAt: number; // epoch ms, recalculé à chaque (re)départ de phase
  remainingMsAtPause: number | null;
  loggedEntryIds: string[]; // practice_entry créées cette session, pour la consolidation
}

export function startSession(
  skillId: string,
  skillName: string,
  durations: PomodoroDurations,
  now: number = Date.now()
): PomodoroSession {
  return {
    skillId,
    skillName,
    phase: 'work',
    status: 'running',
    cycleIndex: 0,
    phaseEndsAt: now + durations.workMinutes * 60_000,
    remainingMsAtPause: null,
    loggedEntryIds: [],
  };
}

export function phaseDurationMinutes(phase: PomodoroPhase, durations: PomodoroDurations): number {
  if (phase === 'work') return durations.workMinutes;
  if (phase === 'shortBreak') return durations.shortBreakMinutes;
  return durations.longBreakMinutes;
}

/** Phase + cycleIndex après que la phase COURANTE se termine normalement. */
export function nextPhase(
  session: PomodoroSession,
  durations: PomodoroDurations
): { phase: PomodoroPhase; cycleIndex: number } {
  if (session.phase === 'work') {
    const isLastCycleOfRound = session.cycleIndex + 1 >= durations.cyclesBeforeLongBreak;
    return isLastCycleOfRound
      ? { phase: 'longBreak', cycleIndex: session.cycleIndex }
      : { phase: 'shortBreak', cycleIndex: session.cycleIndex };
  }
  // N'importe quelle pause -> retour au travail ; une pause longue remet le
  // compteur de cycle à 0 pour la nouvelle série, une pause courte l'incrémente.
  return { phase: 'work', cycleIndex: session.phase === 'longBreak' ? 0 : session.cycleIndex + 1 };
}

export interface PhaseCompletionResult {
  /** Minutes à checkpointer pour la phase qui vient de se terminer (0 pour une pause). */
  loggedMinutes: number;
  next: PomodoroSession;
}

/**
 * Applique la transition quand le décompte de la phase courante atteint 0.
 * `autoAdvance` vient de `settings.pomodoroAutoAdvance` : si faux, la
 * session passe en `awaitingAdvance` avec la phase suivante déjà posée
 * (pour l'affichage : "Pause courte — prêt à commencer"), mais sans
 * `phaseEndsAt` recalculé — `advancePhase` s'en charge au clic.
 */
export function completePhase(
  session: PomodoroSession,
  durations: PomodoroDurations,
  autoAdvance: boolean,
  now: number = Date.now()
): PhaseCompletionResult {
  const loggedMinutes = session.phase === 'work' ? phaseDurationMinutes('work', durations) : 0;
  const { phase, cycleIndex } = nextPhase(session, durations);
  if (autoAdvance) {
    return {
      loggedMinutes,
      next: {
        ...session,
        phase,
        cycleIndex,
        status: 'running',
        phaseEndsAt: now + phaseDurationMinutes(phase, durations) * 60_000,
        remainingMsAtPause: null,
      },
    };
  }
  return {
    loggedMinutes,
    next: { ...session, phase, cycleIndex, status: 'awaitingAdvance', remainingMsAtPause: null },
  };
}

/** Démarre la phase déjà posée par `completePhase` en mode manuel (bouton "Commencer"). */
export function advancePhase(
  session: PomodoroSession,
  durations: PomodoroDurations,
  now: number = Date.now()
): PomodoroSession {
  return {
    ...session,
    status: 'running',
    phaseEndsAt: now + phaseDurationMinutes(session.phase, durations) * 60_000,
  };
}

export function pauseSession(session: PomodoroSession, now: number = Date.now()): PomodoroSession {
  return { ...session, status: 'paused', remainingMsAtPause: Math.max(0, session.phaseEndsAt - now) };
}

export function resumeSession(session: PomodoroSession, now: number = Date.now()): PomodoroSession {
  const remaining = session.remainingMsAtPause ?? 0;
  return { ...session, status: 'running', phaseEndsAt: now + remaining, remainingMsAtPause: null };
}

/**
 * Minutes écoulées dans la phase COURANTE (non terminée), arrondies à la
 * minute la plus proche — utilisé au Stop pour créditer un cycle de travail
 * interrompu (voir spec, "Cycle interrompu").
 */
export function partialMinutesElapsed(
  session: PomodoroSession,
  durations: PomodoroDurations,
  now: number = Date.now()
): number {
  const totalMs = phaseDurationMinutes(session.phase, durations) * 60_000;
  const remainingMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - now);
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  return Math.round(elapsedMs / 60_000);
}

/** Somme des minutes déjà checkpointées (+ l'éventuelle minute partielle) pour l'entrée consolidée. */
export function consolidateDuration(loggedMinutes: number[]): number {
  return loggedMinutes.reduce((sum, m) => sum + m, 0);
}

export function checkpointNoteLabel(cycleIndex: number, cyclesBeforeLongBreak: number): string {
  return `Pomodoro — cycle ${cycleIndex + 1}/${cyclesBeforeLongBreak}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/src/lib/pomodoroLogic.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/pomodoroLogic.ts src/renderer/src/lib/pomodoroLogic.test.ts
git commit -m "Add pure Pomodoro state-machine module with tests"
```

---

## Task 4: Preload IPC bridge + main-process overlay window

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Create: `src/main/pomodoroOverlay.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: nothing new from this plan (uses only `electron` APIs already in use by `src/main/index.ts`/`src/main/tray.ts`).
- Produces: `window.api.pomodoro` (`reportState`, `onState`, `sendControl`, `onControl`, `setPinned`) — consumed by Task 5 (`PomodoroProvider`) and Task 6 (`PomodoroOverlay` screen). `createPomodoroOverlay(getMainWindow)` (`src/main/pomodoroOverlay.ts`) — consumed by `src/main/index.ts`'s startup sequence.

**Note on typing:** the preload script (Node/CJS context, `tsconfig.node.json`) cannot import types from `src/renderer/src/lib/pomodoroLogic.ts` (outside its `tsconfig.node.json` `include`). `env.d.ts` therefore declares the snapshot shape as an inline structural type — it must be kept in sync by hand with `PomodoroSession`/`PomodoroDurations` in `lib/pomodoroLogic.ts` (Task 3) if either changes.

- [ ] **Step 1: Extend the preload script**

In `src/preload/index.ts`, replace the file:

```ts
import { contextBridge, ipcRenderer } from 'electron';

// Pont IPC : connexion dev auto (voir src/main/devLogin.ts), tray/auto-launch
// (voir src/main/tray.ts et src/main/autoLaunch.ts), et le minuteur Pomodoro
// (voir src/main/pomodoroOverlay.ts). Un seul preload pour les deux fenêtres
// (principale et overlay) — la fenêtre overlay n'appelle simplement jamais
// getDevLoginCredentials/setAutoLaunch.
const api = {
  getDevLoginCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke('get-dev-login-credentials'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('get-auto-launch'),
  pomodoro: {
    // Fenêtre principale -> main -> overlay : diffuse un instantané à
    // chaque transition (jamais à chaque tick, voir Global Constraints).
    reportState: (state: PomodoroStateSnapshot | null): void => {
      ipcRenderer.send('pomodoro:state-changed', state);
    },
    // Overlay : écoute les instantanés relayés par main.
    onState: (callback: (state: PomodoroStateSnapshot | null) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: PomodoroStateSnapshot | null) => callback(state);
      ipcRenderer.on('pomodoro:state', listener);
      return () => ipcRenderer.removeListener('pomodoro:state', listener);
    },
    // Overlay -> main -> fenêtre principale : une action de contrôle.
    sendControl: (action: PomodoroControlAction): void => {
      ipcRenderer.send('pomodoro:control', action);
    },
    // Fenêtre principale : écoute les actions de contrôle relayées par main.
    onControl: (callback: (action: PomodoroControlAction) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, action: PomodoroControlAction) => callback(action);
      ipcRenderer.on('pomodoro:control', listener);
      return () => ipcRenderer.removeListener('pomodoro:control', listener);
    },
    // Fenêtre principale : montre/cache la fenêtre overlay.
    setPinned: (pinned: boolean): void => {
      ipcRenderer.send('pomodoro:set-pinned', pinned);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
```

- [ ] **Step 2: Declare the shared IPC types on `window`**

In `src/renderer/src/env.d.ts`, replace the file:

```ts
/// <reference types="vite/client" />

// Doit rester synchronisé à la main avec PomodoroSession/PomodoroDurations
// de src/renderer/src/lib/pomodoroLogic.ts — le preload (contexte Node,
// tsconfig.node.json) ne peut pas importer un type du renderer
// (tsconfig.web.json). Voir Task 4 du plan Pomodoro pour le détail.
export interface PomodoroStateSnapshot {
  session: {
    skillId: string;
    skillName: string;
    phase: 'work' | 'shortBreak' | 'longBreak';
    status: 'idle' | 'running' | 'paused' | 'awaitingAdvance';
    cycleIndex: number;
    phaseEndsAt: number;
    remainingMsAtPause: number | null;
    loggedEntryIds: string[];
  };
  durations: {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    cyclesBeforeLongBreak: number;
  };
}

export type PomodoroControlAction = 'pause' | 'resume' | 'stop' | 'advance';

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
}

declare global {
  interface Window {
    api: SaintDailyApi;
  }
}
```

- [ ] **Step 3: Write the overlay window module**

`src/main/pomodoroOverlay.ts`:

```ts
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';

const OVERLAY_WIDTH = 300;
const OVERLAY_HEIGHT = 84;

let overlayWindow: BrowserWindow | null = null;

function buildOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + workArea.width - OVERLAY_WIDTH - 24,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 'screen-saver' reste au-dessus des fenêtres plein écran d'autres apps,
  // pas seulement des fenêtres normales (niveau 'floating' par défaut).
  win.setAlwaysOnTop(true, 'screen-saver');

  // Se cacher plutôt que se détruire quand on la ferme (aucun bouton de
  // fermeture n'existe dans l'UI overlay elle-même, mais Alt+F4/fermeture
  // système doivent quand même la laisser réutilisable) — même raison que
  // win.hide() sur la fenêtre principale (src/main/index.ts).
  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/pomodoro-overlay`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pomodoro-overlay' });
  }

  return win;
}

/**
 * Crée la fenêtre overlay (cachée par défaut) et branche le relais IPC
 * bidirectionnel entre elle et la fenêtre principale. À appeler une fois au
 * démarrage, après createWindow() — voir src/main/index.ts.
 */
export function createPomodoroOverlay(getMainWindow: () => BrowserWindow | null): void {
  overlayWindow = buildOverlayWindow();

  // Fenêtre principale -> overlay : relaie chaque instantané d'état.
  ipcMain.on('pomodoro:state-changed', (_event, state) => {
    overlayWindow?.webContents.send('pomodoro:state', state);
  });

  // Overlay -> fenêtre principale : relaie chaque action de contrôle. La
  // fenêtre principale reste la seule à muter réellement l'état (voir spec).
  ipcMain.on('pomodoro:control', (_event, action) => {
    getMainWindow()?.webContents.send('pomodoro:control', action);
  });

  // Bouton "épingler" de la fenêtre principale : montre/cache l'overlay,
  // indépendamment de l'état réduit/visible de la fenêtre principale.
  ipcMain.on('pomodoro:set-pinned', (_event, pinned: boolean) => {
    if (pinned) overlayWindow?.show();
    else overlayWindow?.hide();
  });
}
```

- [ ] **Step 4: Wire it into the main process startup**

In `src/main/index.ts`, add the import and the startup call:

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerDevLoginHandler } from './devLogin';
import { createTray } from './tray';
import { registerAutoLaunchHandlers } from './autoLaunch';
import { createPomodoroOverlay } from './pomodoroOverlay';
```

and inside the `app.whenReady().then(...)` block, after `mainWindow = createWindow();`:

```ts
    mainWindow = createWindow();
    registerDevLoginHandler();
    registerAutoLaunchHandlers();
    createPomodoroOverlay(() => mainWindow);
    createTray(() => mainWindow);
```

(The rest of `src/main/index.ts` — `app.on('activate', ...)`, the `.catch(...)`, `before-quit`, `window-all-closed` — is unchanged.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors. Nothing calls `window.api.pomodoro.*` yet (Task 5 adds the first caller); this task only needs the types and the IPC plumbing to compile cleanly on their own.

- [ ] **Step 6: Verify the overlay window boots (real Electron app required — not the bare browser preview)**

This cannot be checked through `preview_start`/a browser tab: `window.api` (and therefore the whole overlay bootstrap) does not exist outside Electron's preload bridge. Run `npm run dev` (the real Electron app), open the DevTools console of the main window, and run:

```js
window.api.pomodoro.setPinned(true);
```

Expected: a small borderless window appears near the top-right of the screen (blank — `PomodoroOverlay` doesn't exist until Task 6, so it shows whatever `#/pomodoro-overlay` currently resolves to, likely a blank or `Introuvable`-routed screen; that's fine, this step only proves the window itself opens, stays on top of other apps, and has no taskbar entry). Run `window.api.pomodoro.setPinned(false)` — expected: it disappears. Close the app afterward.

- [ ] **Step 7: Commit**

```bash
git add src/preload/index.ts src/renderer/src/env.d.ts src/main/pomodoroOverlay.ts src/main/index.ts
git commit -m "Add Pomodoro IPC bridge and the overlay BrowserWindow"
```

---

## Task 5: `PomodoroProvider` — stateful context, Supabase checkpoints, notifications

**Files:**
- Create: `src/renderer/src/lib/pomodoro.tsx`

**Interfaces:**
- Consumes: `pomodoroLogic.ts` (Task 3); `getSupabaseClient` (`lib/supabase.ts`), `useAuth` (`lib/auth.tsx`), `toFrenchError` (`lib/errors.ts`), `useSettings` (Task 2) — all existing/already-modified; `window.api.pomodoro.*` (Task 4).
- Produces: `PomodoroProvider` (React component, wraps children); `usePomodoro(): PomodoroContextValue` where:

```ts
interface PomodoroContextValue {
  session: PomodoroSession | null;
  durations: PomodoroDurations | null; // null until settings load
  note: string;
  setNote: (note: string) => void;
  error: string | null;
  pinned: boolean;
  start: (skillId: string, skillName: string) => void;
  pause: () => void;
  resume: () => void;
  advance: () => void;
  stop: () => Promise<void>;
  setPinned: (pinned: boolean) => void;
}
```

Consumed by Task 6 (`PomodoroOverlay` does NOT use this — see note below), Task 7 (`Pomodoro` screen), Task 8 (Accueil/DetailSkill start buttons), and `App.tsx` (mounts the provider once, above `AppShell`, inside `AuthGate` — **not** on the `/pomodoro-overlay` route, which talks to `window.api.pomodoro` directly instead of instantiating a second, disconnected timer).

- [ ] **Step 1: Write the provider and hook**

`src/renderer/src/lib/pomodoro.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSupabaseClient } from './supabase';
import { useAuth } from './auth';
import { toFrenchError } from './errors';
import { useSettings } from '../hooks/useSettings';
import {
  advancePhase,
  checkpointNoteLabel,
  completePhase,
  consolidateDuration,
  partialMinutesElapsed,
  pauseSession,
  resumeSession,
  startSession,
  type PomodoroDurations,
  type PomodoroSession,
} from './pomodoroLogic';

export type PomodoroControlAction = 'pause' | 'resume' | 'stop' | 'advance';

interface PomodoroContextValue {
  session: PomodoroSession | null;
  durations: PomodoroDurations | null;
  note: string;
  setNote: (note: string) => void;
  error: string | null;
  pinned: boolean;
  start: (skillId: string, skillName: string) => void;
  pause: () => void;
  resume: () => void;
  advance: () => void;
  stop: () => Promise<void>;
  setPinned: (pinned: boolean) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { session: authSession } = useAuth();
  const { settings } = useSettings();
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinnedState] = useState(false);

  // Toujours la dernière valeur dans le setInterval du tick, sans le
  // remettre en place à chaque changement de session (voir Step 2).
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const durations: PomodoroDurations | null = settings
    ? {
        workMinutes: settings.pomodoroWorkMinutes,
        shortBreakMinutes: settings.pomodoroShortBreakMinutes,
        longBreakMinutes: settings.pomodoroLongBreakMinutes,
        cyclesBeforeLongBreak: settings.pomodoroCyclesBeforeLongBreak,
      }
    : null;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;

  // Notifie le process main à chaque transition, pour relais vers l'overlay
  // (voir Task 4) — pas à chaque tick, cf. Global Constraints.
  useEffect(() => {
    window.api?.pomodoro?.reportState?.(
      session && durationsRef.current ? { session, durations: durationsRef.current } : null
    );
  }, [session]);

  const logCheckpoint = useCallback(
    async (minutes: number, cycleIndex: number, cyclesBeforeLongBreak: number, skillId: string) => {
      if (!authSession || minutes <= 0) return;
      const { data, error: insertError } = await getSupabaseClient()
        .from('practice_entry')
        .insert({
          skill_id: skillId,
          user_id: authSession.user.id,
          duration_minutes: minutes,
          note: checkpointNoteLabel(cycleIndex, cyclesBeforeLongBreak),
        })
        .select('id')
        .single();
      if (insertError) {
        setError(toFrenchError(insertError.message));
        return;
      }
      setSession((current) =>
        current ? { ...current, loggedEntryIds: [...current.loggedEntryIds, data.id as string] } : current
      );
    },
    [authSession]
  );

  const notifyPhaseChange = useCallback(
    (phase: PomodoroSession['phase'], skillName: string) => {
      if (!settings?.notificationsEnabled || typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') Notification.requestPermission();
      if (Notification.permission !== 'granted') return;
      const label = phase === 'work' ? 'Travail' : phase === 'shortBreak' ? 'Pause courte' : 'Pause longue';
      new Notification('Saint Daily', { body: `${label} — ${skillName}` });
    },
    [settings?.notificationsEnabled]
  );

  // Tick : vérifie chaque seconde si la phase en cours vient de se
  // terminer. Ne pousse PAS d'état à chaque tick (l'affichage local de
  // chaque fenêtre se recalcule depuis phaseEndsAt) — seulement au moment
  // d'une transition réelle.
  useEffect(() => {
    if (!session || session.status !== 'running' || !durations) return;
    const id = window.setInterval(() => {
      const current = sessionRef.current;
      const currentDurations = durationsRef.current;
      if (!current || current.status !== 'running' || !currentDurations) return;
      if (Date.now() < current.phaseEndsAt) return;

      const cycleIndexBeforeCompletion = current.cycleIndex;
      const skillNameForNotification = current.skillName;
      const { loggedMinutes, next } = completePhase(
        current,
        currentDurations,
        settings?.pomodoroAutoAdvance ?? true
      );
      setSession(next);
      notifyPhaseChange(next.phase, skillNameForNotification);
      if (loggedMinutes > 0) {
        void logCheckpoint(loggedMinutes, cycleIndexBeforeCompletion, currentDurations.cyclesBeforeLongBreak, current.skillId);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [session?.status, durations, settings?.pomodoroAutoAdvance, logCheckpoint, notifyPhaseChange]);

  // Applique les actions de contrôle déclenchées depuis l'overlay — un seul
  // point de mutation, que le clic parte de la fenêtre principale ou de
  // l'overlay (voir spec, section "Fenêtres & IPC").
  useEffect(() => {
    const unsubscribe = window.api?.pomodoro?.onControl?.((action: PomodoroControlAction) => {
      if (action === 'pause') pause();
      else if (action === 'resume') resume();
      else if (action === 'advance') advance();
      else if (action === 'stop') void stop();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(skillId: string, skillName: string) {
    if (!durationsRef.current) return;
    setError(null);
    setNote('');
    setSession(startSession(skillId, skillName, durationsRef.current));
  }

  function pause() {
    setSession((current) => (current && current.status === 'running' ? pauseSession(current) : current));
  }

  function resume() {
    setSession((current) => (current && current.status === 'paused' ? resumeSession(current) : current));
  }

  function advance() {
    setSession((current) =>
      current && current.status === 'awaitingAdvance' && durationsRef.current
        ? advancePhase(current, durationsRef.current)
        : current
    );
  }

  async function stop() {
    const current = sessionRef.current;
    const currentDurations = durationsRef.current;
    if (!current || !authSession || !currentDurations) {
      setSession(null);
      return;
    }
    setError(null);

    const partialMinutes =
      current.status !== 'awaitingAdvance' && current.phase === 'work'
        ? partialMinutesElapsed(current, currentDurations)
        : 0;
    let entryIds = current.loggedEntryIds;
    if (partialMinutes > 0) {
      const { data, error: insertError } = await getSupabaseClient()
        .from('practice_entry')
        .insert({
          skill_id: current.skillId,
          user_id: authSession.user.id,
          duration_minutes: partialMinutes,
          note: checkpointNoteLabel(current.cycleIndex, currentDurations.cyclesBeforeLongBreak),
        })
        .select('id')
        .single();
      if (insertError) {
        setError(toFrenchError(insertError.message));
      } else {
        entryIds = [...entryIds, data.id as string];
      }
    }

    if (entryIds.length > 0) {
      const supabase = getSupabaseClient();
      const { data: rows, error: fetchError } = await supabase
        .from('practice_entry')
        .select('duration_minutes')
        .in('id', entryIds);
      if (fetchError) {
        setError(toFrenchError(fetchError.message));
      } else {
        const total = consolidateDuration((rows as { duration_minutes: number }[]).map((r) => r.duration_minutes));
        const { error: deleteError } = await supabase.from('practice_entry').delete().in('id', entryIds);
        if (deleteError) {
          setError(toFrenchError(deleteError.message));
        } else {
          const { error: insertError } = await supabase.from('practice_entry').insert({
            skill_id: current.skillId,
            user_id: authSession.user.id,
            duration_minutes: total,
            note: note.trim() ? note.trim() : null,
          });
          if (insertError) setError(toFrenchError(insertError.message));
        }
      }
    }

    setSession(null);
    setNote('');
  }

  function setPinned(next: boolean) {
    setPinnedState(next);
    window.api?.pomodoro?.setPinned?.(next);
  }

  return (
    <PomodoroContext.Provider
      value={{ session, durations, note, setNote, error, pinned, start, pause, resume, advance, stop, setPinned }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro doit être utilisé dans un PomodoroProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors (Task 4 already added `window.api.pomodoro`'s types).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/pomodoro.tsx
git commit -m "Add PomodoroProvider: stateful context, checkpoints, consolidation, notifications"
```

---

## Task 6: `/pomodoro-overlay` screen

**Files:**
- Create: `src/renderer/src/screens/PomodoroOverlay.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `window.api.pomodoro.onState`/`sendControl` (Task 4); `phaseDurationMinutes` (Task 3); `ProgressRing` (existing component); `colors` (existing theme).
- Produces: route `/pomodoro-overlay`, registered as a **top-level** route (sibling to `/login`/`/dev-login`, outside `AuthGate`) — this screen deliberately does NOT use `PomodoroProvider`/`usePomodoro`; it is a pure IPC listener + local display, so the overlay window never runs a second, disconnected timer instance.

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/PomodoroOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import ProgressRing from '../components/ProgressRing';
import type { PomodoroControlAction, PomodoroStateSnapshot } from '../env';

// Ne passe JAMAIS par PomodoroProvider/usePomodoro : cette fenêtre est un
// pur relais d'affichage + de clics IPC (voir spec, "Fenêtres & IPC"). Un
// second minuteur indépendant ici double-compterait les checkpoints.
export default function PomodoroOverlay() {
  const [snapshot, setSnapshot] = useState<PomodoroStateSnapshot | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => window.api?.pomodoro?.onState?.(setSnapshot), []);

  useEffect(() => {
    if (!snapshot) return;
    function tick() {
      if (!snapshot) return;
      const { session } = snapshot;
      const ms =
        session.status === 'paused' && session.remainingMsAtPause !== null
          ? session.remainingMsAtPause
          : Math.max(0, session.phaseEndsAt - Date.now());
      setRemainingMs(ms);
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [snapshot]);

  function sendControl(action: PomodoroControlAction) {
    window.api?.pomodoro?.sendControl?.(action);
  }

  if (!snapshot) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  const { session, durations } = snapshot;
  const totalMs =
    (session.phase === 'work'
      ? durations.workMinutes
      : session.phase === 'shortBreak'
        ? durations.shortBreakMinutes
        : durations.longBreakMinutes) * 60_000;
  const filled = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const phaseLabel = session.phase === 'work' ? 'Travail' : session.phase === 'shortBreak' ? 'Pause' : 'Pause longue';

  return (
    <div
      className="flex h-screen w-screen items-center gap-3 border border-ink-700 bg-ink-900/95 px-4 [-webkit-app-region:drag]"
      style={{ borderRadius: 16 }}
    >
      <ProgressRing size={40} radius={17} filled={Math.max(0, Math.min(1, filled))} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] text-champagne">{session.skillName}</p>
        <p className="font-data text-xs text-muted">
          {phaseLabel} · {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} · cycle{' '}
          {session.cycleIndex + 1}/{durations.cyclesBeforeLongBreak}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 [-webkit-app-region:no-drag]">
        {session.status === 'awaitingAdvance' ? (
          <button
            onClick={() => sendControl('advance')}
            aria-label="Continuer"
            className="border border-accent-bright px-2.5 py-1.5 font-data text-[11px] uppercase text-accent-bright hover:bg-accent-bright hover:text-ink-900"
          >
            Suite
          </button>
        ) : (
          <button
            onClick={() => sendControl(session.status === 'paused' ? 'resume' : 'pause')}
            aria-label={session.status === 'paused' ? 'Reprendre' : 'Mettre en pause'}
            className="border border-ink-700 px-2.5 py-1.5 font-data text-[11px] uppercase text-muted hover:text-champagne"
          >
            {session.status === 'paused' ? '▶' : '⏸'}
          </button>
        )}
        <button
          onClick={() => sendControl('stop')}
          aria-label="Arrêter le pomodoro"
          className="border border-ink-700 px-2.5 py-1.5 font-data text-[11px] uppercase text-muted hover:text-danger"
        >
          ■
        </button>
      </div>
    </div>
  );
}
```

Note: `env.d.ts` (Task 4) exports `PomodoroStateSnapshot`/`PomodoroControlAction` but declares them inside `declare global` scope augmentation — since the file also has top-level `export interface`/`export type` statements, importing them with `import type { ... } from '../env'` works (the file is a module because of those exports, and `declare global` still augments the ambient `Window` type globally regardless).

- [ ] **Step 2: Register the route**

In `src/renderer/src/App.tsx`, add the import:

```tsx
import PomodoroOverlay from './screens/PomodoroOverlay';
```

and add the route as a **top-level** sibling of `/login`/`/dev-login` (outside `AuthGate`), inside `Router()`:

```tsx
      <Route path="/login" element={<Login />} />
      <Route path="/dev-login" element={<DevLogin />} />
      <Route path="/pomodoro-overlay" element={<PomodoroOverlay />} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify manually (real Electron app)**

Run `npm run dev`. In the main window's DevTools console:

```js
window.api.pomodoro.setPinned(true);
```

Expected: the overlay window is now visible but blank/transparent (no `snapshot` yet — Task 7 is what actually starts a session and calls `reportState`). This step only confirms the route renders without a runtime error. Run `window.api.pomodoro.setPinned(false)` to hide it again.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/PomodoroOverlay.tsx src/renderer/src/App.tsx
git commit -m "Add the /pomodoro-overlay screen"
```

---

## Task 7: `/pomodoro` screen — skill picker + live session view

**Files:**
- Create: `src/renderer/src/screens/Pomodoro.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `usePomodoro` (Task 5); `useSkills` (existing); `ProgressRing`, `RayCorner`, `LogoMark` (existing components); `phaseDurationMinutes` (Task 3).
- Produces: route `pomodoro` (relative, under the `AuthGate`+`PomodoroProvider`+`AppShell` branch), reachable at `#/pomodoro` and `#/pomodoro?skillId=...`.

- [ ] **Step 1: Write the screen**

`src/renderer/src/screens/Pomodoro.tsx`:

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { session, durations, note, setNote, error, pinned, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h1 className="font-serif text-2xl text-champagne">Pomodoro</h1>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Skill
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne"
          >
            <option value="">Choisir…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!skillId || !durations}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill) start(skill.id, skill.name);
          }}
          className="bg-accent-bright px-5 py-2.5 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover disabled:opacity-60"
        >
          Démarrer
        </button>
      </div>
    );
  }

  if (!durations) return null; // ne peut pas arriver : une session active implique que les réglages ont déjà chargé

  const totalMs = phaseDurationMinutes(session.phase, durations) * 60_000;
  const remainingMs =
    session.status === 'paused' && session.remainingMsAtPause !== null
      ? session.remainingMsAtPause
      : Math.max(0, session.phaseEndsAt - Date.now());
  const filled = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const phaseLabel = session.phase === 'work' ? 'Travail' : session.phase === 'shortBreak' ? 'Pause courte' : 'Pause longue';

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={0} />
      <p className="relative font-data text-[11px] uppercase tracking-[0.1em] text-muted">
        {session.skillName} · cycle {session.cycleIndex + 1}/{durations.cyclesBeforeLongBreak}
      </p>
      <div className="relative flex flex-col items-center gap-2">
        <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
      </div>

      {error && (
        <p role="alert" className="relative text-sm text-danger">
          {error}
        </p>
      )}

      <div className="relative flex flex-wrap items-center justify-center gap-3">
        {session.status === 'awaitingAdvance' ? (
          <button
            onClick={advance}
            className="bg-accent-bright px-5 py-2.5 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover"
          >
            Continuer
          </button>
        ) : (
          <button
            onClick={session.status === 'paused' ? resume : pause}
            className="border border-ink-700 px-5 py-2.5 font-sans text-sm text-muted hover:text-champagne"
          >
            {session.status === 'paused' ? 'Reprendre' : 'Pause'}
          </button>
        )}
        <button
          onClick={() => void stop()}
          className="border border-ink-700 px-5 py-2.5 font-sans text-sm text-muted hover:text-danger"
        >
          Arrêter
        </button>
        <button
          onClick={() => setPinned(!pinned)}
          className={`border px-5 py-2.5 font-sans text-sm ${pinned ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted hover:text-champagne'}`}
        >
          {pinned ? 'Détacher' : 'Épingler'}
        </button>
      </div>

      <label className="relative flex w-full flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        Note (optionnelle)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ce sur quoi tu travailles…"
          className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-champagne placeholder:text-muted focus:outline-none"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Register the route and mount `PomodoroProvider`**

In `src/renderer/src/App.tsx`:

Add the imports:

```tsx
import { PomodoroProvider } from './lib/pomodoro';
import Pomodoro from './screens/Pomodoro';
```

Wrap `AppShell` with `PomodoroProvider` in the `AuthGate` route's `element`, and add the `pomodoro` route:

```tsx
      <Route
        element={
          <AuthGate>
            <PomodoroProvider>
              <AppShell />
            </PomodoroProvider>
          </AuthGate>
        }
      >
        <Route index element={<Accueil />} />
        <Route path="skills" element={<ListeSkills />} />
        <Route path="skills/nouveau" element={<NouveauSkill />} />
        <Route path="skills/:id" element={<DetailSkill />} />
        <Route path="entree/nouvelle" element={<NouvelleEntree />} />
        <Route path="pomodoro" element={<Pomodoro />} />
        <Route path="reglages" element={<Reglages />} />
        <Route path="*" element={<Introuvable />} />
      </Route>
```

(Only the `element` prop of the wrapping `<Route>` and the addition of the `pomodoro` child route change — the other child routes are unchanged, keep their existing order.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify live via `/dev-login`**

Preview the `saint-daily-dev` launch config, navigate to `http://localhost:5173/#/dev-login`, then to `http://localhost:5173/#/pomodoro`. Expected: the skill picker renders with the dev account's skill(s) in the `<select>`. Choose one, click "Démarrer". Expected: the live view appears — ring, countdown starting near 25:00 and ticking down, phase label "TRAVAIL", cycle "1/4", Pause/Arrêter/Épingler buttons, note field. Click "Arrêter". Expected: back to the skill picker, no console errors (check with `read_console_messages`).

**Cannot be verified this way:** the "Épingler" button's `window.api.pomodoro.setPinned` call — `window.api` is undefined in a bare browser tab. Verify that specific interaction only in the real Electron app (`npm run dev`), per Task 4/6's manual steps.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Pomodoro.tsx src/renderer/src/App.tsx
git commit -m "Add the /pomodoro screen: skill picker and live session view"
```

---

## Task 8: Entry points on Accueil and DetailSkill

**Files:**
- Modify: `src/renderer/src/screens/Accueil.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`

**Interfaces:**
- Consumes: `react-router-dom`'s `Link` (existing import in both files); route `pomodoro` (Task 7).
- Produces: nothing new consumed elsewhere — this is the last task that adds reachability, not new state.

- [ ] **Step 1: Add the Accueil button**

In `src/renderer/src/screens/Accueil.tsx`, the header currently renders a single `<Link to="/entree/nouvelle">`. Add a second, secondary button right after it, inside the same `motion.header`:

```tsx
        <Link
          to="/entree/nouvelle"
          className="flex items-center gap-2 bg-accent-bright px-5 py-3 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover"
        >
          <PlusIcon />
          Nouvelle entrée
        </Link>
```

becomes:

```tsx
        <div className="flex items-center gap-3">
          <Link
            to="/pomodoro"
            className="border border-ink-700 px-5 py-3 font-sans text-sm text-muted hover:text-champagne"
          >
            Démarrer un pomodoro
          </Link>
          <Link
            to="/entree/nouvelle"
            className="flex items-center gap-2 bg-accent-bright px-5 py-3 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover"
          >
            <PlusIcon />
            Nouvelle entrée
          </Link>
        </div>
```

(Wrapping both links in a `flex items-center gap-3` div keeps them on one row, matching the existing `flex items-end justify-between` header layout — the new div becomes the second flex child, replacing the single `<Link>` that was there.)

- [ ] **Step 2: Add the DetailSkill button**

In `src/renderer/src/screens/DetailSkill.tsx`, the top action row currently ends with the Archiver/Désarchiver button inside `<div className="flex items-center gap-3">`. Add a link before it:

```tsx
        <div className="flex items-center gap-3">
          <label className="relative flex items-center gap-1.5 border border-accent-mid px-3.5 py-2 font-data text-[11px] uppercase tracking-[0.08em] text-accent-mid">
```

stays the same up through the `</label>`, then insert before the Archiver button:

```tsx
          <Link
            to={`/pomodoro?skillId=${skill.id}`}
            className="border border-ink-700 px-3.5 py-2 font-sans text-[13px] text-muted hover:text-champagne"
          >
            Démarrer un pomodoro
          </Link>
          <button
            onClick={handleToggleArchived}
            className="border border-ink-700 px-3.5 py-2 font-sans text-[13px] text-muted hover:text-champagne"
          >
            {skill.archivedAt ? 'Désarchiver' : 'Archiver'}
          </button>
```

`Link` is already imported in this file (`import { Link, useParams } from 'react-router-dom';`) — no new import needed.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify live via `/dev-login`**

Navigate to `http://localhost:5173/#/`. Expected: "Démarrer un pomodoro" appears next to "+ Nouvelle entrée". Click it — expected: lands on `/pomodoro` with the skill picker empty (no preselection). Navigate to `http://localhost:5173/#/skills/<a real skill id from the dev account>`. Expected: "Démarrer un pomodoro" appears in the top action row. Click it — expected: lands on `/pomodoro` with that skill already selected in the `<select>`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/DetailSkill.tsx
git commit -m "Add Pomodoro entry points on Accueil and DetailSkill"
```

---

## Task 9: Réglages — Pomodoro settings section

**Files:**
- Modify: `src/renderer/src/screens/Reglages.tsx`

**Interfaces:**
- Consumes: `SkillAppSettings`'s 5 new fields and `updateSettings` (Task 2, both already in the codebase); `Toggle` (existing component).
- Produces: nothing new consumed elsewhere — last task in the plan.

- [ ] **Step 1: Add the Pomodoro section**

In `src/renderer/src/screens/Reglages.tsx`, add a new handler alongside the existing `handleReminderChange`/`handleNotificationsChange`/`handleAutoLaunchChange`:

```tsx
  async function handlePomodoroSettingChange(patch: Partial<typeof settings>) {
    setActionError(null);
    const { error: updateError } = await updateSettings(patch);
    if (updateError) setActionError(updateError);
  }
```

Then add a new `<section>` after the existing "Rappels" section and before "À propos":

```tsx
      <section className="flex flex-col gap-0">
        <h2 className="mb-1 font-data text-[11px] uppercase tracking-[0.1em] text-muted">Pomodoro</h2>

        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <p className="text-[15px] text-champagne">Travail</p>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.pomodoroWorkMinutes}
              onChange={(e) => handlePomodoroSettingChange({ pomodoroWorkMinutes: Number(e.target.value) })}
              aria-label="Durée d'un cycle de travail en minutes"
              className="w-10 bg-transparent text-right font-data text-[15px] text-champagne focus:outline-none"
            />
            <span className="font-data text-[15px] text-champagne">min</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <p className="text-[15px] text-champagne">Pause courte</p>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.pomodoroShortBreakMinutes}
              onChange={(e) => handlePomodoroSettingChange({ pomodoroShortBreakMinutes: Number(e.target.value) })}
              aria-label="Durée d'une pause courte en minutes"
              className="w-10 bg-transparent text-right font-data text-[15px] text-champagne focus:outline-none"
            />
            <span className="font-data text-[15px] text-champagne">min</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <p className="text-[15px] text-champagne">Pause longue</p>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.pomodoroLongBreakMinutes}
              onChange={(e) => handlePomodoroSettingChange({ pomodoroLongBreakMinutes: Number(e.target.value) })}
              aria-label="Durée d'une pause longue en minutes"
              className="w-10 bg-transparent text-right font-data text-[15px] text-champagne focus:outline-none"
            />
            <span className="font-data text-[15px] text-champagne">min</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <div>
            <p className="text-[15px] text-champagne">Cycles avant la pause longue</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Nombre de cycles de travail entre deux pauses longues
            </p>
          </div>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.pomodoroCyclesBeforeLongBreak}
              onChange={(e) =>
                handlePomodoroSettingChange({ pomodoroCyclesBeforeLongBreak: Number(e.target.value) })
              }
              aria-label="Nombre de cycles avant la pause longue"
              className="w-10 bg-transparent text-right font-data text-[15px] text-champagne focus:outline-none"
            />
          </label>
        </div>

        <Toggle
          checked={settings.pomodoroAutoAdvance}
          onChange={(checked) => handlePomodoroSettingChange({ pomodoroAutoAdvance: checked })}
          label="Enchaînement automatique"
          description="Passer seul du travail à la pause (et inversement) plutôt que d'attendre un clic"
        />
      </section>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify live via `/dev-login`**

Navigate to `http://localhost:5173/#/reglages`. Expected: a new "Pomodoro" section appears between "Rappels" and "À propos" with the 4 number inputs (defaults 25/5/15/4) and the auto-advance toggle (default on). Change "Travail" to `20`, tab away. Expected: no error shown; reload the page — expected: `20` persists (round-trips through Supabase). Then navigate to `/pomodoro`, pick a skill, start — expected: the countdown now starts from 20:00, confirming `Pomodoro` (Task 7) actually reads the updated setting through `durations`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Reglages.tsx
git commit -m "Add the Pomodoro settings section to Réglages"
```

---

## Final manual pass (real Electron app — not covered by any single task above)

Once all 9 tasks are merged, run through this in `npm run dev` (packaged-app-equivalent, not the bare browser preview) before considering the feature done:

1. Start a pomodoro from Accueil, pin it, minimize the main window (or switch to another app) — the overlay should stay visible, on top of other windows, ticking every second.
2. Click pause on the overlay — the main window (when brought back up) should show "Reprendre", proving the control round-trip (overlay → main → renderer) works, not just renderer → overlay.
3. Let a full work cycle complete with auto-advance ON — an OS notification should appear, the phase should switch to a short break automatically, and a checkpoint `practice_entry` should appear in Supabase (check via DetailSkill's journal) with the note `Pomodoro — cycle 1/4`.
4. Turn auto-advance OFF in Réglages, let a cycle complete — the timer should stop at 00:00 in the `awaitingAdvance` state (main window and overlay both show a "Continuer"/"Suite" button) until clicked.
5. Stop mid-cycle after a partial minute or two — confirm in DetailSkill's journal that the checkpoint entries are gone and replaced by a single consolidated entry with the summed duration and the note typed into the note field.
6. Drag the overlay by its background — it should move; clicking its buttons should not also drag it (the `-webkit-app-region: no-drag` on the button row).

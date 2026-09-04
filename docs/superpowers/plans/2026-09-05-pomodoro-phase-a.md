# Pomodoro Launch-Screen Improvements (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pomodoro screen's plain skill `<select>` with a searchable, streak-aware picker, and let the user pick a work-phase duration (presets + custom) for the session about to start, without touching Réglages.

**Architecture:** Two pure, tested helpers in `lib/streaks.ts` back a new `SkillPicker` component that replaces the existing `SelectField` on the Pomodoro pre-start screen. Separately, `PomodoroProvider` gains a session-scoped durations state so a duration chosen at launch stays fixed for the whole session even if Réglages changes mid-session — every existing consumer of the provider's `durations` (the tick, the overlay relay, the screen's own display math) picks this up automatically because they already read the same `durations` variable, which now resolves to the session override when one is active.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `motion/react`, Vitest

**Spec:** [docs/superpowers/specs/2026-09-05-pomodoro-phase-a-design.md](../specs/2026-09-05-pomodoro-phase-a-design.md)

## Global Constraints

- **Duration override scope:** only the work-phase duration is adjustable at launch. Short/long break durations and cycles-before-long-break always come from Réglages, never overridden.
- **Never persisted:** the chosen work duration lives only in memory for the running session — no database write, no per-skill memory, nothing survives past `stop()`.
- **Archived skills never appear** in the new picker (a correction over the current `<select>`, which shows them).
- **No new entrance easing** — reuse the existing `cubic-bezier(0.16, 1, 0.3, 1)` wherever this plan adds a `motion.*` entrance (it doesn't add any new ones; existing entrances are untouched).
- **No comments explaining WHAT code does** — only non-obvious WHY, matching every file already in this codebase.
- **Out of scope:** the running-timer screen (cycle-progress dots, mid-phase duration change, session history — Phase B), `NouvelleEntree.tsx`'s own skill selector, and any Supabase/clock-error handling discussed elsewhere this session.

---

## Task 1: Pure sort/filter helpers for the skill picker

**Files:**
- Modify: `src/renderer/src/lib/streaks.ts`
- Test: `src/renderer/src/lib/streaks.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `filterSkillsForPicker<T extends { name: string; archivedAt: string | null }>(skills: T[], search: string): T[]` and `sortSkillsByRecentPractice<T extends { id: string; name: string }>(skills: T[], entriesBySkill: Record<string, PracticeEntryLike[]>, now?: Date): T[]`, both exported from `lib/streaks.ts`. Task 2 imports and calls both by these exact names and signatures.

- [ ] **Step 1: Write the failing tests**

Read `src/renderer/src/lib/streaks.test.ts` to confirm its current shape (it already has `describe` blocks for `calculateStreak`, `daysSinceLastPractice`, `filterByTag`, `streakJustExtended`), then add two new `describe` blocks at the end of the file:

```ts
describe('filterSkillsForPicker', () => {
  const skills = [
    { name: 'Piano', archivedAt: null },
    { name: 'Guitare', archivedAt: '2026-01-01T00:00:00Z' },
    { name: 'Peinture', archivedAt: null },
  ];

  it('excludes archived skills even with no search', () => {
    expect(filterSkillsForPicker(skills, '')).toEqual([skills[0], skills[2]]);
  });

  it('filters case-insensitively on the name among active skills', () => {
    expect(filterSkillsForPicker(skills, 'pia')).toEqual([skills[0]]);
  });

  it('never returns an archived skill even if its name matches the search', () => {
    expect(filterSkillsForPicker(skills, 'guit')).toEqual([]);
  });
});

describe('sortSkillsByRecentPractice', () => {
  const now = new Date('2026-08-31T18:00:00Z');
  const a = { id: 'a', name: 'Alpha' };
  const b = { id: 'b', name: 'Beta' };
  const c = { id: 'c', name: 'Charlie' };

  it('sorts by most recently practiced first', () => {
    const entriesBySkill = {
      a: [{ practicedAt: '2026-08-29T09:00:00Z' }], // 2 jours
      b: [{ practicedAt: '2026-08-31T09:00:00Z' }], // aujourd'hui
      c: [{ practicedAt: '2026-08-25T09:00:00Z' }], // 6 jours
    };
    expect(sortSkillsByRecentPractice([a, b, c], entriesBySkill, now)).toEqual([b, a, c]);
  });

  it('puts never-practiced skills last, alphabetically among themselves', () => {
    const entriesBySkill = { a: [{ practicedAt: '2026-08-30T09:00:00Z' }] };
    expect(sortSkillsByRecentPractice([c, b, a], entriesBySkill, now)).toEqual([a, b, c]);
  });

  it('breaks ties on the same daysSinceLastPractice alphabetically', () => {
    const entriesBySkill = {
      a: [{ practicedAt: '2026-08-30T09:00:00Z' }],
      b: [{ practicedAt: '2026-08-30T09:00:00Z' }],
    };
    expect(sortSkillsByRecentPractice([b, a], entriesBySkill, now)).toEqual([a, b]);
  });
});
```

Update the file's import line at the top from:

```ts
import { calculateStreak, daysSinceLastPractice, filterByTag, streakJustExtended } from './streaks';
```

to:

```ts
import {
  calculateStreak,
  daysSinceLastPractice,
  filterByTag,
  filterSkillsForPicker,
  sortSkillsByRecentPractice,
  streakJustExtended,
} from './streaks';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: FAIL — `filterSkillsForPicker` and `sortSkillsByRecentPractice` are not exported from `./streaks`.

- [ ] **Step 3: Implement both functions**

Read `src/renderer/src/lib/streaks.ts`. Add these two exported functions (placement: after `daysSinceLastPractice`, before `filterByTag`, since `sortSkillsByRecentPractice` calls `daysSinceLastPractice`):

```ts
/** Skills actifs (jamais archivés) dont le nom correspond à la recherche,
 *  insensible à la casse. Pas de recherche = tous les skills actifs. */
export function filterSkillsForPicker<T extends { name: string; archivedAt: string | null }>(
  skills: T[],
  search: string
): T[] {
  const active = skills.filter((s) => !s.archivedAt);
  if (!search.trim()) return active;
  const needle = search.trim().toLowerCase();
  return active.filter((s) => s.name.toLowerCase().includes(needle));
}

/** Dernière pratique la plus récente d'abord ; jamais pratiqués en
 *  dernier. Égalité (y compris deux "jamais") départagée alphabétiquement
 *  pour un ordre déterministe. */
export function sortSkillsByRecentPractice<T extends { id: string; name: string }>(
  skills: T[],
  entriesBySkill: Record<string, PracticeEntryLike[]>,
  now: Date = new Date()
): T[] {
  return [...skills].sort((x, y) => {
    const xDays = daysSinceLastPractice(entriesBySkill[x.id] ?? [], now);
    const yDays = daysSinceLastPractice(entriesBySkill[y.id] ?? [], now);
    if (xDays === null && yDays === null) return x.name.localeCompare(y.name);
    if (xDays === null) return 1;
    if (yDays === null) return -1;
    if (xDays !== yDays) return xDays - yDays;
    return x.name.localeCompare(y.name);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: PASS, all tests in the file green (existing + 6 new).

- [ ] **Step 5: Typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/streaks.ts src/renderer/src/lib/streaks.test.ts
git commit -m "feat: add filterSkillsForPicker and sortSkillsByRecentPractice helpers"
```

---

## Task 2: `SkillPicker` component, wired into the Pomodoro screen

**Files:**
- Create: `src/renderer/src/components/SkillPicker.tsx`
- Modify: `src/renderer/src/screens/Pomodoro.tsx`

**Interfaces:**
- Consumes: `filterSkillsForPicker`/`sortSkillsByRecentPractice` from Task 1 (`../lib/streaks`); `Skill`/`PracticeEntry` types from `../lib/types`; `useAllPracticeEntries` from `../hooks/usePracticeEntries` (already exists, unrelated to this plan).
- Produces: `SkillPicker` component, default export of `components/SkillPicker.tsx`, props `{ skills: Skill[]; entriesBySkill: Record<string, PracticeEntry[]>; value: string; onChange: (skillId: string) => void }`. Task 3 does not depend on this component's internals, only on the fact that `Pomodoro.tsx`'s pre-start branch renders it in place of the old `SelectField` before Task 3 begins.

No unit test for this task — it is a component with no extractable pure logic beyond what Task 1 already tests; verification is typecheck + manual dev-launch, per this project's established convention (see `pomodoroLogic.test.ts`/`streaks.test.ts` for what IS unit-tested here: pure functions only, never component rendering).

- [ ] **Step 1: Create `SkillPicker.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { calculateStreak, daysSinceLastPractice, filterSkillsForPicker, sortSkillsByRecentPractice } from '../lib/streaks';
import { SearchIcon } from './icons';
import type { PracticeEntry, Skill } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function SkillPicker({
  skills,
  entriesBySkill,
  value,
  onChange,
}: {
  skills: Skill[];
  entriesBySkill: Record<string, PracticeEntry[]>;
  value: string;
  onChange: (skillId: string) => void;
}) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const filtered = filterSkillsForPicker(skills, search);
    return sortSkillsByRecentPractice(filtered, entriesBySkill);
  }, [skills, entriesBySkill, search]);

  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
      Skill
      <div className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2.5">
        <SearchIcon className="text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un skill"
          aria-label="Rechercher un skill"
          className={`w-full bg-transparent font-sans text-[15px] normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
      </div>
      <div className="max-h-56 overflow-y-auto border border-ink-700">
        {visible.length === 0 && <p className="px-3.5 py-3 text-sm normal-case tracking-normal text-muted">Aucun skill ne correspond.</p>}
        {visible.map((skill) => {
          const entries = entriesBySkill[skill.id] ?? [];
          const streak = calculateStreak(entries);
          const daysSince = daysSinceLastPractice(entries);
          const selected = skill.id === value;
          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => onChange(skill.id)}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-3 border-b border-ink-700 px-3.5 py-2.5 text-left normal-case tracking-normal transition-colors duration-150 last:border-b-0 ${FOCUS_RING} ${selected ? 'bg-ink-700' : 'hover:bg-ink-800'}`}
            >
              <span className="font-serif text-[15px] text-champagne">{skill.name}</span>
              <span className="font-data text-right text-xs text-muted">
                série de {streak} j
                <br />
                {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
              </span>
            </button>
          );
        })}
      </div>
    </label>
  );
}
```

- [ ] **Step 2: Read the current Pomodoro.tsx**

Read `src/renderer/src/screens/Pomodoro.tsx` in full to confirm its current exact shape before editing (it changed recently in an unrelated chantier — the cycle-complete celebration — so re-read rather than relying on memory).

- [ ] **Step 3: Wire `SkillPicker` into the pre-start screen**

Update the import block. Find:

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { SelectField } from '../components/FormField';
import { colors } from '../theme/colors';
```

Replace with:

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePomodoro } from '../lib/pomodoro';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { phaseDurationMinutes } from '../lib/pomodoroLogic';
import ProgressRing from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import SkillPicker from '../components/SkillPicker';
import { colors } from '../theme/colors';
```

(`SelectField` is no longer used anywhere in this file after this task — dropped from the imports entirely, not left dangling.)

Find, near the top of the component body:

```tsx
  const { skills } = useSkills();
```

Replace with:

```tsx
  const { skills } = useSkills();
  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));
```

Find the pre-start branch's `SelectField`:

```tsx
        <SelectField label="Skill" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Choisir…</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
```

Replace with:

```tsx
        <SkillPicker skills={skills} entriesBySkill={entriesBySkill} value={skillId} onChange={setSkillId} />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS, unchanged count from Task 1 (this task adds no new pure logic).

- [ ] **Step 6: Manual dev-launch sanity check**

Run: `npm run dev`, navigate to the Pomodoro screen (via `/dev-login` if available). Confirm: the skill picker shows active skills only, sorted with the most recently practiced first; typing in the search field filters by name; clicking a row selects it (visibly highlighted) and enables the "Démarrer" button once selected. No console errors. Stop the dev process once confirmed.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/SkillPicker.tsx src/renderer/src/screens/Pomodoro.tsx
git commit -m "feat: replace the Pomodoro skill select with a searchable, streak-aware picker"
```

---

## Task 3: Session-scoped work duration (presets + custom, fixed for the whole session)

**Files:**
- Modify: `src/renderer/src/lib/pomodoro.tsx`
- Modify: `src/renderer/src/screens/Pomodoro.tsx`

**Interfaces:**
- Consumes: nothing from Task 1; depends on Task 2 having already replaced `SelectField` with `SkillPicker` in `Pomodoro.tsx` (this task edits a different part of the same file — the duration UI and the `start()` call site — and assumes Task 2's edit already landed).
- Produces: `PomodoroContextValue.start` changes signature to `(skillId: string, skillName: string, workMinutes: number) => void` — this is the last task in the plan, nothing downstream depends on it further.

- [ ] **Step 1: Read the current `pomodoro.tsx` in full**

Read `src/renderer/src/lib/pomodoro.tsx` to confirm its current exact shape before editing.

- [ ] **Step 2: Rename the settings-derived durations and add session-scoped state**

Find:

```tsx
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
```

Replace with:

```tsx
  const settingsDurations: PomodoroDurations | null = settings
    ? {
        workMinutes: settings.pomodoroWorkMinutes,
        shortBreakMinutes: settings.pomodoroShortBreakMinutes,
        longBreakMinutes: settings.pomodoroLongBreakMinutes,
        cyclesBeforeLongBreak: settings.pomodoroCyclesBeforeLongBreak,
      }
    : null;
  // Figée une fois à start() (durée de travail choisie au lancement,
  // pauses/cycles des Réglages au moment du lancement) et remise à null à
  // l'arrêt — sans ça, changer les Réglages pendant qu'une session tourne
  // changerait la durée des phases de travail suivantes en plein milieu.
  const [sessionDurations, setSessionDurations] = useState<PomodoroDurations | null>(null);
  const durations = sessionDurations ?? settingsDurations;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
```

Every other reference to `durations` in this file (the tick effect's guard/dependency array, `advance()`, `stopInternal()`'s `currentDurations`, the `reportState` effect's `durationsRef.current`, and the exposed context value) needs no edit at all — they already read the identifier `durations`, which now resolves to the session override automatically once one is set. Do not touch those lines.

- [ ] **Step 3: Update `start()`**

Find:

```tsx
  function start(skillId: string, skillName: string) {
    if (!durationsRef.current) return;
    setError(null);
    setNote('');
    setSession(startSession(skillId, skillName, durationsRef.current));
  }
```

Replace with:

```tsx
  function start(skillId: string, skillName: string, workMinutes: number) {
    if (!settingsDurations) return;
    const effective: PomodoroDurations = { ...settingsDurations, workMinutes };
    setSessionDurations(effective);
    setError(null);
    setNote('');
    setSession(startSession(skillId, skillName, effective));
  }
```

- [ ] **Step 4: Clear the session override on stop**

Find, at the end of `stopInternal()`:

```tsx
    setSession(null);
    setNote('');
    // Désépingle l'overlay : sans ça, la fenêtre transparente reste
    // parquée en haut à droite après la fin d'une session, capturant les
    // clics dans sa zone même invisible (comportement Electron sur les
    // fenêtres transparentes).
    setPinned(false);
  }
```

Replace with:

```tsx
    setSession(null);
    setSessionDurations(null);
    setNote('');
    // Désépingle l'overlay : sans ça, la fenêtre transparente reste
    // parquée en haut à droite après la fin d'une session, capturant les
    // clics dans sa zone même invisible (comportement Electron sur les
    // fenêtres transparentes).
    setPinned(false);
  }
```

- [ ] **Step 5: Update the context type**

Find, in the `PomodoroContextValue` interface:

```tsx
  start: (skillId: string, skillName: string) => void;
```

Replace with:

```tsx
  start: (skillId: string, skillName: string, workMinutes: number) => void;
```

- [ ] **Step 6: Verify the overlay and reportState claim against the actual code — do not skip this**

This step is a read-only check, not an edit. Read the `reportState` effect (`useEffect` that calls `window.api?.pomodoro?.reportState?.(...)`) and confirm it reads `durationsRef.current` (it does, unchanged by this task). Since Step 2 made `durationsRef.current` track `sessionDurations ?? settingsDurations` on every render, confirm this means the overlay window (`PomodoroOverlay.tsx`, relayed via `pomodoroOverlay.ts`) receives the session's actual chosen work duration with no code change needed in either of those two files. Open both files and confirm neither one reads `settings`/`pomodoroWorkMinutes` directly anywhere (they consume only the relayed `durations` snapshot) — if either does, STOP and report back rather than proceeding, since that would mean this task's assumption is wrong and the fix needs to be scoped differently.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Full test suite**

Run: `npm test`
Expected: PASS, unchanged (no pure logic changed in this step — `pomodoroLogic.ts` itself is untouched).

- [ ] **Step 9: Commit the provider change**

```bash
git add src/renderer/src/lib/pomodoro.tsx
git commit -m "feat: fix a Pomodoro session's work duration for its whole lifetime"
```

- [ ] **Step 10: Read the current Pomodoro.tsx (post-Task-2 state)**

Read `src/renderer/src/screens/Pomodoro.tsx` again — it now has `SkillPicker` wired in from Task 2; this step's edits are additive to that.

- [ ] **Step 11: Add the duration preset UI and wire it into `start()`**

Find, near the top of the component:

```tsx
export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));
  const { session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
```

Replace with:

```tsx
const PRESET_WORK_MINUTES = [15, 25, 50];

export default function Pomodoro() {
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');
  const { skills } = useSkills();
  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));
  const { session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  // null = pas encore touché par l'utilisateur ; résout alors sur la durée
  // des Réglages dès qu'elle est connue (voir effectiveWorkMinutes) — donc
  // rien ne change tant que personne ne choisit explicitement un preset.
  const [workMinutesChoice, setWorkMinutesChoice] = useState<number | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
```

(`PRESET_WORK_MINUTES` is declared at module scope, above the component, matching this file's existing `FOCUS_RING` constant placement.)

Find, further down, the line computing `effectiveWorkMinutes` doesn't exist yet — add it right after the state declarations above, still before the early `if (!session)` return:

```tsx
  const effectiveWorkMinutes = workMinutesChoice ?? durations?.workMinutes ?? null;
```

Find the pre-start branch:

```tsx
  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-md flex-col gap-5"
      >
        <h1 className="font-serif text-2xl text-champagne">Pomodoro</h1>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SkillPicker skills={skills} entriesBySkill={entriesBySkill} value={skillId} onChange={setSkillId} />
        <Button
          variant="primary"
          disabled={!skillId || !durations}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill) start(skill.id, skill.name);
          }}
        >
          Démarrer
        </Button>
      </motion.div>
    );
  }
```

Replace with:

```tsx
  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-md flex-col gap-5"
      >
        <h1 className="font-serif text-2xl text-champagne">Pomodoro</h1>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SkillPicker skills={skills} entriesBySkill={entriesBySkill} value={skillId} onChange={setSkillId} />
        {skillId && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Durée de travail</p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_WORK_MINUTES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setWorkMinutesChoice(preset);
                    setCustomMinutesInput('');
                  }}
                  aria-pressed={effectiveWorkMinutes === preset}
                  className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${effectiveWorkMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
                >
                  {preset} min
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={customMinutesInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomMinutesInput(raw);
                  const parsed = Number(raw);
                  if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) setWorkMinutesChoice(parsed);
                }}
                placeholder="Personnalisé"
                aria-label="Durée de travail personnalisée en minutes"
                className={`w-28 border bg-ink-800 px-3 py-1.5 font-data text-xs normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING} ${effectiveWorkMinutes !== null && !PRESET_WORK_MINUTES.includes(effectiveWorkMinutes) ? 'border-accent-bright' : 'border-ink-700'}`}
              />
            </div>
          </div>
        )}
        <Button
          variant="primary"
          disabled={!skillId || effectiveWorkMinutes === null}
          onClick={() => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill && effectiveWorkMinutes !== null) start(skill.id, skill.name, effectiveWorkMinutes);
          }}
        >
          Démarrer
        </Button>
      </motion.div>
    );
  }
```

- [ ] **Step 12: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 13: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 14: Manual dev-launch sanity check**

Run: `npm run dev`, navigate to the Pomodoro screen. Confirm: no duration UI shows until a skill is picked; once picked, the preset matching the current Réglages work duration is highlighted by default; clicking a different preset highlights it instead and clears any custom value; typing in "Personnalisé" highlights that field's border and un-highlights the presets; "Démarrer" launches a session using the chosen duration (visible as the countdown's total time and the ring's fill rate); changing Réglages' work duration in another screen while this session is running does not affect the running session's remaining time or its next work phase. Stop the dev process once confirmed.

- [ ] **Step 15: Commit**

```bash
git add src/renderer/src/screens/Pomodoro.tsx
git commit -m "feat: let a Pomodoro session's work duration be chosen at launch"
```

---

## Self-Review

**Spec coverage:** Sélecteur de skill enrichi (recherche, tri par récence avec archivés exclus et streak/dernière pratique visibles) → Tasks 1-2. Durée de travail ajustable au lancement (presets 15/25/50 + personnalisé, par lancement, jamais persistée) → Task 3, Steps 10-11. Architecture "durée figée à la session" (nouvel état, `start()` change de signature, `durationsRef`/overlay suivent automatiquement) → Task 3, Steps 2-6, avec une étape de vérification explicite (Step 6) plutôt qu'une simple affirmation. Hors scope (écran en cours, pauses/cycles ajustables, mémoire par skill, `NouvelleEntree.tsx`) → aucune tâche n'y touche. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate X" steps — every step shows the actual before/after code. Clean.

**Type consistency:** `filterSkillsForPicker`/`sortSkillsByRecentPractice` signatures (Task 1) match their call sites in `SkillPicker.tsx` (Task 2) exactly. `SkillPicker`'s props (Task 2) match its usage in `Pomodoro.tsx` in both Task 2 and Task 3 exactly (Task 3 doesn't change the `SkillPicker` call). `start`'s new signature (Task 3, Step 3 and Step 5) matches its call site in Task 3, Step 11 exactly (`start(skill.id, skill.name, effectiveWorkMinutes)`, all three arguments present, no drift from the 2-argument version used before this task). No drift found.

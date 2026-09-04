# Saint Daily Liveliness Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared micro-interaction feedback layer (buttons, list rows, tag chips) and three localized, gold-toned reward pulses (milestone checked, Pomodoro cycle completed, streak extended) to Saint Daily, without touching screen transitions or ambient animation (later phases).

**Architecture:** Pure additive changes to existing files — no new components, no new screens. Micro-interactions extend the already-shared `Button`/`buttonClassName` primitive and two screens' existing hover classes. Reward pulses are local component state (a transient boolean/timestamp that self-clears after ~400ms–2.5s) rendered with `motion.*` elements already imported in each file, reusing the app's existing entrance easing `cubic-bezier(0.16, 1, 0.3, 1)`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `motion/react` (Framer Motion), Vitest

**Spec:** [docs/superpowers/specs/2026-09-04-liveliness-phase1-design.md](../specs/2026-09-04-liveliness-phase1-design.md)

## Global Constraints

- **Tone:** refined and discreet — gold (`#E7B94E`, `colors.accent.bright`) glow/pulse only, never confetti, bounce, or the `LogoMark` ray-reveal (reserved for whole-app moments: login, update restart).
- **Entrance easing stays `cubic-bezier(0.16, 1, 0.3, 1)`** (already used everywhere) — do not introduce a second entrance curve. New feedback (hover/press) uses a separate, shorter `duration-150`/`duration-200` `ease-out` — never reuse the 500ms entrance duration for feedback.
- **`MotionConfig reducedMotion="user"` (`App.tsx`) and `@media (prefers-reduced-motion: reduce)` (`index.css`) already cover every `motion.*` element and CSS animation automatically** — do not add per-component `prefers-reduced-motion` checks.
- **Out of scope for this plan:** screen transitions (Phase 2), ambient/idle animation (Phase 3), celebrating plain practice-entry creation, `AppShell.tsx`'s nav rail (already correct, do not touch), `ProgressRing.tsx`'s own props/API (wrap it, don't modify it), any screen not named in a task below.
- **No comments explaining WHAT code does** — only non-obvious WHY, matching this codebase's existing comment style (see any existing file for the pattern).

---

## Task 1: Micro-interaction feedback — buttons, skill rows, tag chips

**Files:**
- Modify: `src/renderer/src/components/Button.tsx`
- Modify: `src/renderer/src/screens/ListeSkills.tsx`
- Modify: `src/renderer/src/screens/Accueil.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on — this task is fully independent of Tasks 2 and 3 and can be done in any order relative to them.

This task is pure Tailwind className changes (transition/scale utilities) — no new logic, so there is no unit test to write. Verification is `npm run typecheck` (confirms no JSX/TS breakage) followed by the manual dev-launch check in Step 6.

- [ ] **Step 1: Add transition + press feedback to the shared `Button`**

Read `src/renderer/src/components/Button.tsx`. Find:

```ts
const BASE =
  'inline-flex items-center justify-center gap-2 font-sans disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
```

Replace with:

```ts
const BASE =
  'inline-flex items-center justify-center gap-2 font-sans transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
```

This is consumed by both `Button` (real `<button>` elements, where a native `disabled` element never matches `:active`, so no extra guard is needed) and `buttonClassName` (used for `<Link>`-as-button call sites across the app) — one change reaches every button-styled element in Saint Daily.

- [ ] **Step 2: Add a hover transition to skill rows in `ListeSkills.tsx`**

Read `src/renderer/src/screens/ListeSkills.tsx`. Find the skill row `<Link>` (inside the `visible.map` block):

```tsx
              className={`flex items-center gap-5 bg-ink-800 px-[22px] py-5 hover:bg-ink-700 motion-safe:animate-[fade-up_0.4s_ease-out_backwards] ${skill.archivedAt ? 'opacity-55' : ''}`}
```

Replace with:

```tsx
              className={`flex items-center gap-5 bg-ink-800 px-[22px] py-5 transition-colors duration-200 hover:bg-ink-700 motion-safe:animate-[fade-up_0.4s_ease-out_backwards] ${skill.archivedAt ? 'opacity-55' : ''}`}
```

- [ ] **Step 3: Add a hover transition to the tag filter chips in `ListeSkills.tsx`**

In the same file, the tag-filter class string appears twice (the "Tous les tags" button and the per-tag button in the `allTags.map` block), character-for-character identical:

```
font-data text-xs px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900
```

Replace **both** occurrences (use a find-and-replace-all on this exact substring, not a single-instance edit) with:

```
font-data text-xs px-3 py-1.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900
```

- [ ] **Step 4: Add a hover transition to due-skill rows in `Accueil.tsx`**

Read `src/renderer/src/screens/Accueil.tsx`. Find, inside the `dueSkills.map` block:

```tsx
                <Link to={`/skills/${skill.id}`} className="flex-1 hover:opacity-80">
```

Replace with:

```tsx
                <Link to={`/skills/${skill.id}`} className="flex-1 transition-opacity duration-150 hover:opacity-80">
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (this task only changes Tailwind class strings — no type surface changes).

- [ ] **Step 6: Manual dev-launch sanity check**

Run: `npm run dev`

Expected: the Electron window opens with no console errors (only the pre-existing, harmless `ERROR:cache_util_win.cc`/`gpu_disk_cache.cc` GPU-cache-permission noise is expected on this machine — anything else is a real regression). Stop the dev process once confirmed (`Ctrl+C` in the terminal running it, or kill the `electron.exe`/`Saint Daily.exe` process).

Full visual confirmation (buttons feel snappier on click, skill rows/tag chips/due-skill links fade smoothly on hover instead of snapping) is left to the user — the Electron desktop window isn't previewable through this session's browser tooling.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Button.tsx src/renderer/src/screens/ListeSkills.tsx src/renderer/src/screens/Accueil.tsx
git commit -m "fix: add hover/press transitions to buttons, skill rows, and tag chips"
```

(`fix:` per this project's versioning convention — a small addition, not a whole new feature; see `docs/superpowers/specs/2026-09-02-release-pipeline-design.md`, "Convention de commit".)

---

## Task 2: Reward pulses in `DetailSkill.tsx` — milestone checked, streak extended

**Files:**
- Modify: `src/renderer/src/lib/streaks.ts`
- Test: `src/renderer/src/lib/streaks.test.ts`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `streakJustExtended(previous: number | null, current: number): boolean` in `src/renderer/src/lib/streaks.ts` — a new exported pure function. Nothing outside this task depends on it; it's defined and consumed within this task's own files.

- [ ] **Step 1: Write the failing test for `streakJustExtended`**

Read `src/renderer/src/lib/streaks.test.ts` to match its existing style, then add a new `describe` block at the end of the file:

```ts
describe('streakJustExtended', () => {
  it('is false with no previous value (first render, nothing to compare against yet)', () => {
    expect(streakJustExtended(null, 5)).toBe(false);
  });

  it('is true when the streak grew', () => {
    expect(streakJustExtended(3, 4)).toBe(true);
  });

  it('is false when the streak held steady or dropped', () => {
    expect(streakJustExtended(4, 4)).toBe(false);
    expect(streakJustExtended(4, 0)).toBe(false);
  });
});
```

Add `streakJustExtended` to the existing import line at the top of the file:

```ts
import { calculateStreak, daysSinceLastPractice, filterByTag, streakJustExtended } from './streaks';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: FAIL — `streakJustExtended` is not exported from `./streaks`.

- [ ] **Step 3: Implement `streakJustExtended`**

Read `src/renderer/src/lib/streaks.ts`. Add this exported function (placement: anywhere at module scope, e.g. right after `calculateStreak`):

```ts
/** Vrai seulement si `current` dépasse une valeur précédente connue —
 *  `previous: null` encode "pas encore de valeur de référence" (premier
 *  rendu), pour ne jamais déclencher un pulse de récompense à l'ouverture
 *  de l'écran. */
export function streakJustExtended(previous: number | null, current: number): boolean {
  return previous !== null && current > previous;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/renderer/src/lib/streaks.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit the pure helper**

```bash
git add src/renderer/src/lib/streaks.ts src/renderer/src/lib/streaks.test.ts
git commit -m "feat: add streakJustExtended helper for the streak reward pulse"
```

- [ ] **Step 6: Read the current `DetailSkill.tsx` imports and state**

Read `src/renderer/src/screens/DetailSkill.tsx` in full (it will have shifted slightly if Task 1 already landed, but Task 1 does not touch this file, so no conflict either way). Confirm the current import line:

```tsx
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
```

and:

```tsx
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
```

- [ ] **Step 7: Add the milestone-checked pulse**

In `DetailSkill.tsx`, update the React import to add `useEffect`:

```tsx
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
```

Add a new piece of state near the existing `actionError` state:

```tsx
  const [actionError, setActionError] = useState<string | null>(null);
  const [celebratingMilestoneId, setCelebratingMilestoneId] = useState<string | null>(null);
```

Replace `handleToggleMilestone`:

```tsx
  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    setActionError(null);
    const { error } = await toggleMilestone(milestoneId, completed);
    if (error) {
      setActionError(error);
      return;
    }
    if (completed) {
      setCelebratingMilestoneId(milestoneId);
      setTimeout(() => setCelebratingMilestoneId((current) => (current === milestoneId ? null : current)), 400);
    }
  }
```

Find the milestone checkbox markup:

```tsx
                    <span className="relative -ml-[27px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={!!m.completedAt}
                        onChange={(e) => handleToggleMilestone(m.id, e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                      >
                        {m.completedAt && <CheckIcon size={11} />}
                      </span>
                    </span>
```

Replace with (adds a `motion.span` glow ring that only renders while celebrating this specific milestone):

```tsx
                    <span className="relative -ml-[27px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={!!m.completedAt}
                        onChange={(e) => handleToggleMilestone(m.id, e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                      >
                        {m.completedAt && <CheckIcon size={11} />}
                      </span>
                      {celebratingMilestoneId === m.id && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-accent-bright"
                          initial={{ opacity: 0.6, scale: 1 }}
                          animate={{ opacity: 0, scale: 2.2 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </span>
```

`motion` is already imported in this file (`import { motion } from 'motion/react';`) — no new import needed for this step.

- [ ] **Step 8: Add the streak-extended pulse**

In `DetailSkill.tsx`, update the streaks import:

```tsx
import { calculateStreak, daysSinceLastPractice, streakJustExtended } from '../lib/streaks';
```

Near the existing `const streak = useMemo(...)` line, add the tracking ref, pulse state, and effect:

```tsx
  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const previousStreakRef = useRef<number | null>(null);
  const [streakPulse, setStreakPulse] = useState(false);

  useEffect(() => {
    const previous = previousStreakRef.current;
    previousStreakRef.current = streak;
    if (streakJustExtended(previous, streak)) {
      setStreakPulse(true);
      const id = setTimeout(() => setStreakPulse(false), 400);
      return () => clearTimeout(id);
    }
  }, [streak]);
```

Find the streak display line:

```tsx
          <p className="relative text-center text-sm text-muted">
            Streak : <span className="text-accent-bright">{streak} j</span> · dernière pratique{' '}
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </p>
```

Replace with:

```tsx
          <p className="relative text-center text-sm text-muted">
            Streak :{' '}
            <motion.span
              className="text-accent-bright"
              animate={streakPulse ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'inline-block' }}
            >
              {streak} j
            </motion.span>{' '}
            · dernière pratique{' '}
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </p>
```

(`display: inline-block` is required for the `scale` transform to visibly apply on an inline element — a bare `<span>` ignores `transform` in CSS.)

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS, including the 3 new `streakJustExtended` tests from Step 1.

- [ ] **Step 11: Manual dev-launch sanity check**

Run: `npm run dev`, navigate (via `/dev-login` if available) to a skill's detail page, check an unchecked milestone.
Expected: no console errors; the milestone checkbox shows a brief gold ring pulse. (Triggering the streak pulse requires logging a practice entry that genuinely extends the streak — reasonable to verify this one visually only if convenient; the underlying detection logic is already covered by the Vitest suite from Step 10.) Stop the dev process once confirmed.

- [ ] **Step 12: Commit**

```bash
git add src/renderer/src/screens/DetailSkill.tsx
git commit -m "feat: add gold pulse feedback when a milestone is checked or a streak extends"
```

---

## Task 3: Pomodoro cycle-complete signal and celebration

**Files:**
- Modify: `src/renderer/src/lib/pomodoro.tsx`
- Modify: `src/renderer/src/screens/Pomodoro.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `PomodoroContextValue.cycleCompletedAt: number | null` — read by `Pomodoro.tsx` via `usePomodoro()`. Nothing outside this task's two files touches it. No new pure helper is needed: the underlying "last cycle of the round" transition is already fully covered by the existing `nextPhase`/`completePhase` tests in `pomodoroLogic.test.ts` (see `'goes from work to a long break on the last cycle of the round'`) — this task only needs to notice, at the call site, that `current.phase === 'work'` and the freshly computed `next.phase === 'longBreak'`, which is a two-field equality check, not new business logic worth its own unit test.

- [ ] **Step 1: Read the current tick effect in `pomodoro.tsx`**

Read `src/renderer/src/lib/pomodoro.tsx` in full, in particular the `PomodoroContextValue` interface and the tick `useEffect` (the block that calls `completePhase`).

- [ ] **Step 2: Add `cycleCompletedAt` to the context type and state**

Update the interface:

```tsx
interface PomodoroContextValue {
  session: PomodoroSession | null;
  durations: PomodoroDurations | null;
  note: string;
  setNote: (note: string) => void;
  error: string | null;
  pinned: boolean;
  cycleCompletedAt: number | null;
  start: (skillId: string, skillName: string) => void;
  pause: () => void;
  resume: () => void;
  advance: () => void;
  stop: () => Promise<void>;
  setPinned: (pinned: boolean) => void;
}
```

Add the state, near the existing `pinned` state:

```tsx
  const [pinned, setPinnedState] = useState(false);
  const [cycleCompletedAt, setCycleCompletedAt] = useState<number | null>(null);
```

- [ ] **Step 3: Set `cycleCompletedAt` when the last cycle of a round completes**

In the tick `useEffect`, find:

```tsx
      const cycleIndexBeforeCompletion = current.cycleIndex;
      const skillNameForNotification = current.skillName;
      const { loggedMinutes, next } = completePhase(
        current,
        currentDurations,
        settings?.pomodoroAutoAdvance ?? true
      );
      setSession(next);
      notifyPhaseChange(next.phase, skillNameForNotification);
```

Replace with:

```tsx
      const cycleIndexBeforeCompletion = current.cycleIndex;
      const skillNameForNotification = current.skillName;
      const { loggedMinutes, next } = completePhase(
        current,
        currentDurations,
        settings?.pomodoroAutoAdvance ?? true
      );
      setSession(next);
      if (current.phase === 'work' && next.phase === 'longBreak') {
        // Auto-effacé après un délai plutôt que par un "consume" explicite
        // côté écran : Pomodoro.tsx peut démonter/remonter (navigation)
        // sans jamais relire un timestamp périmé comme un nouvel événement.
        const completedAt = Date.now();
        setCycleCompletedAt(completedAt);
        setTimeout(() => {
          setCycleCompletedAt((c) => (c === completedAt ? null : c));
        }, 2500);
      }
      notifyPhaseChange(next.phase, skillNameForNotification);
```

- [ ] **Step 4: Expose `cycleCompletedAt` from the provider**

Find the context provider value:

```tsx
    <PomodoroContext.Provider
      value={{ session, durations, note, setNote, error, pinned, start, pause, resume, advance, stop, setPinned }}
    >
```

Replace with:

```tsx
    <PomodoroContext.Provider
      value={{ session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned }}
    >
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, unchanged (this step touches no tested pure logic — `completePhase`/`nextPhase` themselves are untouched).

- [ ] **Step 7: Commit the signal**

```bash
git add src/renderer/src/lib/pomodoro.tsx
git commit -m "feat: signal when a full Pomodoro cycle round completes"
```

- [ ] **Step 8: Read the current `Pomodoro.tsx` screen**

Read `src/renderer/src/screens/Pomodoro.tsx` in full — note it already imports `motion` from `motion/react` and `usePomodoro` from `../lib/pomodoro`, and does NOT currently import `colors` from `../theme/colors`.

- [ ] **Step 9: Consume `cycleCompletedAt` and render the celebration**

Add the `colors` import at the top:

```tsx
import { colors } from '../theme/colors';
```

Update the destructured `usePomodoro()` call:

```tsx
  const { session, durations, note, setNote, error, pinned, cycleCompletedAt, start, pause, resume, advance, stop, setPinned } =
    usePomodoro();
```

Add local state and an effect, near the existing `forceTick` effect:

```tsx
  const [showCycleComplete, setShowCycleComplete] = useState(false);
  useEffect(() => {
    if (!cycleCompletedAt) return;
    setShowCycleComplete(true);
    const id = setTimeout(() => setShowCycleComplete(false), 2000);
    return () => clearTimeout(id);
  }, [cycleCompletedAt]);
```

This requires adding `useEffect` to the existing React import — find:

```tsx
import { useEffect, useState } from 'react';
```

(This import already includes both `useEffect` and `useState` — confirm it during Step 8's read; if for any reason it doesn't, add the missing one.)

Find the ring + timer block:

```tsx
      <div className="relative flex flex-col items-center gap-2">
        <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
      </div>
```

Replace with:

```tsx
      <div className="relative flex flex-col items-center gap-2">
        <motion.div
          className="flex items-center justify-center rounded-full"
          animate={showCycleComplete ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={showCycleComplete ? { filter: `drop-shadow(0 0 18px ${colors.accent.bright}99)` } : undefined}
        >
          <ProgressRing size={160} radius={70} strokeWidth={6} filled={Math.max(0, Math.min(1, filled))} />
        </motion.div>
        <p className="font-serif text-3xl text-champagne">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <p className="font-data text-xs uppercase tracking-[0.1em] text-accent-bright">{phaseLabel}</p>
        {showCycleComplete && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="font-data text-xs uppercase tracking-[0.1em] text-muted"
          >
            Cycle terminé
          </motion.p>
        )}
      </div>
```

This wraps `ProgressRing` from the outside rather than modifying `ProgressRing.tsx` itself — the shared component's props/API stay untouched, per the Global Constraints above.

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 11: Manual dev-launch sanity check**

Run: `npm run dev`. Triggering this celebration for real requires completing an entire Pomodoro round (all `cyclesBeforeLongBreak` work phases) — impractical to wait out manually at default durations. It is reasonable to confirm only that the screen renders with no console errors and that a normal (non-final) phase completion still behaves exactly as before (no visual regression). Stop the dev process once confirmed; full visual confirmation of the celebration itself is left to the user during real use.

- [ ] **Step 12: Commit**

```bash
git add src/renderer/src/screens/Pomodoro.tsx
git commit -m "feat: show a gold pulse and message when a full Pomodoro cycle completes"
```

---

## Self-Review

**Spec coverage:** Socle de mouvement (durées/courbes) → Global Constraints + Task 1 Step 1 (150ms feedback) — no new entrance curve introduced anywhere. Micro-interactions (Button, list rows, tag chips) → Task 1, all 3 call sites named in the spec. Jalon atteint → Task 2, Steps 6-7. Cycle Pomodoro terminé → Task 3, exact `work → longBreak` trigger from the spec's file/line pointer. Série prolongée → Task 2, Steps 6, 8. Hors scope (Phase 2/3, nav rail, nouvelle entrée elle-même, `ProgressRing.tsx` API) → respected: no task touches `App.tsx` routing, `AppShell.tsx`, or `NouvelleEntree.tsx`/`usePracticeEntries.ts`; `ProgressRing.tsx` is wrapped, not modified. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate X" steps — every step shows the actual before/after code. Clean.

**Type consistency:** `PomodoroContextValue.cycleCompletedAt: number | null` (Task 3, Step 2) matches its usage in `Pomodoro.tsx` (Task 3, Step 9) and its provider value (Task 3, Step 4) exactly. `streakJustExtended(previous: number | null, current: number): boolean` (Task 2, Step 3) matches its test calls (Step 1) and its call site in `DetailSkill.tsx` (Step 8) exactly. No drift.

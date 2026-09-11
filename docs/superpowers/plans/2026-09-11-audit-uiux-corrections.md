# Corrections Audit UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 findings from the 2026-09-11 UI/UX Pro Max audit: the priority-color palette failing non-text contrast on the Calendrier, calendar empty-slot cells being mouse-only, a raw checkbox where the app's `Toggle` belongs, and a required field with no proactive visual indicator.

**Architecture:** Four independent, surgical fixes to existing screens/components — no new files, no schema change, no new pure logic. Each fix stands alone and can be reviewed/merged independently of the others.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind, same stack as the rest of the app. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-audit-uiux-corrections-design.md`

## Global Constraints

- New priority colors must clear WCAG 1.4.11's 3:1 non-text contrast minimum on `ink-800` (`#0B5F49`), the more contraining of the two backgrounds the palette renders on. Exact approved values: `elevee` → `#FF9494`, `moyenne` → `#E6AD70`, `basse` → `#8FC2BC`.
- `elevee` gets its own dedicated value — it must NOT reuse (or change) the shared `danger` token (`#F87171`), since `danger` is also used for error text (`role="alert"`) elsewhere in the app and is out of scope for this audit.
- No unit tests are added in this plan — every change here is markup/styling/token, not new pure logic. This project's Vitest suite covers pure logic only (`src/renderer/src/lib/**/*.test.ts`); verification is `npm run typecheck`, `npm test` (confirming nothing existing broke), and a live manual pass in the running app.
- This project's comment convention: no comments explaining WHAT code does, only non-obvious WHY.

---

### Task 1: Priority palette contrast + non-color cue

**Files:**
- Modify: `src/renderer/src/theme/colors.ts:25-36`
- Modify: `src/renderer/src/screens/Accueil.tsx:13, 266-271`
- Modify: `src/renderer/src/screens/Calendrier.tsx:7, 222-236`

**Interfaces:**
- Consumes: `PRIORITY_COLORS: Record<Priority, string | null>` and `PRIORITY_LABELS: Record<Priority, string>`, both already exported from `src/renderer/src/lib/priority.ts` — unchanged by this task, they just resolve to new hex values via `colors.priority`.
- Produces: nothing new consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Replace the priority palette in `theme/colors.ts`**

Current (lines 25-36):

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

Replace with:

```ts
  danger: '#F87171',
  // La palette d'origine (élevée = `danger`, moyenne #D2894A, basse #6FA8A3)
  // passait sous 3:1 (WCAG 1.4.11, contraste non-textuel) sur le fond
  // ink-800 du Calendrier — vérifiée uniquement sur ink-900 à l'origine
  // (audit ui-ux-pro-max, 2026-09-11). Nouvelles valeurs, avec marge au-dessus
  // de 3:1 sur les DEUX fonds où la palette s'affiche réellement :
  //   élevée  4.59:1 sur ink-900 / 3.61:1 sur ink-800
  //   moyenne 4.89:1 sur ink-900 / 3.85:1 sur ink-800
  //   basse   4.91:1 sur ink-900 / 3.86:1 sur ink-800
  // `elevee` ne réutilise plus `danger` : `danger` sert aussi au texte
  // d'erreur (role="alert") ailleurs dans l'app, l'éclaircir aurait changé
  // ce rendu partout — `elevee` reçoit sa propre valeur, même famille de
  // rouge. `moyenne`/`basse` évitent volontairement accent.bright, qui
  // signale déjà "actif/primaire" ailleurs dans l'app (nav, boutons).
  priority: {
    elevee: '#FF9494',
    moyenne: '#E6AD70',
    basse: '#8FC2BC',
  },
} as const;
```

- [ ] **Step 2: Add a non-color cue to the Accueil priority dot**

In `src/renderer/src/screens/Accueil.tsx`, line 13 currently reads:

```tsx
import { PRIORITY_COLORS } from '../lib/priority';
```

Change to:

```tsx
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/priority';
```

Then, lines 266-271 currently read:

```tsx
                    {PRIORITY_COLORS[task.priority] && (
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: PRIORITY_COLORS[task.priority] as string }}
                      />
                    )}
```

Replace with:

```tsx
                    {PRIORITY_COLORS[task.priority] && (
                      <span
                        role="img"
                        aria-label={`Priorité : ${PRIORITY_LABELS[task.priority]}`}
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: PRIORITY_COLORS[task.priority] as string }}
                      />
                    )}
```

- [ ] **Step 3: Add a non-color cue to the Calendrier task block**

In `src/renderer/src/screens/Calendrier.tsx`, line 7 currently reads:

```tsx
import { PRIORITY_COLORS } from '../lib/priority';
```

Change to:

```tsx
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/priority';
```

Then, lines 222-236 currently read:

```tsx
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
```

Replace with:

```tsx
                const priorityColor = PRIORITY_COLORS[task.priority];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setPopoverTask(task)}
                    aria-label={priorityColor ? `${task.name} — priorité ${PRIORITY_LABELS[task.priority]}` : undefined}
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
```

`aria-label` is `undefined` (not set) when there's no priority — the button keeps deriving its accessible name from the visible text `task.name`, exactly as today, so a task with `priority: 'aucune'` has zero change in behavior.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass (this task touches no pure logic, so no test should change behavior).

- [ ] **Step 6: Manual verification**

Start the app (`npm run dev`), open Accueil and Calendrier with at least one task at each priority level (Basse/Moyenne/Élevée), and confirm:
- The dot (Accueil) and the left border (Calendrier) render in the new colors.
- A `priority: 'aucune'` task shows no dot and no colored border, exactly as before.
- Inspecting the accessibility tree (or a screen reader) on both screens announces "Priorité : <niveau>" for the dot, and "<nom> — priorité <niveau>" for the calendar block.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/theme/colors.ts src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "fix: raise priority palette to WCAG 3:1 non-text contrast, add aria-label"
```

---

### Task 2: Keyboard-accessible calendar empty-slot cells

**Files:**
- Modify: `src/renderer/src/screens/Calendrier.tsx:13-15, 210-216` (line numbers assume Task 1 hasn't shifted them — locate the empty-slot block by the shown code, not by line number, if this task runs after Task 1)

**Interfaces:**
- Consumes: `handleEmptySlotClick(day: Date, hour: number): void`, already defined in this file (lines 89-93) — unchanged by this task.
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Add a local `FOCUS_RING` constant**

`Calendrier.tsx` currently has no focus-ring constant (every other screen that needs one — `NouvelleTache.tsx`, `Reglages.tsx`, `Pomodoro.tsx`, etc. — defines its own local copy of the same string; there is no shared export). Lines 13-15 currently read:

```tsx
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_PX = 64; // doit rester en phase avec la classe Tailwind h-16 ci-dessous
```

Add a fourth constant directly after them:

```tsx
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_PX = 64; // doit rester en phase avec la classe Tailwind h-16 ci-dessous
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
```

(Exact line numbers in this file may already have shifted if Task 1 ran first — locate this block by content, not by line number: it's the group of top-level `const` declarations right before `export default function Calendrier()`.)

- [ ] **Step 2: Make the empty-slot cell a real interactive element**

Lines 210-216 currently read:

```tsx
              {HOURS.map((h) => (
                <div
                  key={h}
                  onClick={() => handleEmptySlotClick(day, h)}
                  className="h-16 cursor-pointer border-b border-ink-800 hover:bg-ink-800/50"
                />
              ))}
```

Replace with:

```tsx
              {HOURS.map((h) => (
                <div
                  key={h}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEmptySlotClick(day, h)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEmptySlotClick(day, h);
                    }
                  }}
                  aria-label={`Créer une tâche le ${day.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} à ${String(h).padStart(2, '0')}:00`}
                  className={`h-16 cursor-pointer border-b border-ink-800 hover:bg-ink-800/50 ${FOCUS_RING}`}
                />
              ))}
```

`e.preventDefault()` on Space stops the page from scrolling while the cell is focused — the same reason every button-like element in this codebase needs it on Space, not just Enter.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 5: Manual verification**

Start the app, open Calendrier, and confirm:
- Pressing Tab repeatedly moves focus into the empty hour cells (visible focus ring appears), not just past them.
- Pressing Enter or Space on a focused empty cell navigates to "Nouvelle tâche" with the same preselected time as a click would.
- Clicking still works exactly as before.
- The accessibility tree names each cell "Créer une tâche le <jour> à <heure>".

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Calendrier.tsx
git commit -m "fix: make calendar empty-slot cells keyboard-accessible"
```

---

### Task 3: Replace the raw checkbox with the shared Toggle component

**Files:**
- Modify: `src/renderer/src/screens/Calendrier.tsx:9, 141-148` (line numbers assume Task 1/2 haven't shifted them — locate both blocks by the shown code, not by line number, if this task runs after Task 1 or 2)

**Interfaces:**
- Consumes: `Toggle` component from `src/renderer/src/components/Toggle.tsx`, signature `{ checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; bordered?: boolean }` — already exists, unchanged.
- Consumes: `handleTogglePracticeInCalendar(checked: boolean): Promise<void>`, already defined in this file (lines 95-98) — unchanged by this task.
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Import `Toggle`**

In `src/renderer/src/screens/Calendrier.tsx`, line 9 currently reads:

```tsx
import TaskPopover from '../components/TaskPopover';
```

Add a new import line directly after it:

```tsx
import TaskPopover from '../components/TaskPopover';
import Toggle from '../components/Toggle';
```

- [ ] **Step 2: Replace the native checkbox**

Lines 141-148 currently read:

```tsx
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={settings?.showPracticeInCalendar ?? false}
              onChange={(e) => handleTogglePracticeInCalendar(e.target.checked)}
            />
            Inclure l'historique de pratique
          </label>
```

Replace with:

```tsx
          <Toggle
            checked={settings?.showPracticeInCalendar ?? false}
            onChange={handleTogglePracticeInCalendar}
            label="Inclure l'historique de pratique"
            bordered={false}
          />
```

`bordered={false}` drops the `border-b`/`last:border-b-0` that `Toggle` adds by default for its usual context (a vertical list of settings rows in Réglages) — here it sits inline in a horizontal toolbar next to "Aujourd'hui" and the week-navigation buttons, where a bottom border would look like a stray line under the whole row.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 5: Manual verification**

Start the app, open Calendrier, and confirm:
- The control now renders as a pill/track switch matching the ones on Réglages, not a native checkbox.
- Toggling it on/off still shows/hides practice-history entries on the calendar, and the state persists across a reload (same behavior as before, just via the new control).
- The toolbar row (toggle, "Aujourd'hui", week-nav arrows) doesn't look visually broken or overflow — if the toggle's height noticeably unbalances the row, note it, but do not modify `Toggle.tsx` itself (it's shared with Réglages/ListeSkills and out of scope here).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Calendrier.tsx
git commit -m "fix: use the shared Toggle component for the calendar practice-history switch"
```

---

### Task 4: Proactive required-indicator on the "Nom" field

**Files:**
- Modify: `src/renderer/src/components/FormField.tsx:10-21`
- Modify: `src/renderer/src/screens/NouveauSkill.tsx:48`

**Interfaces:**
- Produces: `FormField` gains an optional `required?: boolean` prop. When `true`, it renders a visible marker next to the label and sets the native `required` attribute on the `<input>`. When omitted, rendering is byte-for-byte identical to today — every other `FormField` call site in the app (`NouvelleTache.tsx`, `NouvelleEntree.tsx`, etc.) is unaffected.

- [ ] **Step 1: Add the `required` prop to `FormField`**

`src/renderer/src/components/FormField.tsx` lines 10-21 currently read:

```tsx
export function FormField({
  label,
  className = '',
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={LABEL}>
      {label}
      <input {...props} className={`${FIELD} text-[15px] ${className}`.trim()} />
    </label>
  );
}
```

Replace with:

```tsx
export function FormField({
  label,
  required,
  className = '',
  ...props
}: { label: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={LABEL}>
      <span>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        )}
      </span>
      <input required={required} {...props} className={`${FIELD} text-[15px] ${className}`.trim()} />
    </label>
  );
}
```

`aria-hidden` on the asterisk avoids a screen reader announcing a stray "asterisk" — the `required` attribute on the `<input>` already communicates required-ness to assistive tech natively; the asterisk is purely the missing *visual* cue for sighted users that this audit finding is about. `required={required}` is placed before `{...props}` so an explicit `required` passed through `...props` (none of the current call sites do this) would still win — there is no such call site today, so this ordering has no observable effect yet, it's just the safer default.

- [ ] **Step 2: Mark "Nom" as required on NouveauSkill**

`src/renderer/src/screens/NouveauSkill.tsx` line 48 currently reads:

```tsx
        <FormField label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
```

Replace with:

```tsx
        <FormField label="Nom" required value={name} onChange={(e) => setName(e.target.value)} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 5: Manual verification**

Start the app, open "Nouveau skill", and confirm:
- The "Nom" label shows a red asterisk, visible before any interaction with the form.
- Every other screen using `FormField` (Nouvelle tâche's "Titre", Nouvelle entrée, etc.) renders exactly as before — no stray asterisk anywhere else.
- Submitting with "Nom" empty still shows the existing `role="alert"` error message (unchanged behavior, this task only adds the proactive cue).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/FormField.tsx src/renderer/src/screens/NouveauSkill.tsx
git commit -m "fix: add proactive required-indicator to NouveauSkill's Nom field"
```

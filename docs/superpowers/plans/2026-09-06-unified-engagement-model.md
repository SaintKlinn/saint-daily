# Unified Engagement Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Saint Daily's `skill` table into a generalized `engagement` table (distinguished from a one-off task only by whether `scheduled_at` is set), rename the shared data layer to match, and add a first minimal way to create and complete a one-off task before any calendar exists.

**Architecture:** A metadata-only SQL migration renames `skill` → `engagement` (adding one nullable `scheduled_at` column) and `skill_milestone` → `engagement_milestone`, and renames the `skill_id` foreign key column on both `engagement_milestone` and `practice_entry` to `engagement_id`. The shared hooks (`useSkills`/`useMilestones`/`usePracticeEntries`) and `lib/types.ts` are updated to match. Every existing skill-specific screen keeps its own routes, filenames, and "Skill" wording — they just filter the renamed hook's results down to non-scheduled engagements. A new, separate screen and a new Accueil section handle tasks additively.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `motion/react`, `@supabase/supabase-js`, PostgreSQL (Supabase-hosted)

**Spec:** [docs/superpowers/specs/2026-09-06-unified-engagement-model-design.md](../specs/2026-09-06-unified-engagement-model-design.md)

## Global Constraints

- **One merged table, not two** — `engagement` carries every field skills have today plus one nullable `scheduled_at`; no separate extension table.
- **The skill/task distinction is `scheduled_at` alone** — no new "type" or "recurrence" column in this plan.
- **Existing skill screens (`ListeSkills.tsx`, `DetailSkill.tsx`, `NouveauSkill.tsx`), their routes, and the displayed word "Skill" are untouched** — they only change internally to consume the renamed hook, filtered to `!engagement.scheduledAt`.
- **No calendar, no recurrence patterns, no advanced task mechanics (priority, subtasks, snooze)** — those are separate, future sub-projects. This plan only adds: the data model, a minimal task-creation screen, and a separate "Tâches à faire" display on Accueil.
- **Completing a task is inserting a `practice_entry` row** (`duration_minutes: 0`, `note: null`) — no new "completed" column.
- **No comments explaining WHAT code does, only non-obvious WHY** — match the style already visible throughout these files.

---

## Task 1: Migration SQL and shared types

**Files:**
- Create: `supabase/migrations/0004_unified_engagement_model.sql`
- Modify: `src/renderer/src/lib/types.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the exact SQL later applied in Task 6 (table/column names `engagement`, `engagement_milestone`, `engagement_id`, `scheduled_at`). `Engagement`, `EngagementMilestone`, and `PracticeEntry.engagementId` — the type names and field every later task imports from `lib/types.ts`.

- [ ] **Step 1: Read `supabase/migrations/0001_saint_daily_tables.sql` once more to confirm the exact check constraint name**

The `practice_entry` table has `duration_minutes int not null check (duration_minutes > 0)` with no explicit constraint name — Postgres auto-names an unnamed column check constraint `<table>_<column>_check`, so this one is `practice_entry_duration_minutes_check`. Confirm this file still matches what's quoted here before proceeding; if it doesn't, stop and report rather than guessing a different name.

- [ ] **Step 2: Write the migration file**

`supabase/migrations/0004_unified_engagement_model.sql`:

```sql
-- Fusionne skill et tâche ponctuelle dans une seule table `engagement`,
-- distinguée uniquement par la présence de `scheduled_at` — premier
-- sous-projet de l'évolution "Daily Tool" (voir spec). Opérations de
-- métadonnées pures (ALTER TABLE ... RENAME), aucune réécriture de
-- données ; les contraintes de clé étrangère et les policies RLS restent
-- attachées aux mêmes objets (Postgres les retrouve par OID, pas par nom).
alter table saint_daily.skill rename to engagement;
alter table saint_daily.engagement add column scheduled_at timestamptz;

alter table saint_daily.skill_milestone rename to engagement_milestone;
alter table saint_daily.engagement_milestone rename column skill_id to engagement_id;

alter table saint_daily.practice_entry rename column skill_id to engagement_id;

-- Cocher une tâche ponctuelle comme faite insère une entrée à durée
-- nulle (voir spec, "Cocher une tâche comme faite") — la contrainte
-- d'origine (> 0) ne visait que les séances de pratique réelles, jamais
-- pensée pour ce nouveau cas d'usage.
alter table saint_daily.practice_entry drop constraint practice_entry_duration_minutes_check;
alter table saint_daily.practice_entry add constraint practice_entry_duration_minutes_check check (duration_minutes >= 0);
```

- [ ] **Step 3: Re-read the file once and confirm each statement matches this task exactly**

Confirm: 2 table renames, 1 added column, 1 column rename on `engagement_milestone`, 1 column rename on `practice_entry`, 1 constraint drop+recreate. No `CREATE TABLE`, no data-copying statement, no schema change beyond what's listed here — this migration only moves and renames existing objects and loosens one check constraint.

- [ ] **Step 4: Update `lib/types.ts`**

Read `src/renderer/src/lib/types.ts`. Find:

```ts
export interface Skill {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  createdAt: string;
}

export interface SkillMilestone {
  id: string;
  skillId: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface PracticeEntry {
  id: string;
  skillId: string;
  userId: string;
  durationMinutes: number;
  note: string | null;
  practicedAt: string;
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
  createdAt: string;
}

export interface EngagementMilestone {
  id: string;
  engagementId: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface PracticeEntry {
  id: string;
  engagementId: string;
  userId: string;
  durationMinutes: number;
  note: string | null;
  practicedAt: string;
  createdAt: string;
}
```

(`SkillAppSettings` and `GenericLevel` are untouched — leave them exactly where they are in the file.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: FAILS — every file still importing `Skill`/`SkillMilestone` from `lib/types.ts` now has a broken import. This is expected at this point in the plan; Tasks 2-3 fix every one of them. Confirm the failures are all "has no exported member 'Skill'" / "'SkillMilestone'" style errors, nothing unrelated.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_unified_engagement_model.sql src/renderer/src/lib/types.ts
git commit -m "feat: add the unified engagement migration and rename Skill types to Engagement"
```

This commit does **not** apply the migration to the live database — that is Task 6, done explicitly with the user's confirmation once Tasks 1-5 are all ready.

---

## Task 2: Rename the shared hooks

**Files:**
- Create: `src/renderer/src/hooks/useEngagements.ts` (contents of the current `useSkills.ts`, renamed and updated)
- Delete: `src/renderer/src/hooks/useSkills.ts`
- Modify: `src/renderer/src/hooks/useMilestones.ts`
- Modify: `src/renderer/src/hooks/usePracticeEntries.ts`

**Interfaces:**
- Consumes: `Engagement`, `EngagementMilestone`, `PracticeEntry` from Task 1's `lib/types.ts`.
- Produces: `useEngagements()` returning `{ engagements, loading, error, refresh, createEngagement, updateEngagement, setArchived }` (renamed from `useSkills`'s `skills`/`createSkill`/`updateSkill`). `useMilestones(engagementId: string | null)` returning the same shape as before (`milestones`, `addMilestone`, `toggleMilestone`) but backed by `engagement_milestone`/`engagement_id`. `usePracticeEntries(engagementId: string | null)`'s `logEntry` now takes `{ engagementId, durationMinutes, note?, practicedAt? }`. `useAllPracticeEntries` unchanged in name and returned shape (`entriesBySkill` stays named as-is — deliberate, see Step 5).

- [ ] **Step 1: Create `useEngagements.ts`**

Read `src/renderer/src/hooks/useSkills.ts` one more time to confirm it still matches what's quoted in this plan's context, then create `src/renderer/src/hooks/useEngagements.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
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

export function useEngagements() {
  const { session } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setEngagements((data as EngagementRow[]).map(fromRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // `genericLevel` optionnel : sans objet pour une tâche ponctuelle,
  // laissée absente du payload pour que la colonne applique son propre
  // défaut plutôt que de dupliquer 'debutant' ici.
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
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

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

- [ ] **Step 2: Delete `useSkills.ts`**

```bash
git rm src/renderer/src/hooks/useSkills.ts
```

- [ ] **Step 3: Update `useMilestones.ts`**

Read `src/renderer/src/hooks/useMilestones.ts`, then replace its entire contents with:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { toFrenchError } from '../lib/errors';
import type { EngagementMilestone } from '../lib/types';

interface MilestoneRow {
  id: string;
  engagement_id: string;
  label: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

function fromRow(row: MilestoneRow): EngagementMilestone {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    label: row.label,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function useMilestones(engagementId: string | null) {
  const [milestones, setMilestones] = useState<EngagementMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!engagementId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement_milestone')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('position', { ascending: true });
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setMilestones((data as MilestoneRow[]).map(fromRow));
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addMilestone(label: string) {
    if (!engagementId) return { error: 'Aucun engagement sélectionné' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement_milestone')
      .insert({ engagement_id: engagementId, label, position: milestones.length });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function toggleMilestone(id: string, completed: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement_milestone')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  return { milestones, loading, error, refresh, addMilestone, toggleMilestone };
}
```

- [ ] **Step 4: Update `usePracticeEntries.ts`**

Read `src/renderer/src/hooks/usePracticeEntries.ts`, then replace its entire contents with:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { PracticeEntry } from '../lib/types';

interface PracticeEntryRow {
  id: string;
  engagement_id: string;
  user_id: string;
  duration_minutes: number;
  note: string | null;
  practiced_at: string;
  created_at: string;
}

function fromRow(row: PracticeEntryRow): PracticeEntry {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    userId: row.user_id,
    durationMinutes: row.duration_minutes,
    note: row.note,
    practicedAt: row.practiced_at,
    createdAt: row.created_at,
  };
}

export function usePracticeEntries(engagementId: string | null) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!engagementId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('practice_entry')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('practiced_at', { ascending: false });
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setEntries((data as PracticeEntryRow[]).map(fromRow));
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logEntry(input: {
    engagementId: string;
    durationMinutes: number;
    note?: string | null;
    practicedAt?: string;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      engagement_id: input.engagementId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
    });
    if (insertError) return { error: toFrenchError(insertError.message) };
    if (input.engagementId === engagementId) await refresh();
    return { error: null };
  }

  return { entries, loading, error, refresh, logEntry };
}

/**
 * Toutes les entrées de plusieurs engagements en une seule requête —
 * utilisé par l'Accueil pour calculer streak/régularité de chaque skill
 * actif et pour savoir quelles tâches ont déjà une entrée, sans une
 * requête par engagement.
 */
export function useAllPracticeEntries(engagementIds: string[]) {
  const [entriesBySkill, setEntriesBySkill] = useState<Record<string, PracticeEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = engagementIds.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (engagementIds.length === 0) {
        setEntriesBySkill({});
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      // L'erreur DOIT être capturée : sans elle, un échec de cette requête
      // affichait silencieusement tous les skills avec streak 0 et aucun
      // rappel « dû », sans le moindre indice que quelque chose a raté.
      const { data, error: fetchError } = await getSupabaseClient()
        .from('practice_entry')
        .select('*')
        .in('engagement_id', engagementIds);
      if (cancelled) return;
      setError(fetchError ? toFrenchError(fetchError.message) : null);
      const bySkill: Record<string, PracticeEntry[]> = {};
      for (const row of (data ?? []) as PracticeEntryRow[]) {
        const entry = fromRow(row);
        (bySkill[entry.engagementId] ??= []).push(entry);
      }
      setEntriesBySkill(bySkill);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // key (la liste d'ids jointe) est la vraie dépendance : évite un
    // effet qui re-fetch à chaque re-render sur une nouvelle identité de
    // tableau sans changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { entriesBySkill, loading, error };
}
```

(`entriesBySkill` keeps its name deliberately — it's a local return-value label, not part of the rename scope; renaming it would only add churn to every consumer for no functional benefit.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: still FAILS — the consumer screens (Task 3) haven't been updated yet. Confirm the remaining errors are all in `NouveauSkill.tsx`, `ListeSkills.tsx`, `DetailSkill.tsx`, `Accueil.tsx`, `NouvelleEntree.tsx`, `SkillPicker.tsx`, `Pomodoro.tsx` — every hook file itself should now be error-free in isolation.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/hooks/useEngagements.ts src/renderer/src/hooks/useMilestones.ts src/renderer/src/hooks/usePracticeEntries.ts
git rm src/renderer/src/hooks/useSkills.ts
git commit -m "feat: rename useSkills to useEngagements, generalize the milestone and practice-entry hooks"
```

(If `useSkills.ts` was already removed via `git rm` in Step 2, this commit just adds the three other files — `git status` first to see exactly what's staged.)

---

## Task 3: Update every existing consumer to compile and behave correctly

**Files:**
- Modify: `src/renderer/src/screens/ListeSkills.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/screens/NouveauSkill.tsx`
- Modify: `src/renderer/src/screens/Accueil.tsx`
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx`
- Modify: `src/renderer/src/components/SkillPicker.tsx`
- Modify: `src/renderer/src/screens/Pomodoro.tsx`
- Modify: `src/renderer/src/lib/pomodoro.tsx`

**Interfaces:**
- Consumes: `useEngagements()`, `Engagement`, `EngagementMilestone` from Tasks 1-2.
- Produces: nothing further downstream — Task 4 and Task 5 build new, separate screens/sections rather than depending on anything from this task beyond the app compiling and working again.

- [ ] **Step 1: `ListeSkills.tsx`**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { skills, error } = useSkills();
```

Replace with:

```tsx
  const { engagements, error } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

Nothing else in this file changes — every remaining reference is to `skill.id`/`skill.name`/`skill.tags`/`skill.archivedAt`/`skill.genericLevel`/`skill.notes`, all field names that stayed identical on `Engagement`.

- [ ] **Step 2: `DetailSkill.tsx`**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { skills, loading, error: skillsError, updateSkill, setArchived } = useSkills();
```

Replace with:

```tsx
  const { engagements, loading, error: skillsError, updateEngagement, setArchived } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

This adds a second `useMemo` import need — `useMemo` is already imported in this file (`import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';`), no import change needed.

Find the two call sites of `updateSkill` and update them to `updateEngagement`:

```tsx
    const { error } = await updateSkill(skill.id, { genericLevel: e.target.value as GenericLevel });
```

Replace with:

```tsx
    const { error } = await updateEngagement(skill.id, { genericLevel: e.target.value as GenericLevel });
```

And:

```tsx
        <NotesSection key={skill.id} notes={skill.notes} onSave={(notes) => updateSkill(skill.id, { notes })} />
```

Replace with:

```tsx
        <NotesSection key={skill.id} notes={skill.notes} onSave={(notes) => updateEngagement(skill.id, { notes })} />
```

Nothing else changes — `useMilestones(id ?? null)` and `usePracticeEntries(id ?? null)` are positional calls, unaffected by their parameters being renamed internally, and every field this file reads off `milestones`/`entries` (`m.id`, `m.completedAt`, `m.label`, `entry.practicedAt`, `entry.durationMinutes`, `entry.note`) is unchanged.

- [ ] **Step 3: `NouveauSkill.tsx`**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { createSkill } = useSkills();
```

Replace with:

```tsx
  const { createEngagement } = useEngagements();
```

Find:

```tsx
    const { error: createError } = await createSkill({ name: name.trim(), tags, genericLevel, notes: notes || null });
```

Replace with:

```tsx
    const { error: createError } = await createEngagement({ name: name.trim(), tags, genericLevel, notes: notes || null });
```

- [ ] **Step 4: `NouvelleEntree.tsx`**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { skills } = useSkills();
```

Replace with:

```tsx
  const { engagements } = useEngagements();
  const skills = engagements.filter((e) => !e.scheduledAt);
```

Find:

```tsx
    const { error: logError } = await logEntry({ skillId, durationMinutes, note: note || null });
```

Replace with:

```tsx
    const { error: logError } = await logEntry({ engagementId: skillId, durationMinutes, note: note || null });
```

(The local state variable stays named `skillId` — this screen is still specifically the skill-practice journal form, only the object key passed to the hook changes.)

- [ ] **Step 5: `SkillPicker.tsx`**

Read the file. Find:

```tsx
import { calculateStreak, daysSinceLastPractice, filterSkillsForPicker, sortSkillsByRecentPractice } from '../lib/streaks';
import { SearchIcon } from './icons';
import type { PracticeEntry, Skill } from '../lib/types';
```

Replace with:

```tsx
import { calculateStreak, daysSinceLastPractice, filterSkillsForPicker, sortSkillsByRecentPractice } from '../lib/streaks';
import { SearchIcon } from './icons';
import type { Engagement, PracticeEntry } from '../lib/types';
```

Find:

```tsx
  skills,
  entriesBySkill,
  value,
  onChange,
  loading = false,
}: {
  skills: Skill[];
  entriesBySkill: Record<string, PracticeEntry[]>;
  value: string;
  onChange: (skillId: string) => void;
  loading?: boolean;
}) {
```

Replace with:

```tsx
  skills,
  entriesBySkill,
  value,
  onChange,
  loading = false,
}: {
  skills: Engagement[];
  entriesBySkill: Record<string, PracticeEntry[]>;
  value: string;
  onChange: (skillId: string) => void;
  loading?: boolean;
}) {
```

`filterSkillsForPicker`/`sortSkillsByRecentPractice` (from `lib/streaks.ts`) are generic over structural shapes (`T extends { name: string; archivedAt: string | null }`, `T extends { id: string; name: string }`) — `Engagement` already satisfies both, so `lib/streaks.ts` itself needs no change. Nothing else in this file changes; the prop name `skills` and every field access inside stay as-is (this component only ever receives skill-type engagements, per Task 6's call site in `Pomodoro.tsx`).

- [ ] **Step 6: `Pomodoro.tsx`**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { skills } = useSkills();
```

Replace with:

```tsx
  const { engagements } = useEngagements();
  const skills = engagements.filter((e) => !e.scheduledAt);
```

Nothing else in this file changes.

- [ ] **Step 7: `lib/pomodoro.tsx`**

Read the file. This file does not import `Skill`/`useSkills` at all — its only needed change is the raw Supabase insert payload key, which must match the renamed database column regardless of any TypeScript type. Find, in `logCheckpoint`:

```tsx
        .insert({
          skill_id: skillId,
          user_id: authSession.user.id,
          duration_minutes: minutes,
          note: checkpointNoteLabel(cycleIndex, cyclesBeforeLongBreak),
        })
```

Replace with:

```tsx
        .insert({
          engagement_id: skillId,
          user_id: authSession.user.id,
          duration_minutes: minutes,
          note: checkpointNoteLabel(cycleIndex, cyclesBeforeLongBreak),
        })
```

Find, in `stopInternal()` (the partial-minutes checkpoint):

```tsx
        .insert({
          skill_id: current.skillId,
          user_id: currentAuthSession.user.id,
          duration_minutes: partialMinutes,
          note: checkpointNoteLabel(current.cycleIndex, currentDurations.cyclesBeforeLongBreak),
        })
```

Replace with:

```tsx
        .insert({
          engagement_id: current.skillId,
          user_id: currentAuthSession.user.id,
          duration_minutes: partialMinutes,
          note: checkpointNoteLabel(current.cycleIndex, currentDurations.cyclesBeforeLongBreak),
        })
```

Find, further down in `stopInternal()` (the consolidated entry insert):

```tsx
        const { error: insertError } = await supabase.from('practice_entry').insert({
          skill_id: current.skillId,
          user_id: currentAuthSession.user.id,
          duration_minutes: total,
          note: noteAtStop ? noteAtStop : null,
        });
```

Replace with:

```tsx
        const { error: insertError } = await supabase.from('practice_entry').insert({
          engagement_id: current.skillId,
          user_id: currentAuthSession.user.id,
          duration_minutes: total,
          note: noteAtStop ? noteAtStop : null,
        });
```

(`current.skillId`/`skillId` on the right-hand side are `PomodoroSession`'s own field names, defined in `pomodoroLogic.ts` — unrelated to this rename, not touched.)

- [ ] **Step 8: `Accueil.tsx` — mechanical part only**

Read the file. Find:

```tsx
import { useSkills } from '../hooks/useSkills';
```

Replace with:

```tsx
import { useEngagements } from '../hooks/useEngagements';
```

Find:

```tsx
  const { skills, error: skillsError } = useSkills();
```

Replace with:

```tsx
  const { engagements, error: skillsError } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
```

Task 5 builds the new "Tâches à faire" section and completion action on top of this — don't add either yet in this task, just get the file compiling and behaving exactly as before.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS — every consumer now compiles against the renamed types and hooks.

- [ ] **Step 10: Grep for anything missed**

Run these three commands and confirm each returns no results (other than inside `node_modules`, which none of these should touch):

```bash
grep -rn "useSkills" src/
grep -rn "SkillMilestone" src/
grep -rn "\.skillId\b" src/renderer/src/screens src/renderer/src/components
```

The third grep may still show local variable names like `const [skillId, setSkillId]` in `NouvelleEntree.tsx`/`Pomodoro.tsx` (deliberately kept, per this task's own steps) — that's expected and fine; you're checking for a stray `.skillId` *property access* on an `Engagement`/`PracticeEntry`/`EngagementMilestone`-typed object, which should not exist anywhere after Steps 1-8.

- [ ] **Step 11: Full test suite**

Run: `npm test`
Expected: PASS, 41/41 unchanged — no pure logic in this task's files is exercised by the existing suite in a way that the rename would break (the suite covers `streaks.ts`/`pomodoroLogic.ts`, neither of which changed).

- [ ] **Step 12: Manual dev-launch sanity check**

Run `npm run dev` (generate icons first if this is a fresh worktree: `npm run icons`). Confirm: the skills list, a skill's detail page (milestones, journal, notes), creating a new skill, logging a new practice entry, and starting a Pomodoro session all still work exactly as before. No console errors. This won't yet show anything task-related — that's Tasks 4-5.

- [ ] **Step 13: Commit**

```bash
git add src/renderer/src/screens/ListeSkills.tsx src/renderer/src/screens/DetailSkill.tsx src/renderer/src/screens/NouveauSkill.tsx src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/NouvelleEntree.tsx src/renderer/src/components/SkillPicker.tsx src/renderer/src/screens/Pomodoro.tsx src/renderer/src/lib/pomodoro.tsx
git commit -m "fix: update every screen to consume the renamed engagement hooks"
```

---

## Task 4: New task-creation screen

**Files:**
- Create: `src/renderer/src/screens/NouvelleTache.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `useEngagements()`'s `createEngagement` from Task 2.
- Produces: route `/taches/nouvelle`. Task 5 links to this route from Accueil; nothing else depends on this task's internals.

- [ ] **Step 1: Create `NouvelleTache.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';

export default function NouvelleTache() {
  const navigate = useNavigate();
  const { createEngagement } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le titre est obligatoire.');
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
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
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
          label="Tags (séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Perso, Urgent"
        />
        <FormField
          label="Planification (optionnelle)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
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

- [ ] **Step 2: Register the route**

Read `src/renderer/src/App.tsx`. Find:

```tsx
import NouvelleEntree from './screens/NouvelleEntree';
```

Replace with:

```tsx
import NouvelleEntree from './screens/NouvelleEntree';
import NouvelleTache from './screens/NouvelleTache';
```

Find:

```tsx
          <Route path="entree/nouvelle" element={<NouvelleEntree />} />
```

Replace with:

```tsx
          <Route path="entree/nouvelle" element={<NouvelleEntree />} />
          <Route path="taches/nouvelle" element={<NouvelleTache />} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 5: Manual dev-launch sanity check**

Run `npm run dev`, navigate to `/#/taches/nouvelle` directly (no link to it exists yet — that's Task 5). Confirm: the form renders, creating a task with a title only (no planification) succeeds and redirects to `/`, creating one with a planification date succeeds too. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/NouvelleTache.tsx src/renderer/src/App.tsx
git commit -m "feat: add a minimal screen to create a one-off task"
```

---

## Task 5: "Tâches à faire" section on Accueil

**Files:**
- Modify: `src/renderer/src/screens/Accueil.tsx`

**Interfaces:**
- Consumes: `engagements`/`skills` from Task 3's `Accueil.tsx` wiring; `createEngagement` is not needed here (this task only reads and completes tasks, it doesn't create them — Task 4's screen does that); `logEntry` from `usePracticeEntries`.
- Produces: nothing further downstream — last task in this plan besides the manual migration step.

- [ ] **Step 1: Read the current `Accueil.tsx` (post-Task-3 state)**

Read `src/renderer/src/screens/Accueil.tsx` — it now has the `useEngagements()`/`skills` wiring from Task 3; this task's edits are additive to that.

- [ ] **Step 2: Add the tasks data and the completion handler**

Find:

```tsx
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import { PlusIcon } from '../components/icons';
import { colors } from '../theme/colors';
```

Replace with:

```tsx
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import { CheckIcon, PlusIcon } from '../components/icons';
import { colors } from '../theme/colors';
```

Find (this is the state of the file after Task 3, Step 8):

```tsx
  const { engagements, error: skillsError } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
  const { settings } = useSettings();
  const activeSkills = useMemo(() => skills.filter((s) => !s.archivedAt), [skills]);
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(activeSkills.map((s) => s.id));
```

Replace with:

```tsx
  const { engagements, error: skillsError } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt), [engagements]);
  const { settings } = useSettings();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const activeSkills = useMemo(() => activeEngagements.filter((e) => !e.scheduledAt), [activeEngagements]);
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(activeEngagements.map((e) => e.id));
  const { logEntry } = usePracticeEntries(null);

  const tasks = useMemo(
    () =>
      activeEngagements
        .filter((e) => e.scheduledAt && (entriesBySkill[e.id] ?? []).length === 0)
        .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime()),
    [activeEngagements, entriesBySkill]
  );

  async function handleCompleteTask(taskId: string) {
    await logEntry({ engagementId: taskId, durationMinutes: 0, note: null });
  }
```

(`activeSkills` used to be derived directly from `skills` — it now goes through `activeEngagements` first so the same `!archivedAt` filter also applies correctly to tasks for the `tasks` list above it. The rest of the file's existing use of `activeSkills` for stats/reminders is unaffected — it's the same set of skills as before.)

- [ ] **Step 3: Add the "Tâches à faire" section**

Find the closing of the "Rappels dus" `<section>`:

```tsx
            {dueSkills.map(({ skill, daysSince }, i) => (
              <motion.div
                key={skill.id}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex items-center gap-[18px] border border-ink-700 bg-ink-800 p-[18px] ${i > 0 ? 'border-t-0' : ''}`}
              >
                <ProgressRing
                  size={36}
                  radius={15}
                  filled={settings ? ringFillFromDaysSince(daysSince, settings.reminderThresholdDays) : 0}
                />
                <Link to={`/skills/${skill.id}`} className="flex-1 transition-opacity duration-150 hover:opacity-80">
                  <p className="font-serif text-lg text-champagne">{skill.name}</p>
                  {skill.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </Link>
                <p className="font-data text-[13px] text-muted">pas pratiqué depuis {daysSince} j</p>
                <Link to={`/entree/nouvelle?skillId=${skill.id}`} className={buttonClassName('accent-outline', 'sm')}>
                  Logger
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
```

Replace with (adds the new section right after the existing one closes):

```tsx
            {dueSkills.map(({ skill, daysSince }, i) => (
              <motion.div
                key={skill.id}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex items-center gap-[18px] border border-ink-700 bg-ink-800 p-[18px] ${i > 0 ? 'border-t-0' : ''}`}
              >
                <ProgressRing
                  size={36}
                  radius={15}
                  filled={settings ? ringFillFromDaysSince(daysSince, settings.reminderThresholdDays) : 0}
                />
                <Link to={`/skills/${skill.id}`} className="flex-1 transition-opacity duration-150 hover:opacity-80">
                  <p className="font-serif text-lg text-champagne">{skill.name}</p>
                  {skill.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </Link>
                <p className="font-data text-[13px] text-muted">pas pratiqué depuis {daysSince} j</p>
                <Link to={`/entree/nouvelle?skillId=${skill.id}`} className={buttonClassName('accent-outline', 'sm')}>
                  Logger
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="font-sans text-[15px] font-semibold text-champagne"
          >
            Tâches à faire
          </motion.h2>
          <Link to="/taches/nouvelle" className="text-sm text-accent-bright underline">
            + Nouvelle tâche
          </Link>
        </div>
        {tasks.length === 0 ? (
          <EmptyState>Aucune tâche planifiée.</EmptyState>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
            transition={{ delayChildren: 0.55 }}
            className="flex flex-col"
          >
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex items-center gap-[18px] border border-ink-700 bg-ink-800 p-[18px] ${i > 0 ? 'border-t-0' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleCompleteTask(task.id)}
                  aria-label={`Marquer "${task.name}" comme faite`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink-700 text-muted transition-colors duration-150 hover:border-accent-bright hover:text-accent-bright"
                >
                  <CheckIcon size={12} />
                </button>
                <div className="flex-1">
                  <p className="font-serif text-lg text-champagne">{task.name}</p>
                  {task.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </div>
                <p className="font-data text-[13px] text-muted">
                  {new Date(task.scheduledAt as string).toLocaleString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Confirm `CheckIcon` is actually exported from `src/renderer/src/components/icons.tsx` (it's already used this way in `DetailSkill.tsx`) — if the import fails, re-check that file's exact export name before proceeding.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 6: Manual dev-launch sanity check**

Run `npm run dev`. Confirm: creating a task via `/taches/nouvelle` with a planification date makes it appear in the new "Tâches à faire" section on Accueil, sorted correctly if you create more than one; clicking the checkbox on a task makes it disappear from the list; the "Rappels dus" section and every skill-related stat on Accueil is completely unaffected. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/screens/Accueil.tsx
git commit -m "feat: show and complete planned tasks on the Accueil screen"
```

---

## Task 6: Apply the migration and verify end-to-end

**Files:** none (no code changes — this task applies what Task 1 already produced, against the real, live Supabase project).

**Interfaces:**
- Consumes: `supabase/migrations/0004_unified_engagement_model.sql` (Task 1) and every code change from Tasks 2-5.
- Produces: nothing further downstream — this is the last task in the plan.

**⚠️ This task requires the real user, not just the implementer.** Applying SQL to the live database is an action only the user can take — the implementer must stop and ask for explicit confirmation before Step 1, the same way the earlier schema-namespacing migration in this project was handled (see `docs/superpowers/plans/2026-09-03-schema-namespacing.md`, Task 3). Do not simulate, skip, or assume this happened.

- [ ] **Step 1: Ask the user to apply the migration to the live Supabase project**

Give the user this exact instruction: open the Supabase SQL editor for the project, and run **only** the contents of `supabase/migrations/0004_unified_engagement_model.sql` — not the whole `migrations/` folder, not a tool that might re-run earlier migrations. If the `ALTER TABLE ... DROP CONSTRAINT practice_entry_duration_minutes_check` statement fails with "constraint does not exist," the live database's auto-generated constraint name differs from what this plan assumed — ask the user to find its actual name (via the Supabase table editor's "Constraints" tab on `practice_entry`, under the `saint_daily` schema) and substitute it before re-running just that one statement; do not guess a second name. Wait for the user to confirm the whole migration succeeded before continuing.

- [ ] **Step 2: Verify against the live database**

Launch the app (`npm run dev`) and, using the existing `/dev-login` mechanism, confirm:

- The Accueil screen loads with no errors, shows the real skill stats and "Rappels dus" exactly as before the migration.
- A skill's detail page loads its milestones and journal entries correctly — this is the one place a cross-table RLS policy (`engagement_milestone` checking `engagement.user_id` through a subquery) is exercised; if milestones fail to load or a new one can't be added/toggled, the migration's rename did not carry the policy's internal references the way it should have, and this needs to be diagnosed against the live database rather than patched around blindly.
- Creating a task via `/taches/nouvelle`, seeing it in "Tâches à faire" on Accueil, and completing it all work as verified manually in Task 5 — but now against the real database instead of local-only testing.
- Starting and completing a Pomodoro session still logs a checkpoint correctly (exercises `lib/pomodoro.tsx`'s renamed `engagement_id` insert).

If any of these fail, the fix belongs in whichever earlier task produced the mismatch — do not patch around it with a new, undocumented change in this task.

- [ ] **Step 3: Report the result**

No commit in this task (nothing new to commit — Tasks 1-5 already captured every file change). State clearly whether all four checks in Step 2 passed. This is the final task of the plan.

---

## Self-Review

**Spec coverage:** Schéma unifié (renommages + `scheduled_at`) → Task 1. Portée du renommage (couche partagée renommée, écrans skills inchangés) → Tasks 2-3, with the additional real-world detail (Pomodoro's raw `skill_id` insert literals, `SkillPicker.tsx`'s type import) the spec didn't enumerate but which compilation correctness requires regardless. Création de tâche minimale → Task 4. Affichage séparé "Tâches à faire" + complétion → Task 5. Étape manuelle Supabase → Task 6, matching the established real-user-required pattern. Hors scope (calendrier, récurrence avancée, notifications programmées, etc.) → no task touches any of it. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate X" steps — every step shows the actual before/after code, including the one genuinely uncertain fact (the check constraint's exact auto-generated name) which is flagged as a named risk with a concrete fallback instruction, not glossed over.

**Type consistency:** `Engagement`/`EngagementMilestone`/`PracticeEntry.engagementId` (Task 1) match their use in `useEngagements`/`useMilestones`/`usePracticeEntries` (Task 2) and every consumer (Task 3) exactly. `createEngagement`'s signature (Task 2) matches both its call sites — `NouveauSkill.tsx` (Task 3, passing `genericLevel`) and `NouvelleTache.tsx` (Task 4, omitting it) — exactly, relying on the same optional field. `logEntry`'s `engagementId` key (Task 2) matches its three call sites (`NouvelleEntree.tsx` in Task 3, `Accueil.tsx`'s `handleCompleteTask` in Task 5) exactly. No drift found.

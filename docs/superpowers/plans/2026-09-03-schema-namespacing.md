# Saint Daily Schema Namespacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Saint Daily's 4 tables out of the shared `public` Postgres schema into a dedicated `saint_daily` schema, so the app no longer shares a flat namespace with Saint Gym's 21 tables.

**Architecture:** A new schema-move migration (`ALTER TABLE ... SET SCHEMA`, metadata-only, no data rewrite) relocates all 4 tables and renames `skill_app_settings` to `app_settings` in the same step. The Supabase client is pointed at the new schema by default via one config option, so every existing query resolves correctly with no per-query changes except the one table whose name changed.

**Tech Stack:** PostgreSQL (Supabase-hosted), `@supabase/supabase-js`

**Spec:** [docs/superpowers/specs/2026-09-03-schema-namespacing-design.md](../specs/2026-09-03-schema-namespacing-design.md)

## Global Constraints

- **Saint Gym is out of scope** — no task in this plan reads, modifies, or migrates anything in the sibling `gym-tracker` repository. `public.profile` (owned by Saint Gym) is referenced only via the existing foreign keys, which are not touched.
- **`public` schema keeps only `profile`** — no other table moves into or stays in `public` after this plan.
- **No data rewrite** — every SQL step is a metadata-only operation (`SET SCHEMA`, `RENAME TO`). If any step in this plan would require copying rows, that is a deviation from the spec and must stop for a ruling before proceeding.
- **Migrations `0001`/`0002` are not rewritten** — `0003` is a new, additive migration that moves what they created; the existing files stay as historical record of what was applied when.
- **No automated test is meaningful here** — verification is manual, against the live Supabase project (per the spec's own Tests section). Every task's "testing" step is a real, direct check against actual behavior, not a unit test.

---

## Task 1: Write the schema-move migration

**Files:**
- Create: `supabase/migrations/0003_saint_daily_schema.sql`

**Interfaces:**
- Consumes: nothing (this task only writes a SQL file — it is not applied to any database yet, live or otherwise).
- Produces: the exact SQL text later applied by Task 3. Task 2 depends on knowing the final table/schema names this task fixes (`saint_daily.skill`, `saint_daily.skill_milestone`, `saint_daily.practice_entry`, `saint_daily.app_settings`).

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0003_saint_daily_schema.sql`:

```sql
-- Sépare les tables de Saint Daily du schéma `public` partagé avec Saint
-- Gym, dans un schéma dédié `saint_daily`. Opération de métadonnées pure
-- (ALTER TABLE ... SET SCHEMA) : aucune ligne n'est réécrite, aucun
-- downtime, les policies RLS restent attachées aux tables telles quelles.
-- `public.profile` (propriété de Saint Gym) n'est pas touchée — les FK
-- vers profile(user_id) continuent de fonctionner à travers les schémas.
create schema if not exists saint_daily;

alter table public.skill set schema saint_daily;
alter table public.skill_milestone set schema saint_daily;
alter table public.practice_entry set schema saint_daily;
alter table public.skill_app_settings set schema saint_daily;

-- Le préfixe `skill_` devenait redondant une fois la table logée dans un
-- schéma qui porte déjà le nom de l'app.
alter table saint_daily.skill_app_settings rename to app_settings;
```

- [ ] **Step 2: Re-read the file once and confirm each statement matches the spec exactly**

Check against `docs/superpowers/specs/2026-09-03-schema-namespacing-design.md`, section "Mécanique de la migration SQL": 4 `SET SCHEMA` statements (one per existing table), exactly one `RENAME TO app_settings`, no other statement. Confirm the file contains no `CREATE TABLE`, no `INSERT`, no `COPY` — this migration only moves and renames existing objects, it does not recreate them.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_saint_daily_schema.sql
git commit -m "feat: add migration to move Saint Daily tables into their own schema"
```

This commit does **not** apply the migration to the live database — that is Task 3, done explicitly with the user's confirmation, after Task 2's code change is also ready.

---

## Task 2: Point the application at the new schema

**Files:**
- Modify: `src/renderer/src/lib/supabase.ts`
- Modify: `src/renderer/src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: the schema/table names fixed by Task 1 (`saint_daily`, `app_settings`) — this task does not re-derive them, it uses the exact names Task 1 already committed.
- Produces: `getSupabaseClient()` (unchanged signature, same file) now returns a client whose queries default to the `saint_daily` schema. No other file's public interface changes.

**⚠️ Sequencing note for whoever runs this task:** after this commit, the running app's queries will target `saint_daily.*`, which does not exist on the live Supabase project until Task 3 applies the migration there. Local `npm run dev` against the live database will show fetch errors between this task's commit and Task 3's application step — this is expected and matches how the Pomodoro feature's migration was handled (code and migration land together in this plan; the live database catches up in Task 3, done deliberately with the user).

- [ ] **Step 1: Read the current file to confirm the exact `createClient` call site**

`src/renderer/src/lib/supabase.ts` currently has:

```ts
    client = createSupabaseClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
```

- [ ] **Step 2: Add the schema option**

Change that call to:

```ts
    client = createSupabaseClient(url, anonKey, {
      db: { schema: 'saint_daily' },
      auth: { persistSession: true, autoRefreshToken: true },
    });
```

Nothing else in this file changes — `getSupabaseClient()` keeps its exact signature and memoization behavior.

- [ ] **Step 3: Update the one query referencing the renamed table**

In `src/renderer/src/hooks/useSettings.ts`, find the `.from('skill_app_settings')` call (this is the only file in the codebase referencing that table name — confirm with a repo-wide search before editing, in case anything changed since this plan was written):

```bash
grep -rn "skill_app_settings" src/
```

Expected: exactly one match, inside `useSettings.ts`. Change that occurrence from `.from('skill_app_settings')` to `.from('app_settings')`. Do not change any other `.from(...)` call in this file or elsewhere — `skill`, `skill_milestone`, and `practice_entry` keep their names, only their schema changes, which the client's new default `db.schema` option already handles for every query with no per-call edit needed.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (This is a config-object and string-literal change — no type surface changes, so this should never fail, but confirms nothing else broke.)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/supabase.ts src/renderer/src/hooks/useSettings.ts
git commit -m "feat: point the Supabase client at the saint_daily schema"
```

---

## Task 3: Apply the migration and verify end-to-end

**Files:** none (no code or SQL file changes — this task applies what Tasks 1 and 2 already produced, against the real, live Supabase project).

**Interfaces:**
- Consumes: `supabase/migrations/0003_saint_daily_schema.sql` (Task 1) and the schema-aware client from Task 2.
- Produces: nothing further downstream — this is the last task in the plan.

**⚠️ This task requires the real user, not just the implementer.** Two of its steps are actions only the user can take (running SQL against their live database, and a Supabase dashboard setting) — the implementer must stop and ask for explicit confirmation before Step 1, the same way earlier live-database migrations in this project (e.g. the Pomodoro settings columns) were handled. Do not simulate, skip, or assume these steps happened.

- [ ] **Step 1: Ask the user to apply the migration to the live Supabase project**

Give the user this exact instruction: open the Supabase SQL editor for the project, and run **only** the contents of `supabase/migrations/0003_saint_daily_schema.sql` — not the whole `migrations/` folder, not a CLI tool that might re-run `0001`/`0002` (this exact mistake happened earlier in this project's history and produced a confusing `relation "skill" already exists` error unrelated to this migration). Wait for the user to confirm this is done before continuing.

- [ ] **Step 2: Ask the user to expose the new schema in the Supabase dashboard**

Give the user this exact instruction: in the Supabase dashboard, go to **Project Settings → API → Exposed schemas**, and add `saint_daily` to the list (keep `public` — it still serves `profile` for Saint Gym and any other app in the ecosystem). PostgREST only serves schemas explicitly listed here; without this step, every query will fail with a schema-not-found error even though the migration succeeded. Wait for the user to confirm this is done before continuing.

- [ ] **Step 3: Verify the app against the live database**

Launch the app (`npm run dev`, or the equivalent local launch config already set up for this project) and, using the existing `/dev-login` mechanism (never typing a password directly), confirm:

- The Accueil screen loads and shows the real skill count and stats (proves `saint_daily.skill` and `saint_daily.practice_entry` are reachable).
- Opening a skill's detail page shows its milestones (proves `saint_daily.skill_milestone` is reachable) and its journal entries.
- The Réglages screen loads real values for the reminder threshold and the four Pomodoro duration fields, and changing one of them persists after a reload (proves `saint_daily.app_settings` is reachable under its new name, both for reads and writes).

If any of these fail, the fix belongs in whichever of Task 1 or Task 2 produced the mismatch — do not patch around it with a new, undocumented change in this task.

- [ ] **Step 4: Report the result**

No commit in this task (nothing new to commit — Tasks 1 and 2 already captured every file change). State clearly whether all three checks in Step 3 passed. This is the final task of the plan.

---

## Self-Review

**Spec coverage:** Architecture (schema-per-app) → Task 1. Rename (`skill_app_settings` → `app_settings`) → Task 1 (SQL) and Task 2 (code). Code changes (`supabase.ts`, `useSettings.ts`) → Task 2, matches the spec's own enumeration of exactly these two files with no others. Manual Supabase dashboard step → Task 3, Step 2. Verification → Task 3, Step 3. Out-of-scope Saint Gym boundary → stated in Global Constraints, no task touches `gym-tracker`. Every spec section maps to a task; no gaps found.

**Placeholder scan:** No TBD/TODO, no "add appropriate error handling"-style step, no reference to a file/task not defined here. Clean.

**Type consistency:** `getSupabaseClient()`'s signature is unchanged across every task that mentions it (Task 2 only touches its internal `createClient` call, never its exported shape). The schema name `saint_daily` and the table name `app_settings` are spelled identically in Task 1's SQL, Task 2's code, and Task 3's verification steps — no drift.

# Motivation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner de quoi se motiver dans la durée : un objectif hebdomadaire ou mensuel par engagement, des badges franchis automatiquement, le meilleur streak jamais atteint, et une humeur optionnelle par séance.

**Architecture:** Trois des quatre pièces sont purement dérivées de l'historique existant et ne stockent rien — badges et meilleur streak se recalculent, l'objectif ne persiste que sa définition. Toute la logique vit dans des fonctions pures testées.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind + Supabase + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-daily-tool-backlog-design.md` (chantier 7)

## Global Constraints

- Toute copie visible est **en français**.
- Palette limitée aux jetons existants de `src/renderer/src/theme/colors.ts`.
- **Aucune nouvelle dépendance npm.**
- Logique pure dans `src/renderer/src/lib/*.ts`, testée avec Vitest. **Aucun test de composant React.**
- Toute erreur remontée à l'écran (`role="alert"`, `text-danger`), jamais avalée.
- Accessibilité : `aria-label` sur tout contrôle sans libellé visible, l'information ne repose jamais sur la seule couleur.

## Écart assumé par rapport à la spec : les objectifs ne concernent que les skills

La spec prévoyait les objectifs pour « les skills **et les tâches récurrentes** ». Ce plan les réserve aux skills, pour une raison de modèle et non de commodité : **chaque occurrence d'une série récurrente est sa propre ligne `engagement`**. Un objectif posé sur l'occurrence de mardi ne dirait rien de la série, et une série de 56 occurrences porterait 56 objectifs indépendants dont aucun n'aurait de sens.

Exprimer l'intention de la spec demanderait que l'objectif vive sur la **série**, or il n'existe aucune ligne qui la représente — seulement un `recurrenceSeriesId` partagé. C'est une notion à créer, pas un champ à brancher, et la spec ne l'avait pas vu. Les skills, eux, sont une ligne unique et durable : l'objectif s'y attache naturellement.

À reprendre le jour où une entité « série » existera.

### Règle de déploiement, valable partout dans ce chantier

**Cette migration, comme les quatre précédentes, ne sera appliquée à la base live qu'après le merge.** Conséquence non négociable : **aucune écriture du chemin courant ne doit nommer les nouvelles colonnes**. Concrètement, `logEntry` n'envoie `mood` que si une humeur a été choisie — enregistrer une séance sans humeur, cocher une tâche, terminer un Pomodoro doivent continuer de fonctionner exactement comme avant. Seuls les gestes qui utilisent explicitement une nouveauté (définir un objectif, choisir une humeur) échoueront, visiblement, jusqu'à ce que la migration passe.

---

### Task 1: Migration et couche données

**Files:**
- Create: `supabase/migrations/0012_goals_and_mood.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`
- Modify: `src/renderer/src/hooks/usePracticeEntries.ts`

**Interfaces:**
- Produces: `GoalPeriod`, `GoalMetric`, `Mood`, `Engagement.goalPeriod/goalMetric/goalTarget`, `PracticeEntry.mood`, et le paramètre `mood` de `logEntry`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0012_goals_and_mood.sql` :

```sql
begin;

-- Colonnes nullables : une contrainte `check` est satisfaite par NULL en
-- Postgres, donc « pas d'objectif » et « pas d'humeur » restent l'état par
-- défaut sans valeur par défaut explicite.
alter table saint_daily.engagement
  add column goal_period text check (goal_period in ('hebdomadaire', 'mensuel')),
  add column goal_metric text check (goal_metric in ('heures', 'seances')),
  add column goal_target numeric check (goal_target > 0);

alter table saint_daily.practice_entry
  add column mood text check (mood in ('difficile', 'moyen', 'correct', 'bien', 'excellent'));

commit;
```

- [ ] **Step 2: Ajouter les types**

Dans `src/renderer/src/lib/types.ts`, à côté des autres unions :

```ts
export type GoalPeriod = 'hebdomadaire' | 'mensuel';
export type GoalMetric = 'heures' | 'seances';
export type Mood = 'difficile' | 'moyen' | 'correct' | 'bien' | 'excellent';
```

Dans `Engagement`, après `projectId` :

```ts
  goalPeriod: GoalPeriod | null;
  goalMetric: GoalMetric | null;
  goalTarget: number | null;
```

Dans `PracticeEntry`, après `note` :

```ts
  mood: Mood | null;
```

- [ ] **Step 3: Câbler les colonnes dans `useEngagements.ts`**

Dans `interface EngagementRow` — le `?` décrit l'état réel de la ligne tant que la migration n'est pas passée :

```ts
  goal_period?: GoalPeriod | null;
  goal_metric?: GoalMetric | null;
  goal_target?: number | null;
```

Dans `fromRow` :

```ts
    goalPeriod: row.goal_period ?? null,
    goalMetric: row.goal_metric ?? null,
    goalTarget: row.goal_target ?? null,
```

Dans le `Pick<…>` du paramètre de `updateEngagement`, ajouter `'goalPeriod' | 'goalMetric' | 'goalTarget'`, et dans le corps, à côté des autres spreads conditionnels :

```ts
        ...(patch.goalPeriod !== undefined ? { goal_period: patch.goalPeriod } : {}),
        ...(patch.goalMetric !== undefined ? { goal_metric: patch.goalMetric } : {}),
        ...(patch.goalTarget !== undefined ? { goal_target: patch.goalTarget } : {}),
```

Les spreads conditionnels existants garantissent déjà qu'une mise à jour qui ne touche pas à l'objectif ne nomme pas ces colonnes.

- [ ] **Step 4: Câbler l'humeur dans `usePracticeEntries.ts`**

Dans `interface PracticeEntryRow` :

```ts
  mood?: Mood | null;
```

Dans `fromRow` :

```ts
    mood: row.mood ?? null,
```

Dans `logEntry`, ajouter `mood?: Mood | null` au type de l'entrée, et **n'inclure la colonne dans l'insert que si une humeur a été fournie** :

```ts
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      engagement_id: input.engagementId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
      // Spread conditionnel, pas `mood: input.mood ?? null` : la colonne
      // n'existe pas encore en base live, et la nommer ferait échouer
      // TOUTES les écritures d'entrée — y compris cocher une tâche et
      // terminer un Pomodoro, qui n'ont rien à voir avec l'humeur.
      ...(input.mood ? { mood: input.mood } : {}),
    });
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, les 140 tests existants toujours verts.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_goals_and_mood.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts src/renderer/src/hooks/usePracticeEntries.ts
git commit -m "feat: add goal definitions and an optional mood per entry"
```

---

### Task 2: Logique pure — meilleur streak, badges, progression d'objectif

**Files:**
- Modify: `src/renderer/src/lib/calendarLayout.ts`
- Modify: `src/renderer/src/lib/streaks.ts`
- Modify: `src/renderer/src/lib/streaks.test.ts`
- Create: `src/renderer/src/lib/motivation.ts`
- Test: `src/renderer/src/lib/motivation.test.ts`

**Interfaces:**
- Produces: `startOfMonth`, `calculateBestStreak`, `computeBadges`, `computeGoalProgress`

- [ ] **Step 1: Ajouter `startOfMonth`**

Dans `src/renderer/src/lib/calendarLayout.ts`, à côté de `startOfWeek` :

```ts
export function startOfMonth(reference: Date): Date {
  const first = new Date(reference);
  first.setHours(0, 0, 0, 0);
  first.setDate(1);
  return first;
}
```

- [ ] **Step 2: Ajouter les tests du meilleur streak**

Dans `src/renderer/src/lib/streaks.test.ts`, ajouter `calculateBestStreak` à l'import et :

```ts
describe('calculateBestStreak', () => {
  it('returns 0 with no entries', () => {
    expect(calculateBestStreak([])).toBe(0);
  });

  it('counts the longest past run, not the current one', () => {
    const entries = [
      // Une série de 4 en août…
      { practicedAt: '2026-08-01T09:00:00Z' },
      { practicedAt: '2026-08-02T09:00:00Z' },
      { practicedAt: '2026-08-03T09:00:00Z' },
      { practicedAt: '2026-08-04T09:00:00Z' },
      // …puis une série de 2 en septembre.
      { practicedAt: '2026-09-10T09:00:00Z' },
      { practicedAt: '2026-09-11T09:00:00Z' },
    ];
    expect(calculateBestStreak(entries)).toBe(4);
  });

  it('counts a day only once however many entries it holds', () => {
    const entries = [
      { practicedAt: '2026-08-01T08:00:00Z' },
      { practicedAt: '2026-08-01T20:00:00Z' },
      { practicedAt: '2026-08-02T09:00:00Z' },
    ];
    expect(calculateBestStreak(entries)).toBe(2);
  });

  it('is not fooled by unsorted input', () => {
    const entries = [
      { practicedAt: '2026-08-03T09:00:00Z' },
      { practicedAt: '2026-08-01T09:00:00Z' },
      { practicedAt: '2026-08-02T09:00:00Z' },
    ];
    expect(calculateBestStreak(entries)).toBe(3);
  });

  it('spans a month boundary', () => {
    const entries = [
      { practicedAt: '2026-08-30T09:00:00Z' },
      { practicedAt: '2026-08-31T09:00:00Z' },
      { practicedAt: '2026-09-01T09:00:00Z' },
    ];
    expect(calculateBestStreak(entries)).toBe(3);
  });
});
```

- [ ] **Step 3: Écrire `calculateBestStreak`**

Dans `src/renderer/src/lib/streaks.ts` :

```ts
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Plus longue suite de jours consécutifs pratiqués **de toute l'histoire**,
 * pas seulement celle qui se termine aujourd'hui — c'est le record, pas le
 * streak en cours.
 *
 * Travaille sur des index de jour entiers plutôt que sur des clés texte :
 * une suite se détecte alors par une simple différence de 1, sans
 * arithmétique de dates sensible aux mois de longueurs inégales. En UTC,
 * comme `calculateStreak`, pour rester déterministe quel que soit le fuseau.
 */
export function calculateBestStreak(entries: PracticeEntryLike[]): number {
  if (entries.length === 0) return 0;
  const dayIndexes = [
    ...new Set(entries.map((e) => Math.floor(startOfUtcDay(new Date(e.practicedAt)).getTime() / MS_PER_DAY))),
  ].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < dayIndexes.length; i++) {
    run = dayIndexes[i] === dayIndexes[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}
```

- [ ] **Step 4: Écrire les tests de `motivation.ts`**

Créer `src/renderer/src/lib/motivation.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { computeBadges, computeGoalProgress } from './motivation';

function entry(practicedAt: string, durationMinutes = 30) {
  return { practicedAt, durationMinutes };
}

describe('computeBadges', () => {
  it('returns every badge locked for an empty history', () => {
    const badges = computeBadges([]);
    expect(badges).toHaveLength(4);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('unlocks the seven-day badge at exactly seven consecutive days', () => {
    const six = Array.from({ length: 6 }, (_, i) => entry(`2026-08-0${i + 1}T09:00:00Z`));
    const seven = [...six, entry('2026-08-07T09:00:00Z')];
    expect(computeBadges(six).find((b) => b.key === 'streak-7')?.unlocked).toBe(false);
    expect(computeBadges(seven).find((b) => b.key === 'streak-7')?.unlocked).toBe(true);
  });

  it('unlocks the ten-hour badge at exactly 600 minutes', () => {
    const justUnder = [entry('2026-08-01T09:00:00Z', 599)];
    const exactly = [entry('2026-08-01T09:00:00Z', 600)];
    expect(computeBadges(justUnder).find((b) => b.key === 'hours-10')?.unlocked).toBe(false);
    expect(computeBadges(exactly).find((b) => b.key === 'hours-10')?.unlocked).toBe(true);
  });

  it('counts zero-duration entries as sessions', () => {
    const hundred = Array.from({ length: 100 }, () => entry('2026-08-01T09:00:00Z', 0));
    expect(computeBadges(hundred).find((b) => b.key === 'sessions-100')?.unlocked).toBe(true);
    expect(computeBadges(hundred).find((b) => b.key === 'hours-10')?.unlocked).toBe(false);
  });
});

describe('computeGoalProgress', () => {
  // Jeudi 10 septembre 2026 ; semaine du lundi 7, mois depuis le 1er.
  const NOW = new Date(2026, 8, 10, 14, 0);

  it('counts sessions inside the current week only', () => {
    const entries = [
      entry(new Date(2026, 8, 8, 9).toISOString()),
      entry(new Date(2026, 8, 9, 9).toISOString()),
      entry(new Date(2026, 8, 3, 9).toISOString()),
    ];
    expect(computeGoalProgress(entries, 'hebdomadaire', 'seances', 3, NOW)).toMatchObject({
      current: 2,
      target: 3,
    });
  });

  it('counts hours inside the current month', () => {
    const entries = [
      entry(new Date(2026, 8, 2, 9).toISOString(), 90),
      entry(new Date(2026, 8, 9, 9).toISOString(), 30),
      entry(new Date(2026, 7, 28, 9).toISOString(), 600),
    ];
    expect(computeGoalProgress(entries, 'mensuel', 'heures', 4, NOW).current).toBeCloseTo(2);
  });

  it('caps the ratio at 1 once the goal is beaten', () => {
    const entries = Array.from({ length: 10 }, () => entry(new Date(2026, 8, 8, 9).toISOString()));
    expect(computeGoalProgress(entries, 'hebdomadaire', 'seances', 3, NOW).ratio).toBe(1);
  });

  it('never divides by zero when the target is absurd', () => {
    expect(computeGoalProgress([], 'hebdomadaire', 'seances', 0, NOW).ratio).toBe(0);
  });
});
```

- [ ] **Step 5: Lancer les tests pour les voir échouer**

Run: `npm test -- --run src/renderer/src/lib/motivation.test.ts`
Expected: FAIL — le module n'existe pas.

- [ ] **Step 6: Écrire `motivation.ts`**

```ts
import { startOfMonth, startOfWeek } from './calendarLayout';
import { calculateBestStreak } from './streaks';
import type { GoalMetric, GoalPeriod } from './types';

export interface MotivationEntryLike {
  practicedAt: string;
  durationMinutes: number;
}

export interface Badge {
  key: string;
  label: string;
  hint: string;
  unlocked: boolean;
}

const TEN_HOURS_IN_MINUTES = 600;

/**
 * Badges entièrement **dérivés** de l'historique : rien n'est stocké, donc
 * rien ne peut se désynchroniser de la réalité, et un import de données
 * anciennes débloque rétroactivement ce qui est mérité.
 */
export function computeBadges(entries: MotivationEntryLike[]): Badge[] {
  const sessions = entries.length;
  const minutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const bestStreak = calculateBestStreak(entries);
  return [
    {
      key: 'streak-7',
      label: '7 jours d\'affilée',
      hint: 'Sept jours consécutifs avec au moins une séance',
      unlocked: bestStreak >= 7,
    },
    {
      key: 'streak-30',
      label: '30 jours d\'affilée',
      hint: 'Trente jours consécutifs avec au moins une séance',
      unlocked: bestStreak >= 30,
    },
    {
      key: 'hours-10',
      label: '10 heures cumulées',
      hint: 'Dix heures de pratique au total',
      unlocked: minutes >= TEN_HOURS_IN_MINUTES,
    },
    {
      key: 'sessions-100',
      label: '100 séances',
      hint: 'Cent séances enregistrées',
      unlocked: sessions >= 100,
    },
  ];
}

export interface GoalProgress {
  current: number;
  target: number;
  ratio: number;
  label: string;
}

export function computeGoalProgress(
  entries: MotivationEntryLike[],
  period: GoalPeriod,
  metric: GoalMetric,
  target: number,
  now: Date = new Date()
): GoalProgress {
  const windowStart = period === 'mensuel' ? startOfMonth(now) : startOfWeek(now);
  const inWindow = entries.filter((entry) => new Date(entry.practicedAt) >= windowStart);
  const current =
    metric === 'heures'
      ? inWindow.reduce((sum, entry) => sum + entry.durationMinutes, 0) / 60
      : inWindow.length;
  return {
    current,
    target,
    // Plafonné à 1 : la barre ne déborde pas quand l'objectif est dépassé,
    // le chiffre affiché à côté dit déjà de combien.
    ratio: target > 0 ? Math.min(1, current / target) : 0,
    label:
      metric === 'heures'
        ? `${current.toFixed(1)} h sur ${target} h`
        : `${current} séance${current > 1 ? 's' : ''} sur ${target}`,
  };
}
```

- [ ] **Step 7: Vérifier**

Run: `npm test -- --run`, puis `npm run typecheck`
Expected: tout vert.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/lib/calendarLayout.ts src/renderer/src/lib/streaks.ts src/renderer/src/lib/streaks.test.ts src/renderer/src/lib/motivation.ts src/renderer/src/lib/motivation.test.ts
git commit -m "feat: add best-streak, badge and goal-progress calculations"
```

---

### Task 3: Objectif, badges et record sur l'écran d'un skill

**Files:**
- Create: `src/renderer/src/components/GoalProgress.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`

**Interfaces:**
- Consumes: `computeGoalProgress`, `computeBadges`, `calculateBestStreak`

- [ ] **Step 1: Écrire le composant de progression**

Créer `src/renderer/src/components/GoalProgress.tsx` :

```tsx
import type { GoalProgress as GoalProgressValue } from '../lib/motivation';

export default function GoalProgress({ progress }: { progress: GoalProgressValue }) {
  const reached = progress.current >= progress.target;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Objectif</span>
        {/* Le libellé porte l'information ; la couleur ne fait que la
            souligner, elle ne la remplace jamais. */}
        <span className={`font-data text-[12px] tabular-nums ${reached ? 'text-accent-bright' : 'text-champagne'}`}>
          {progress.label}
          {reached ? ' · atteint' : ''}
        </span>
      </div>
      <div
        className="h-1.5 w-full bg-ink-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-valuenow={Math.round(progress.current * 10) / 10}
        aria-label="Progression de l'objectif"
      >
        <div className="h-full bg-accent-bright" style={{ width: `${progress.ratio * 100}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Brancher dans `DetailSkill.tsx`**

Ce fichier a déjà les entrées de pratique du skill et son streak courant — **le lire pour retrouver les noms exacts** des variables avant d'écrire.

Ajouter les calculs :

```tsx
  const bestStreak = useMemo(() => calculateBestStreak(entries), [entries]);
  const badges = useMemo(() => computeBadges(entries), [entries]);
  const goal = useMemo(
    () =>
      skill?.goalPeriod && skill.goalMetric && skill.goalTarget
        ? computeGoalProgress(entries, skill.goalPeriod, skill.goalMetric, skill.goalTarget)
        : null,
    [entries, skill]
  );
```

Ajouter le gestionnaire de définition d'objectif, sur le modèle de `handleLevelChange` déjà présent :

```tsx
  async function handleGoalChange(patch: {
    goalPeriod?: GoalPeriod | null;
    goalMetric?: GoalMetric | null;
    goalTarget?: number | null;
  }) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateEngagement(skill.id, patch);
    if (error) setActionError(error);
  }
```

Dans le JSX, une section « Objectif » qui affiche :

- si `goal` existe : `<GoalProgress progress={goal} />` et un bouton « Retirer l'objectif » appelant `handleGoalChange({ goalPeriod: null, goalMetric: null, goalTarget: null })` ;
- sinon : trois contrôles pour en définir un — un `<select>` de période (`hebdomadaire`/`mensuel`), un `<select>` de métrique (`heures`/`seances`), un `<input type="number" min={1}>` de cible, et un bouton « Définir l'objectif » qui envoie les trois d'un coup. Chaque contrôle porte un `aria-label`.

Et une section « Records » affichant le meilleur streak à côté du streak courant, puis les badges :

```tsx
        <ul className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <li
              key={badge.key}
              title={badge.hint}
              className={`border px-3 py-1.5 font-data text-[11px] uppercase tracking-[0.08em] ${
                badge.unlocked ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted'
              }`}
            >
              {badge.unlocked ? '' : '· '}
              {badge.label}
            </li>
          ))}
        </ul>
```

Les badges verrouillés restent visibles, en sourdine : ils indiquent ce qu'il reste à atteindre.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/GoalProgress.tsx src/renderer/src/screens/DetailSkill.tsx
git commit -m "feat: show goal progress, records and badges on a skill"
```

---

### Task 4: Humeur optionnelle à l'enregistrement d'une séance

**Files:**
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx`

- [ ] **Step 1: Ajouter le sélecteur**

`NouvelleEntree.tsx` utilise déjà `SelectField` de `../components/FormField`. Ajouter un état `const [mood, setMood] = useState<Mood | ''>('')`, puis, juste avant le champ Note :

```tsx
        <SelectField label="Humeur (optionnelle)" value={mood} onChange={(e) => setMood(e.target.value as Mood | '')}>
          <option value="">Non précisée</option>
          <option value="difficile">Difficile</option>
          <option value="moyen">Moyen</option>
          <option value="correct">Correct</option>
          <option value="bien">Bien</option>
          <option value="excellent">Excellent</option>
        </SelectField>
```

et passer `mood: mood || null` à l'appel de `logEntry`.

L'humeur n'est proposée **que sur cet écran**. Cocher une tâche depuis le popover reste un geste instantané, et un Pomodoro consolide sans rien demander : y ajouter une question annulerait leur intérêt.

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/NouvelleEntree.tsx
git commit -m "feat: record an optional mood alongside a practice entry"
```

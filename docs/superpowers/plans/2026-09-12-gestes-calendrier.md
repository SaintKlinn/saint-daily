# Gestes du calendrier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reprogrammer une tâche en la glissant sur un autre créneau, et pouvoir passer une occurrence d'une série sans la supprimer ni faire semblant de l'avoir faite.

**Architecture:** Glisser-déposer HTML5 natif sur la grille existante, sans librairie. Le saut d'occurrence est un simple marqueur `skipped_at` sur la ligne de l'occurrence, que les listes « à faire » et les rappels apprennent à ignorer.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind + Supabase + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-daily-tool-backlog-design.md` (chantier 10)

## Écart assumé par rapport à la spec : pas de `excusedDays` sur `calculateStreak`

La spec demandait que passer une occurrence « ne casse pas le streak », en faisant gagner à `calculateStreak` un paramètre `excusedDays` de jours traversés. **Ce paramètre n'aurait aucun appelant.** Vérifié : `calculateStreak` est invoqué à quatre endroits — `Accueil.tsx`, `DetailSkill.tsx`, `ListeSkills.tsx`, `SkillPicker.tsx` — et toujours sur les entrées d'un **skill**, jamais d'une tâche.

Or les deux notions ne se rencontrent pas :

- une **tâche récurrente** a des occurrences (une ligne `engagement` chacune) mais **aucun streak** n'est calculé ni affiché pour elle ;
- un **skill** a un streak mais **aucune occurrence** : c'est une ligne unique, il n'y a rien à « passer ».

L'idée d'origine (brainstorm du 6 septembre, rubrique « Récurrence ») a été écrite quand la récurrence *était* la mécanique des skills. Le modèle unifié l'a depuis déplacée vers les tâches, et la spec a transporté la phrase sans revoir à quoi elle s'applique.

Faire le pont demanderait une notion de **jour excusé par skill** — une table `(engagement_id, date)` et son bouton « Passer aujourd'hui » sur l'écran d'un skill. C'est une fonctionnalité à part entière, avec sa migration et son interface, pas un paramètre à ajouter. Ce plan livre donc le saut d'occurrence tel qu'il a un sens ici — l'occurrence sort des listes « à faire » et ne rappelle plus — et **ne touche pas à `calculateStreak`** plutôt que d'y ajouter un paramètre mort.

## Global Constraints

- Toute copie visible est **en français**.
- Palette limitée aux jetons existants de `src/renderer/src/theme/colors.ts`.
- **Aucune nouvelle dépendance npm** — pas de librairie de glisser-déposer.
- Logique pure dans `src/renderer/src/lib/*.ts`, testée avec Vitest. **Aucun test de composant React.**
- Toute erreur remontée à l'écran (`role="alert"`, `text-danger`), jamais avalée.
- Huit migrations seront en attente sur la base live, celle-ci comprise : aucune requête automatique ne doit **nommer** une colonne non migrée. `select('*')` et tri côté client.

### Accessibilité du glisser-déposer

Le glisser-déposer est intrinsèquement à la souris. Il reste ici une **commodité, jamais le seul chemin** : reprogrammer une tâche est déjà possible au clavier via le popover (« Reporter », « Plus tard aujourd'hui », « Demain ») et via la création sur un créneau, tous deux atteignables au clavier. C'est ce qui satisfait l'exigence d'une alternative à pointeur unique ; ne pas dégrader ces chemins existants.

---

### Task 1: Glisser-déposer pour reprogrammer

**Files:**
- Modify: `src/renderer/src/lib/scheduling.ts`
- Modify: `src/renderer/src/lib/scheduling.test.ts`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Produces: `overlappingTaskNames(slot, tasks)`

- [ ] **Step 1: Écrire les tests du détecteur de chevauchement**

`detectConflicts` de `recurrence.ts` ne convient pas ici : il ignore délibérément les tâches de la **même série** que l'occurrence testée, alors qu'un dépôt sur le créneau d'une sœur est un vrai chevauchement qui mérite l'avertissement. Et nommer la tâche en conflit vaut mieux que compter les conflits.

Ajouter à `src/renderer/src/lib/scheduling.test.ts` (compléter l'import) :

```ts
describe('overlappingTaskNames', () => {
  const tasks = [
    { id: 'a', name: 'Dentiste', scheduledAt: '2026-09-10T09:00:00Z', scheduledEndsAt: '2026-09-10T10:00:00Z' },
    { id: 'b', name: 'Courses', scheduledAt: '2026-09-10T14:00:00Z', scheduledEndsAt: '2026-09-10T15:00:00Z' },
  ];

  it('returns nothing for a free slot', () => {
    expect(
      overlappingTaskNames({ scheduledAt: '2026-09-10T11:00:00Z', scheduledEndsAt: '2026-09-10T12:00:00Z' }, tasks)
    ).toEqual([]);
  });

  it('names a task the slot lands on top of', () => {
    expect(
      overlappingTaskNames({ scheduledAt: '2026-09-10T09:30:00Z', scheduledEndsAt: '2026-09-10T10:30:00Z' }, tasks)
    ).toEqual(['Dentiste']);
  });

  it('treats touching edges as free, not overlapping', () => {
    expect(
      overlappingTaskNames({ scheduledAt: '2026-09-10T10:00:00Z', scheduledEndsAt: '2026-09-10T11:00:00Z' }, tasks)
    ).toEqual([]);
  });

  it('names every task the slot spans', () => {
    expect(
      overlappingTaskNames({ scheduledAt: '2026-09-10T08:00:00Z', scheduledEndsAt: '2026-09-10T20:00:00Z' }, tasks)
    ).toEqual(['Dentiste', 'Courses']);
  });

  it('ignores tasks with no schedule', () => {
    expect(
      overlappingTaskNames({ scheduledAt: '2026-09-10T09:30:00Z', scheduledEndsAt: '2026-09-10T10:30:00Z' }, [
        { id: 'c', name: 'Skill', scheduledAt: null, scheduledEndsAt: null },
      ])
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm test -- --run src/renderer/src/lib/scheduling.test.ts`
Expected: FAIL — la fonction n'existe pas.

- [ ] **Step 3: Écrire la fonction**

Ajouter à `src/renderer/src/lib/scheduling.ts` :

```ts
export interface NamedTaskSlot {
  id: string;
  name: string;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
}

/**
 * Noms des tâches qu'un créneau chevauche, dans l'ordre où elles arrivent.
 *
 * Les bords qui se touchent ne comptent pas : une tâche qui finit à 10h00
 * et une qui commence à 10h00 ne se chevauchent pas. L'appelant est
 * responsable d'exclure la tâche qu'il déplace elle-même.
 */
export function overlappingTaskNames(
  slot: { scheduledAt: string; scheduledEndsAt: string },
  tasks: NamedTaskSlot[]
): string[] {
  const start = new Date(slot.scheduledAt).getTime();
  const end = new Date(slot.scheduledEndsAt).getTime();
  return tasks
    .filter((task) => {
      if (!task.scheduledAt || !task.scheduledEndsAt) return false;
      const taskStart = new Date(task.scheduledAt).getTime();
      const taskEnd = new Date(task.scheduledEndsAt).getTime();
      return taskStart < end && taskEnd > start;
    })
    .map((task) => task.name);
}
```

- [ ] **Step 4: Rendre les blocs déplaçables**

Dans `src/renderer/src/screens/Calendrier.tsx`, sur le `<button>` qui rend une tâche (celui qui ouvre le popover), ajouter :

```tsx
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
```

Les navigateurs suppriment le `click` qui suivrait un vrai glissement, donc le popover continue de s'ouvrir sur un simple clic sans s'ouvrir après un déplacement.

- [ ] **Step 5: Faire des créneaux des cibles de dépôt**

Ajouter un état pour le retour visuel et le gestionnaire de dépôt :

```tsx
  // Clé `jour-heure` du créneau actuellement survolé pendant un
  // glissement : sans retour visuel, on dépose à l'aveugle.
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  async function handleDropOnSlot(day: Date, hour: number, taskId: string) {
    setDropTarget(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task?.scheduledAt || !task.scheduledEndsAt) return;

    // La durée est préservée : seul l'horaire de début change, comme pour
    // le report rapide.
    const durationMs = new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime();
    const newStart = new Date(day);
    newStart.setHours(hour, 0, 0, 0);
    const scheduledAt = newStart.toISOString();
    // Déposer une tâche sur son propre créneau ne doit rien écrire.
    if (scheduledAt === task.scheduledAt) return;
    const scheduledEndsAt = new Date(newStart.getTime() + durationMs).toISOString();

    setActionError(null);
    const { error } = await updateEngagement(taskId, { scheduledAt, scheduledEndsAt });
    if (error) {
      setActionError(error);
      return;
    }

    // Glisser une occurrence ne déplace qu'elle : `updateEngagement` ne
    // touche qu'une ligne, et les sœurs de la série gardent leur créneau.
    const clashes = overlappingTaskNames(
      { scheduledAt, scheduledEndsAt },
      activeEngagements.filter((e) => e.id !== taskId)
    );
    const when = newStart.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    // Un chevauchement avertit sans jamais interdire, comme le fait déjà
    // la détection de conflits de la récurrence.
    setSnoozeMessage(
      clashes.length > 0
        ? `Déplacé au ${when}, en conflit avec ${clashes.join(', ')}.`
        : `Déplacé au ${when}.`
    );
  }
```

`snoozeMessage` est réutilisé délibérément : c'est déjà le canal « cette tâche a changé de créneau », et un second canal afficherait deux messages concurrents au même endroit.

Puis, sur chaque cellule d'heure, ajouter aux gestionnaires existants :

```tsx
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropTarget(`${dayIndex}-${h}`);
                  }}
                  onDragLeave={() => setDropTarget((current) => (current === `${dayIndex}-${h}` ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) void handleDropOnSlot(day, h, taskId);
                  }}
```

et compléter sa `className` du retour visuel : `${dropTarget === `${dayIndex}-${h}` ? 'bg-accent-bright/20' : ''}`.

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert, les 176 tests existants inclus.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/scheduling.ts src/renderer/src/lib/scheduling.test.ts src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: reschedule a task by dragging it onto another slot"
```

---

### Task 2: Passer une occurrence

**Files:**
- Create: `supabase/migrations/0015_skip_occurrence.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`
- Modify: `src/renderer/src/lib/reminders.ts`
- Modify: `src/renderer/src/hooks/useEngagementReminders.ts`
- Modify: `src/renderer/src/screens/Accueil.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Produces: `Engagement.skippedAt`, `setSkipped(id, skipped)`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0015_skip_occurrence.sql` :

```sql
begin;

-- Même famille que `archived_at` et `deleted_at` : un marqueur d'événement
-- nullable sur la ligne de l'occurrence concernée. Chaque occurrence d'une
-- série est sa propre ligne, donc passer mardi ne dit rien de mercredi.
alter table saint_daily.engagement
  add column skipped_at timestamptz;

commit;
```

- [ ] **Step 2: Câbler le champ**

Dans `src/renderer/src/lib/types.ts`, interface `Engagement`, après `deletedAt` :

```ts
  skippedAt: string | null;
```

Dans `src/renderer/src/hooks/useEngagements.ts` : `skipped_at?: string | null` dans `EngagementRow`, `skippedAt: row.skipped_at ?? null` dans `fromRow`, et une mutation à côté de `setArchived` :

```ts
  async function setSkipped(id: string, skipped: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({ skipped_at: skipped ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }
```

exposée dans l'objet retourné.

**Ne pas filtrer `skippedAt` dans `refresh`**, contrairement à `deletedAt`. Une occurrence passée doit rester visible dans le calendrier, en retrait : c'est ce qui permet de constater qu'on l'a passée et de revenir sur sa décision. Ce sont les listes « à faire » qui l'excluent, pas la source.

- [ ] **Step 3: Exclure des rappels**

Dans `src/renderer/src/lib/reminders.ts`, ajouter `skippedAt: string | null` à `ReminderEngagement` et, dans la boucle d'éligibilité de `dueReminders`, juste après le test d'archivage :

```ts
    // Une occurrence passée ne rappelle plus : c'est tout l'objet du geste.
    if (engagement.skippedAt) continue;
```

Ajouter un test à `reminders.test.ts` sur ce cas, sur le modèle du test d'archivage existant.

Dans `src/renderer/src/hooks/useEngagementReminders.ts`, compléter le mapping de ligne avec `skippedAt: row.skipped_at ?? null` et le type de ligne local avec `skipped_at?: string | null`. La requête reste en `select('*')`.

- [ ] **Step 4: Exclure des « Tâches à faire »**

Dans `src/renderer/src/screens/Accueil.tsx`, le mémo `tasks` filtre déjà sur `scheduledAt` et l'absence d'entrée. Y ajouter `&& !e.skippedAt`.

- [ ] **Step 5: Le geste dans le popover**

`TaskPopover` reçoit ses actions en props. Lui ajouter :

```tsx
  onToggleSkip: () => void;
  skipping?: boolean;
```

et, dans la rangée de boutons, **seulement pour une occurrence d'une série** :

```tsx
          {task.recurrenceSeriesId && (
            <Button variant="secondary" size="sm" onClick={onToggleSkip} disabled={skipping}>
              {task.skippedAt ? 'Ne plus passer' : 'Passer cette occurrence'}
            </Button>
          )}
```

Dans `src/renderer/src/screens/Calendrier.tsx`, ajouter `setSkipped` à la déstructuration de `useEngagements()`, un état `skipping`, et le gestionnaire :

```tsx
  async function handleToggleSkip(task: Engagement) {
    setActionError(null);
    setSkipping(true);
    const { error } = await setSkipped(task.id, !task.skippedAt);
    if (error) setActionError(error);
    setSkipping(false);
    setPopoverTask(null);
  }
```

puis passer `onToggleSkip` et `skipping` au `<TaskPopover>`.

- [ ] **Step 6: Montrer qu'une occurrence est passée**

Toujours dans `Calendrier.tsx`, sur le bloc de tâche, mettre en retrait une occurrence passée — et **ne pas se contenter de la couleur** : ajouter le mot dans le libellé accessible et une rature visible.

```tsx
                    aria-label={`${task.name}${task.skippedAt ? ' — passée' : ''}${
                      priorityColor ? ` — priorité ${PRIORITY_LABELS[task.priority]}` : ''
                    }`}
```

et, sur le texte du bloc, `${task.skippedAt ? 'line-through text-muted' : 'text-champagne'}` en plus de l'opacité réduite du conteneur pour une occurrence passée.

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: tout vert.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0015_skip_occurrence.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts src/renderer/src/lib/reminders.ts src/renderer/src/lib/reminders.test.ts src/renderer/src/hooks/useEngagementReminders.ts src/renderer/src/screens/Accueil.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: skip one occurrence of a recurring task"
```

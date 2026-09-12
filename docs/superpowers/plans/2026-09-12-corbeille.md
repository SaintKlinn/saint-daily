# Corbeille — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de supprimer un engagement (tâche, skill ou projet) avec un filet : il part à la corbeille, d'où il peut être restauré ou supprimé définitivement.

**Architecture:** Suppression douce par une colonne `deleted_at`. Les éléments en corbeille sont écartés **une seule fois, dans `useEngagements`**, plutôt qu'à chaque point d'appel — voir la note ci-dessous. Un écran dédié, atteignable depuis Réglages, liste ce qui est en corbeille.

**Tech Stack:** Electron + React 19 + TypeScript + Tailwind + Supabase + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-daily-tool-backlog-design.md` (chantier 3)

## Global Constraints

- Toute copie visible est **en français**.
- Palette limitée aux jetons existants de `src/renderer/src/theme/colors.ts`.
- **Aucune nouvelle dépendance npm.**
- Logique pure dans `src/renderer/src/lib/*.ts`, testée avec Vitest. **Aucun test de composant React.**
- Toute erreur remontée à l'écran (`role="alert"`, `text-danger`), jamais avalée.
- Accessibilité : `aria-label` sur tout contrôle sans libellé visible, anneau de focus visible, l'information ne repose jamais sur la seule couleur.

## Deux écarts assumés par rapport à la spec

**1. Le filtrage se fait à la source, pas point d'appel par point d'appel.** La spec prévoyait d'ajouter `&& !e.deletedAt` partout où `archivedAt` est déjà filtré (huit écrans au moins). Un seul filtre, dans `useEngagements`, est strictement meilleur : impossible d'en oublier un, impossible qu'un futur écran affiche par accident un élément supprimé, et le chantier suivant qui ajoutera `skipped_at` n'aura pas à refaire la tournée.

**2. Pas de bouton « Vider la corbeille ».** La spec le prévoyait. Une purge en lot doit supprimer les enfants avant les parents pour ne pas heurter la clé étrangère `project_id`, et un échec en cours de boucle laisse un état à moitié purgé difficile à expliquer. La purge élément par élément couvre entièrement le besoin d'une app personnelle où la corbeille contiendra rarement plus de quelques lignes. À reprendre si l'usage prouve le contraire.

**3. Ce filtre est appliqué côté client, pas dans la requête.** Un `.is('deleted_at', null)` dans le `select` serait plus élégant, mais **la migration de ce chantier ne sera appliquée à la base live qu'après le merge** (l'utilisateur est absent). Une requête filtrant sur une colonne inexistante échoue et laisserait `engagements` vide : toute l'application afficherait du vide. Le filtre client, lui, laisse passer `undefined` sans dommage. On récupère donc quelques lignes qu'on jette — négligeable pour une app personnelle, et sûr dans les deux états de la base.

## Contraintes de clé étrangère à respecter

Vérifié dans `supabase/migrations/0001_saint_daily_tables.sql` :

- `practice_entry` et `engagement_milestone` référencent l'engagement **`on delete cascade`** : purger un engagement emporte proprement ses entrées et ses jalons, rien à faire de plus.
- `engagement.project_id` référence `engagement(id)` **sans clause `on delete`** (ajouté par `0008_project_grouping.sql`). Purger un projet dont des enfants pointent encore vers lui **échoue** sur violation de clé étrangère. Le Task 1 traite ce cas explicitement.

---

### Task 1: Migration et couche données

**Files:**
- Create: `supabase/migrations/0010_engagement_deleted_at.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Modify: `src/renderer/src/hooks/useEngagements.ts`

**Interfaces:**
- Produces: `Engagement.deletedAt: string | null`, et sur `useEngagements` : `softDelete(id, isProject)`, `restore(id, deletedAt, isProject)`, `purge(id, isProject)`, `deletedEngagements`. Pas de rafraîchissement séparé pour la corbeille : `refresh()` remplit les deux listes d'un même passage, elles ne peuvent donc pas diverger.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0010_engagement_deleted_at.sql` :

```sql
begin;

alter table saint_daily.engagement
  add column deleted_at timestamptz;

commit;
```

- [ ] **Step 2: Ajouter le champ au type**

Dans `src/renderer/src/lib/types.ts`, interface `Engagement`, ajouter juste après `archivedAt: string | null;` :

```ts
  deletedAt: string | null;
```

- [ ] **Step 3: Câbler la colonne dans `useEngagements.ts`**

Dans `interface EngagementRow`, après `archived_at: string | null;` :

```ts
  deleted_at: string | null;
```

Dans `fromRow`, après `archivedAt: row.archived_at,` :

```ts
    // `?? null` volontaire : la migration qui ajoute cette colonne est
    // appliquée à la base live après le déploiement du code. Entre les
    // deux, la propriété est absente de la ligne et vaudrait `undefined`,
    // ce que le filtre ci-dessous traiterait correctement mais que le type
    // `string | null` ne décrit pas.
    deletedAt: row.deleted_at ?? null,
```

- [ ] **Step 4: Filtrer les éléments en corbeille à la source**

Dans `refresh`, remplacer la ligne

```ts
      setEngagements((data as EngagementRow[]).map(fromRow));
```

par

```ts
      const all = (data as EngagementRow[]).map(fromRow);
      // Point de filtrage unique de toute l'application : aucun écran n'a
      // à se souvenir d'exclure la corbeille, et aucun futur écran ne
      // pourra afficher un élément supprimé par accident. Le tri est
      // côté client et non dans la requête, pour que le code fonctionne
      // aussi tant que la colonne n'existe pas (voir l'en-tête du plan).
      setEngagements(all.filter((engagement) => !engagement.deletedAt));
      setDeletedEngagements(
        all
          .filter((engagement) => engagement.deletedAt)
          .sort((a, b) => (b.deletedAt as string).localeCompare(a.deletedAt as string))
      );
```

Et déclarer l'état correspondant à côté de `const [engagements, setEngagements] = useState<Engagement[]>([]);` :

```ts
  const [deletedEngagements, setDeletedEngagements] = useState<Engagement[]>([]);
```

- [ ] **Step 5: Ajouter les trois opérations**

Ajouter ces trois fonctions dans `useEngagements`, juste après `setArchived` :

```ts
  /**
   * Envoie un engagement à la corbeille. Pour un projet, ses enfants
   * encore vivants y partent avec lui, **avec exactement le même
   * horodatage** : c'est ce qui permet ensuite à `restore` de ne remonter
   * que ceux qui sont partis à ce moment-là, et pas un enfant supprimé
   * séparément plus tôt.
   */
  async function softDelete(id: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    const deletedAt = new Date().toISOString();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .update({ deleted_at: deletedAt })
        .eq('project_id', id)
        .is('deleted_at', null);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
    }
    const { error: updateError } = await supabase
      .from('engagement')
      .update({ deleted_at: deletedAt })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  async function restore(id: string, deletedAt: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .update({ deleted_at: null })
        .eq('project_id', id)
        .eq('deleted_at', deletedAt);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
    }
    const { error: updateError } = await supabase
      .from('engagement')
      .update({ deleted_at: null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  /**
   * Suppression réelle et irréversible. Les entrées de pratique et les
   * jalons partent d'eux-mêmes (`on delete cascade`), mais `project_id`
   * n'a aucune clause `on delete` : sans les deux passes ci-dessous, la
   * base refuserait de supprimer un projet encore référencé.
   */
  async function purge(id: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .delete()
        .eq('project_id', id)
        .not('deleted_at', 'is', null);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
      // Un enfant restauré entre-temps pointe encore vers le projet : il
      // survit, mais perd son rattachement, sans quoi la clé étrangère
      // bloquerait la suppression du parent.
      const { error: detachError } = await supabase
        .from('engagement')
        .update({ project_id: null })
        .eq('project_id', id);
      if (detachError) return { error: toFrenchError(detachError.message) };
    }
    const { error: deleteError } = await supabase.from('engagement').delete().eq('id', id);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
    await refresh();
    return { error: null };
  }
```

- [ ] **Step 6: Exposer les nouveautés**

Dans l'objet retourné par `useEngagements`, ajouter `deletedEngagements`, `softDelete`, `restore` et `purge` à côté des membres existants.

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, les 123 tests existants toujours verts.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0010_engagement_deleted_at.sql src/renderer/src/lib/types.ts src/renderer/src/hooks/useEngagements.ts
git commit -m "feat: add soft deletion with a restorable trash for engagements"
```

---

### Task 2: Bouton de suppression à deux temps et ses points d'appel

**Files:**
- Create: `src/renderer/src/components/BoutonSuppression.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/screens/DetailProjet.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`

**Interfaces:**
- Produces: `BoutonSuppression({ onConfirm, label?, confirmLabel?, busy? })`

- [ ] **Step 1: Écrire le composant**

Créer `src/renderer/src/components/BoutonSuppression.tsx` :

```tsx
import { useEffect, useRef, useState } from 'react';

interface BoutonSuppressionProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  busy?: boolean;
}

// Le bouton s'arme au premier clic et se désarme seul : un bouton laissé
// en position « Confirmer ? » deviendrait un piège pour le clic distrait
// qui suit, plusieurs minutes plus tard.
const ARM_TIMEOUT_MS = 4000;

// Classes écrites en entier par état plutôt que composées avec
// `buttonClassName` : deux utilitaires Tailwind concurrents (`text-muted`
// et `text-danger`) dans la même liste ont un gagnant décidé par l'ordre
// de la feuille générée, pas par l'ordre d'écriture — donc on n'en met
// jamais deux.
const BASE =
  'inline-flex items-center justify-center gap-2 px-4 py-2 font-sans text-[13px] transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const IDLE = 'border border-ink-700 text-muted hover:text-champagne';
const ARMED = 'border border-danger font-semibold text-danger';

export default function BoutonSuppression({
  onConfirm,
  label = 'Supprimer',
  confirmLabel = 'Confirmer ?',
  busy = false,
}: BoutonSuppressionProps) {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  function handleClick() {
    if (armed) {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timeoutRef.current = window.setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      // Le changement de libellé est la vraie information ; `aria-live`
      // le fait annoncer au lieu de le laisser à la seule couleur.
      aria-live="polite"
      className={`${BASE} ${armed ? ARMED : IDLE}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
```

- [ ] **Step 2: Brancher dans `DetailSkill.tsx`**

Importer le composant, et ajouter un gestionnaire à côté de `handleToggleArchived` :

```tsx
  async function handleDelete() {
    if (!skill) return;
    setActionError(null);
    const { error } = await softDelete(skill.id, false);
    if (error) {
      setActionError(error);
      return;
    }
    navigate('/skills');
  }
```

`softDelete` vient de `useEngagements()` (à ajouter à la destructuration existante). `navigate` vient de `useNavigate()` de react-router-dom — l'ajouter si le fichier ne l'importe pas déjà. Placer `<BoutonSuppression onConfirm={handleDelete} />` juste après le bouton « Archiver / Désarchiver » existant.

- [ ] **Step 3: Brancher dans `DetailProjet.tsx`**

Ce fichier ne gère aujourd'hui aucune action. Ajouter :

- `softDelete` à la destructuration de `useEngagements()`
- `const navigate = useNavigate();` (importer `useNavigate` depuis `react-router-dom`)
- `const [actionError, setActionError] = useState<string | null>(null);` (importer `useState`)
- le gestionnaire :

```tsx
  async function handleDelete() {
    if (!project) return;
    setActionError(null);
    const { error: deleteError } = await softDelete(project.id, true);
    if (deleteError) {
      setActionError(deleteError);
      return;
    }
    navigate('/projets');
  }
```

Dans le JSX, à la suite du bloc titre (le `<div className="relative overflow-hidden border border-ink-700 bg-ink-900 p-6">`), ajouter une ligne d'action :

```tsx
      <div className="flex items-center gap-3">
        <BoutonSuppression onConfirm={handleDelete} />
        <p className="text-[13px] text-muted">
          Supprimer un projet envoie aussi ses engagements liés à la corbeille.
        </p>
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
```

- [ ] **Step 4: Brancher dans `TaskPopover.tsx`**

`TaskPopover` est un composant présentationnel : il reçoit ses actions en props. Lui ajouter une prop `onDelete: () => void` et rendre `<BoutonSuppression onConfirm={onDelete} />` dans la rangée de boutons du bas, à gauche de « Fermer ».

Puis, dans `src/renderer/src/screens/Calendrier.tsx`, qui rend le popover : ajouter `softDelete` à la destructuration de `useEngagements()`, écrire le gestionnaire

```tsx
  async function handleDeleteTask(taskId: string) {
    setActionError(null);
    const { error } = await softDelete(taskId, false);
    if (error) {
      setActionError(error);
      return;
    }
    setPopoverTask(null);
  }
```

et passer `onDelete={() => handleDeleteTask(popoverTask.id)}` au `<TaskPopover>`.

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, tous les tests toujours verts.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/BoutonSuppression.tsx src/renderer/src/screens/DetailSkill.tsx src/renderer/src/screens/DetailProjet.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: let a skill, project or task be sent to the trash"
```

---

### Task 3: Écran Corbeille

**Files:**
- Create: `src/renderer/src/screens/Corbeille.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/screens/Reglages.tsx`

**Interfaces:**
- Consumes: `deletedEngagements`, `restore`, `purge` de `useEngagements()`
- Produces: la route `/corbeille`, atteignable par un lien depuis Réglages (**pas** d'entrée dans le rail de navigation, déjà à sept éléments)

- [ ] **Step 1: Écrire l'écran**

Créer `src/renderer/src/screens/Corbeille.tsx` :

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import type { Engagement } from '../lib/types';
import BoutonSuppression from '../components/BoutonSuppression';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { ChevronLeftIcon } from '../components/icons';

function typeLabel(engagement: Engagement): string {
  if (engagement.isProject) return 'Projet';
  return engagement.scheduledAt ? 'Tâche' : 'Skill';
}

function formatDeletedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Corbeille() {
  const { deletedEngagements, loading, error, restore, purge } = useEngagements();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRestore(engagement: Engagement) {
    setActionError(null);
    setBusyId(engagement.id);
    const { error: restoreError } = await restore(
      engagement.id,
      engagement.deletedAt as string,
      engagement.isProject
    );
    if (restoreError) setActionError(restoreError);
    setBusyId(null);
  }

  async function handlePurge(engagement: Engagement) {
    setActionError(null);
    setBusyId(engagement.id);
    const { error: purgeError } = await purge(engagement.id, engagement.isProject);
    if (purgeError) setActionError(purgeError);
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/reglages"
        className="flex w-fit items-center gap-2 font-sans text-[13px] text-muted transition-colors duration-150 hover:text-champagne"
      >
        <ChevronLeftIcon />
        Retour aux réglages
      </Link>

      <div>
        <h1 className="font-serif text-[30px] text-champagne">Corbeille</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Rien n'en sort tout seul : un élément y reste jusqu'à ce que tu le restaures ou le supprimes
          définitivement.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {loading && deletedEngagements.length === 0 ? (
        <EmptyState role="status">Chargement…</EmptyState>
      ) : deletedEngagements.length === 0 ? (
        <EmptyState>La corbeille est vide.</EmptyState>
      ) : (
        <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
          {deletedEngagements.map((engagement) => (
            <div key={engagement.id} className="flex items-center gap-4 bg-ink-800 px-[18px] py-4">
              <span className="w-14 shrink-0 font-data text-[10px] uppercase tracking-[0.08em] text-muted">
                {typeLabel(engagement)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-champagne">{engagement.name}</p>
                <p className="mt-0.5 font-data text-[11px] text-muted">
                  Supprimé le {formatDeletedAt(engagement.deletedAt as string)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRestore(engagement)}
                disabled={busyId === engagement.id}
              >
                Restaurer
              </Button>
              <BoutonSuppression
                onConfirm={() => handlePurge(engagement)}
                label="Supprimer définitivement"
                confirmLabel="Définitivement ?"
                busy={busyId === engagement.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Déclarer la route dans `App.tsx`**

Ajouter l'import à côté des autres écrans :

```tsx
import Corbeille from './screens/Corbeille';
```

et la route juste après celle de `reglages` :

```tsx
          <Route path="corbeille" element={<Corbeille />} />
```

- [ ] **Step 3: Ajouter le lien dans `Reglages.tsx`**

À la fin de l'écran, après la dernière section de réglages et avant le bouton de déconnexion s'il y en a un, ajouter :

```tsx
        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <div>
            <p className="text-[15px] text-champagne">Corbeille</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Restaurer ou supprimer définitivement ce qui a été supprimé
            </p>
          </div>
          <Link to="/corbeille" className={buttonClassName('secondary', 'sm')}>
            Ouvrir
          </Link>
        </div>
```

en important `Link` depuis `react-router-dom` et `buttonClassName` depuis `../components/Button`.

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck` puis `npm test -- --run`
Expected: aucune erreur, tous les tests toujours verts.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Corbeille.tsx src/renderer/src/App.tsx src/renderer/src/screens/Reglages.tsx
git commit -m "feat: add the trash screen with restore and permanent delete"
```

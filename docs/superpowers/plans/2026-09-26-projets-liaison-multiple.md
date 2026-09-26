# Projets : liaison multiple et composition — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le `project_id` unique par une vraie liaison plusieurs-à-plusieurs, et donner à la page projet la composition qui l'exerce — un skill pouvant enfin appartenir à plusieurs chantiers.

**Architecture:** Une table de liaison `saint_daily.engagement_project` devient la source de vérité, avec un repli sur la colonne `project_id` tant que la migration n'est pas appliquée à la main. La distinction entre « liaison indisponible » et « liaison vide » est portée par une signature — `LiaisonProjet[] | null` — et toute la règle de résolution vit dans `lib/projets.ts` en fonctions pures, parce que c'est le seul endroit testable dans un dépôt sans socle de test de composants.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Supabase (PostgREST), react-router-dom (HashRouter), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-projets-liaison-multiple-design.md`

## Global Constraints

- **La migration 0016 s'applique à la main.** Le code doit rester fonctionnel **avant** qu'elle ne passe. Table entièrement absente : l'échec de *lecture* ne s'affiche nulle part, l'échec d'*écriture* s'affiche.
- **La migration ne supprime ni ne renomme `project_id`.** L'application installée la lit.
- **Ne jamais ajouter `currentProjectId` à `DEFAULT_SETTINGS` ni à `toRow`.** `useSettings` crée la ligne par `.insert({ user_id, ...toRow(DEFAULT_SETTINGS) })` : une clé de plus nommerait une colonne inexistante, l'`INSERT` échouerait, `settings` resterait `null` pour toujours et tout l'écran Réglages deviendrait inaccessible. Cette tâche ne touche pas `useSettings`.
- **Créer une table dans `saint_daily` demande un `grant all … to anon, authenticated, service_role` explicite.** Sans lui, PostgREST refuse l'accès avant même la RLS, avec une erreur qui ne ressemble pas à un problème de droits. `public.profile` est restée dans `public` : la clé étrangère d'appartenance traverse les schémas.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px. Aucune valeur arbitraire.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 216 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0016_project_links.sql` | **créé** — la table de liaison, `due_at`, `current_project_id`, reprise des données. **Écrit, non appliqué.** |
| `src/renderer/src/lib/types.ts` | **modifié** — le type `LiaisonProjet` |
| `src/renderer/src/lib/projets.ts` | **créé** — les trois règles de résolution, pures |
| `src/renderer/src/lib/projets.test.ts` | **créé** — leurs tests, dont les trois états de `liaisons` |
| `src/renderer/src/hooks/useLiaisonsProjet.ts` | **créé** — lecture tolérante à l'absence, puis écriture |
| `src/renderer/src/screens/DetailProjet.tsx` | **modifié** — la section Composition |
| `src/renderer/src/components/TaskPopover.tsx` | **modifié** — le projet affiché vient d'une prop calculée |
| `src/renderer/src/screens/Calendrier.tsx` | **modifié** — `handleChangeProject` passe par la liaison |

---

### Task 1 : La migration et les règles pures

**Files:**
- Create: `supabase/migrations/0016_project_links.sql`
- Modify: `src/renderer/src/lib/types.ts`
- Create: `src/renderer/src/lib/projets.ts`
- Create: `src/renderer/src/lib/projets.test.ts`

**Interfaces:**
- Consumes: `Engagement` de `lib/types.ts`.
- Produces: `interface LiaisonProjet { id: string; userId: string; engagementId: string; projectId: string; position: number; createdAt: string }` ; `membresDuProjet(engagements: Engagement[], liaisons: LiaisonProjet[] | null, projetId: string): Engagement[]` ; `projetsDeLEngagement(engagements: Engagement[], liaisons: LiaisonProjet[] | null, engagementId: string): Engagement[]` ; `projetPrincipal(liaisons: LiaisonProjet[], engagementId: string): string | null`.

**Aucun écran n'est modifié par cette tâche.** La migration est écrite et **volontairement pas appliquée** : l'état pré-migration est une fonctionnalité de ce chantier, pas un accident, et c'est dans cet état que les tâches 2 et 3 seront d'abord vérifiées.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0016_project_links.sql`. Suivre le motif de `0013_journal.sql`, qui est la table la plus récemment créée dans ce schéma.

```sql
begin;

-- `profile` appartient à Saint Gym et est restée dans `public` lors du
-- déplacement des tables vers `saint_daily` (voir 0003) : la clé étrangère
-- d'appartenance traverse donc les schémas, comme celles posées par 0001.
--
-- Les deux clés étrangères vers `engagement` prennent `on delete cascade`,
-- que le `project_id` de 0008 n'a jamais eu. C'est ce manque qui rend une
-- purge en lot impossible aujourd'hui : elle devrait supprimer les enfants
-- avant les parents. La nouvelle table n'hérite pas du problème.
--
-- `check (engagement_id <> project_id)` : un projet étant un engagement,
-- la liaison autorise un projet dans un projet — c'est voulu, les
-- sous-projets en sortent gratuitement. Elle autoriserait aussi qu'un
-- engagement s'appartienne. Les cycles plus longs restent possibles et
-- devront être traités par le chantier qui exposera les sous-projets.
create table saint_daily.engagement_project (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(user_id) on delete cascade,
  engagement_id uuid not null references saint_daily.engagement(id) on delete cascade,
  project_id uuid not null references saint_daily.engagement(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (engagement_id, project_id),
  check (engagement_id <> project_id)
);

create index engagement_project_user_id_idx on saint_daily.engagement_project (user_id);

alter table saint_daily.engagement_project enable row level security;
create policy "engagement_project_owner_all" on saint_daily.engagement_project
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 0003 a posé des `alter default privileges` qui couvriraient cette table
-- si elle est créée par le rôle `postgres`, mais on ne parie pas sur le
-- rôle qui exécutera la migration : sans ces droits, PostgREST refuse
-- l'accès avant même que la RLS n'entre en jeu, et l'erreur ne ressemble
-- pas du tout à un problème de permissions.
grant all on saint_daily.engagement_project to anon, authenticated, service_role;

-- Reprise des rattachements existants. `project_id` N'EST PAS supprimée :
-- l'application installée la lit encore, et une migration qui retire ce
-- qu'une version déployée interroge est exactement ce qui a cassé la 1.5.1.
insert into saint_daily.engagement_project (user_id, engagement_id, project_id)
select user_id, id, project_id
  from saint_daily.engagement
 where project_id is not null;

-- Posées maintenant, exposées par des chantiers ultérieurs : une colonne
-- coûte une ligne dans une migration qu'on écrit de toute façon, contre
-- une migration entière à appliquer à la main plus tard.
alter table saint_daily.engagement
  add column due_at timestamptz;

alter table saint_daily.app_settings
  add column current_project_id uuid references saint_daily.engagement(id) on delete set null;

commit;
```

- [ ] **Step 2: Ajouter le type**

Dans `src/renderer/src/lib/types.ts`, après `interface EngagementMilestone` :

```ts
export interface LiaisonProjet {
  id: string;
  userId: string;
  engagementId: string;
  projectId: string;
  position: number;
  createdAt: string;
}
```

- [ ] **Step 3: Écrire les tests qui échouent**

Créer `src/renderer/src/lib/projets.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { membresDuProjet, projetPrincipal, projetsDeLEngagement } from './projets';
import type { Engagement, LiaisonProjet } from './types';

// Fabriques locales : `Engagement` a vingt-trois champs dont un seul ou deux
// comptent par test. Les épingler tous à chaque fois noierait ce qui est
// réellement sous test.
function unEngagement(partiel: Partial<Engagement> & { id: string }): Engagement {
  return {
    userId: 'u1',
    name: partiel.id,
    notes: null,
    tags: [],
    genericLevel: 'debutant',
    archivedAt: null,
    deletedAt: null,
    skippedAt: null,
    scheduledAt: null,
    scheduledEndsAt: null,
    priority: 'aucune',
    recurrenceSeriesId: null,
    recurrenceType: 'aucune',
    recurrenceInterval: null,
    recurrenceWeekdays: null,
    isProject: false,
    projectId: null,
    goalPeriod: null,
    goalMetric: null,
    goalTarget: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

function uneLiaison(partiel: Partial<LiaisonProjet> & { engagementId: string; projectId: string }): LiaisonProjet {
  return {
    id: `${partiel.engagementId}-${partiel.projectId}`,
    userId: 'u1',
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

const maison = unEngagement({ id: 'maison', isProject: true });
const atelier = unEngagement({ id: 'atelier', isProject: true });
const menuiserie = unEngagement({ id: 'menuiserie' });
const plomberie = unEngagement({ id: 'plomberie' });
const engagements = [maison, atelier, menuiserie, plomberie];

describe('membresDuProjet', () => {
  it('rend les engagements liés quand la liaison fait autorité', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison' }),
      uneLiaison({ engagementId: 'plomberie', projectId: 'maison' }),
    ];
    expect(membresDuProjet(engagements, liaisons, 'maison').map((e) => e.id)).toEqual([
      'menuiserie',
      'plomberie',
    ]);
  });

  it('rend une liste vide quand la liaison existe mais ne dit rien de ce projet', () => {
    // Distinct du cas indisponible : ici la table a répondu, et sa réponse
    // est « personne ». Retomber sur `project_id` ici ressusciterait un
    // rattachement que l'utilisateur vient de retirer.
    const liaisons = [uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier' })];
    expect(membresDuProjet(engagements, liaisons, 'maison')).toEqual([]);
  });

  it('retombe sur `project_id` quand la liaison est indisponible', () => {
    // `null` veut dire « la table n'existe pas encore ». Les rattachements
    // hérités doivent rester visibles jusqu'à ce que le SQL soit collé.
    const avecColonne = [maison, unEngagement({ id: 'menuiserie', projectId: 'maison' })];
    expect(membresDuProjet(avecColonne, null, 'maison').map((e) => e.id)).toEqual(['menuiserie']);
  });

  it('ignore `project_id` dès que la liaison est disponible, même s’il la contredit', () => {
    // Le cas qui arrive pour tout engagement modifié par une version
    // antérieure de l'application. La précédence est totale, jamais une
    // fusion : réunir les deux sources ressusciterait un rattachement retiré.
    const perime = [maison, unEngagement({ id: 'plomberie', projectId: 'maison' })];
    const liaisons = [uneLiaison({ engagementId: 'plomberie', projectId: 'atelier' })];
    expect(membresDuProjet(perime, liaisons, 'maison')).toEqual([]);
  });
});

describe('projetsDeLEngagement', () => {
  it('rend les plusieurs projets d’un même skill', () => {
    // C'est le cas qui motive tout le chantier : « menuiserie » sert la
    // maison ET l'atelier, ce que le `project_id` unique ne pouvait pas dire.
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison' }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier' }),
    ];
    expect(projetsDeLEngagement(engagements, liaisons, 'menuiserie').map((e) => e.id)).toEqual([
      'maison',
      'atelier',
    ]);
  });

  it('ne rend que des projets, jamais un skill', () => {
    const liaisons = [uneLiaison({ engagementId: 'menuiserie', projectId: 'plomberie' })];
    expect(projetsDeLEngagement(engagements, liaisons, 'menuiserie')).toEqual([]);
  });

  it('retombe sur `project_id` quand la liaison est indisponible', () => {
    const avecColonne = [maison, atelier, unEngagement({ id: 'menuiserie', projectId: 'atelier' })];
    expect(projetsDeLEngagement(avecColonne, null, 'menuiserie').map((e) => e.id)).toEqual(['atelier']);
  });
});

describe('projetPrincipal', () => {
  it('prend la plus petite position', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', position: 2 }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', position: 1 }),
    ];
    expect(projetPrincipal(liaisons, 'menuiserie')).toBe('maison');
  });

  it('départage deux positions égales par la plus ancienne', () => {
    // Le tri est explicite parce qu'un tri implicite ferait dépendre
    // `project_id` de l'ordre de retour de PostgREST : un défaut
    // impossible à reproduire.
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', createdAt: '2026-05-01T00:00:00.000Z' }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(projetPrincipal(liaisons, 'menuiserie')).toBe('maison');
  });

  it('rend null quand l’engagement n’est lié à rien', () => {
    // C'est ce `null` qui remettra `project_id` à vide pour l'application
    // installée quand on détache le dernier projet.
    expect(projetPrincipal([], 'menuiserie')).toBeNull();
  });

  it('ne modifie pas le tableau reçu', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', position: 2 }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', position: 1 }),
    ];
    projetPrincipal(liaisons, 'menuiserie');
    expect(liaisons.map((l) => l.projectId)).toEqual(['atelier', 'maison']);
  });
});
```

- [ ] **Step 4: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: FAIL — le module `./projets` n'existe pas encore. Le message exact dépend de la version de Vite ; ce qui compte est que la cause soit bien « module introuvable » et non une assertion.

- [ ] **Step 5: Écrire le module**

Créer `src/renderer/src/lib/projets.ts` :

```ts
// Les règles qui décident de quoi un projet est composé. Elles vivent ici,
// en fonctions pures, parce que le dépôt n'a aucun socle de test de
// composants : c'est le seul endroit où cette logique peut être vérifiée.
//
// Le paramètre `liaisons` porte trois états, et les distinguer EST le
// chantier :
//   `null`   la table n'existe pas encore (migration 0016 non appliquée)
//   `[]`     la table existe et ne contient rien
//   peuplé   la table existe et fait autorité
//
// Confondre les deux premiers produirait l'un de deux défauts opposés :
// une liaison indisponible lue comme vide ferait disparaître tous les
// rattachements, une liaison vide lue comme indisponible ressusciterait
// ceux que l'utilisateur vient de retirer. C'est pour rendre cette confusion
// impossible par accident que le type est `LiaisonProjet[] | null` plutôt
// qu'un tableau et un drapeau séparés.

import type { Engagement, LiaisonProjet } from './types';

/**
 * Les engagements composant un projet.
 *
 * La précédence est TOTALE, jamais une fusion : dès que les liaisons sont
 * disponibles, `project_id` est ignoré même s'il les contredit — ce qui
 * arrivera pour tout engagement modifié par une version antérieure de
 * l'application, qui écrit encore la colonne.
 */
export function membresDuProjet(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  projetId: string
): Engagement[] {
  if (liaisons === null) {
    return engagements.filter((e) => e.projectId === projetId);
  }
  const ids = new Set(
    liaisons.filter((l) => l.projectId === projetId).map((l) => l.engagementId)
  );
  return engagements.filter((e) => ids.has(e.id));
}

/**
 * Les projets auxquels un engagement appartient — le sens qui n'existait
 * pas avec une colonne unique, et la raison d'être de ce chantier.
 *
 * Le résultat est filtré sur `isProject` : une liaison pointant un
 * engagement qui n'est pas un projet ne devrait pas exister, mais rien au
 * niveau du schéma ne l'interdit, et une telle ligne ne doit pas se
 * retrouver présentée comme un projet.
 */
export function projetsDeLEngagement(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  engagementId: string
): Engagement[] {
  const projets = engagements.filter((e) => e.isProject);
  if (liaisons === null) {
    const engagement = engagements.find((e) => e.id === engagementId);
    if (!engagement?.projectId) return [];
    return projets.filter((p) => p.id === engagement.projectId);
  }
  const ids = new Set(
    liaisons.filter((l) => l.engagementId === engagementId).map((l) => l.projectId)
  );
  return projets.filter((p) => ids.has(p.id));
}

/**
 * Le projet à recopier dans `project_id` pour que l'application installée
 * reste cohérente — voir la spec, §5. Écriture de compatibilité, à retirer
 * le jour où la colonne disparaît.
 *
 * Le tri est explicite parce qu'un tri implicite ferait dépendre la valeur
 * de l'ordre de retour de PostgREST : un défaut impossible à reproduire.
 *
 * Le paramètre n'est pas nullable : on n'appelle cette fonction qu'en
 * écrivant, donc quand la liaison est forcément disponible.
 */
export function projetPrincipal(liaisons: LiaisonProjet[], engagementId: string): string | null {
  const siennes = liaisons.filter((l) => l.engagementId === engagementId);
  if (siennes.length === 0) return null;
  // Copie avant tri : `sort` mute, et le tableau reçu appartient à l'appelant.
  const triees = [...siennes].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
  );
  return triees[0].projectId;
}
```

- [ ] **Step 6: Lancer les tests pour les voir passer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 7: Vérifier la suite entière et le typage**

Run: `npm test`
Expected: PASS — 216 + 12 = **228 tests**, 17 fichiers.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0016_project_links.sql src/renderer/src/lib/types.ts src/renderer/src/lib/projets.ts src/renderer/src/lib/projets.test.ts
git commit -m "feat: add the project link table and its resolution rules"
```

---

### Task 2 : La lecture — le hook et la composition

**Files:**
- Create: `src/renderer/src/hooks/useLiaisonsProjet.ts`
- Modify: `src/renderer/src/screens/DetailProjet.tsx`

**Interfaces:**
- Consumes: `LiaisonProjet` de `lib/types.ts` ; `membresDuProjet` de `lib/projets.ts`.
- Produces: `useLiaisonsProjet(): { liaisons: LiaisonProjet[] | null; loading: boolean; refresh: () => Promise<LiaisonProjet[] | null> }`. La tâche 3 y ajoutera `lier`, `delier` et `synchroniserColonne`.

`refresh` **renvoie la liste qu'il vient de poser**, en plus de la mettre dans l'état. La tâche 3 en a besoin : après un rattachement, il lui faut les liaisons fraîches immédiatement pour en déduire le projet principal, et lire l'état de React juste après l'avoir posé rendrait la valeur précédente.

Cette tâche se vérifie **avant** que la migration ne soit appliquée : c'est l'état où la table n'existe pas, où `liaisons` vaut `null`, et où la composition doit afficher les rattachements hérités de `project_id`.

- [ ] **Step 1: Écrire le hook**

Créer `src/renderer/src/hooks/useLiaisonsProjet.ts`, sur le motif de `useMilestones.ts` :

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { LiaisonProjet } from '../lib/types';

interface LiaisonRow {
  id: string;
  user_id: string;
  engagement_id: string;
  project_id: string;
  position: number;
  created_at: string;
}

function fromRow(row: LiaisonRow): LiaisonProjet {
  return {
    id: row.id,
    userId: row.user_id,
    engagementId: row.engagement_id,
    projectId: row.project_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

/**
 * Charge toutes les liaisons projet de l'utilisateur d'un coup, comme
 * `useEngagements` charge tous les engagements : l'application filtre en
 * mémoire et n'a aucune requête par projet.
 *
 * `liaisons` vaut `null` tant que la table n'existe pas — c'est-à-dire tant
 * que la migration 0016 n'a pas été appliquée à la main. Ce `null` n'est pas
 * une erreur à afficher mais un état de fonctionnement : il déclenche le
 * repli sur `project_id` dans `lib/projets.ts`. Le rendre `[]` ferait
 * disparaître tous les rattachements de l'utilisateur.
 */
export function useLiaisonsProjet() {
  const [liaisons, setLiaisons] = useState<LiaisonProjet[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Renvoie la liste en plus de la poser dans l'état : un appelant qui vient
  // d'écrire a besoin des liaisons fraîches tout de suite, et relire l'état
  // de React juste après l'avoir posé rendrait la valeur précédente.
  const refresh = useCallback(async (): Promise<LiaisonProjet[] | null> => {
    setLoading(true);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement_project')
      .select('*');
    // Règle du dépôt : l'échec de LECTURE d'une table absente ne s'affiche
    // nulle part. L'utilisateur n'a rien fait, il n'y a rien à lui dire, et
    // le repli de `lib/projets.ts` couvre le cas. Ce hook n'expose donc
    // aucune erreur de lecture — les échecs d'écriture, eux, sont renvoyés
    // par `lier` et `delier` à la tâche 3.
    const resultat = fetchError ? null : (data as LiaisonRow[]).map(fromRow);
    setLiaisons(resultat);
    setLoading(false);
    return resultat;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { liaisons, loading, refresh };
}
```

- [ ] **Step 2: Brancher la composition dans `DetailProjet`**

Dans `src/renderer/src/screens/DetailProjet.tsx`, ajouter les imports :

```tsx
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { membresDuProjet } from '../lib/projets';
```

Remplacer la ligne qui calcule `children` :

```tsx
  const children = useMemo(() => engagements.filter((e) => e.projectId === id), [engagements, id]);
```

par :

```tsx
  const { liaisons } = useLiaisonsProjet();
  // `membresDuProjet` porte la règle de résolution : la liaison fait
  // autorité dès qu'elle est disponible, et `project_id` ne sert que de
  // repli tant que la migration 0016 n'est pas appliquée.
  const children = useMemo(
    () => (id ? membresDuProjet(engagements, liaisons, id) : []),
    [engagements, liaisons, id]
  );
```

Puis renommer le titre de la section, de `Engagements liés` à `Composition`.

- [ ] **Step 3: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 228 tests (cette tâche n'en ajoute aucun : le hook parle à Supabase, que le dépôt ne simule nulle part).

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/hooks/useLiaisonsProjet.ts src/renderer/src/screens/DetailProjet.tsx
git commit -m "feat: read project composition through the link table"
```

---

### Task 3 : L'écriture — rattacher, détacher, et la compatibilité

**Files:**
- Modify: `src/renderer/src/hooks/useLiaisonsProjet.ts`
- Modify: `src/renderer/src/screens/DetailProjet.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Calendrier.tsx`

**Interfaces:**
- Consumes: `projetPrincipal` de `lib/projets.ts` ; `updateEngagement(id, patch)` de `useEngagements`, qui accepte déjà `projectId` dans son patch ; `useAuth()` pour la session.
- Produces, sur `useLiaisonsProjet` :
  - `lier(engagementId: string, projectId: string): Promise<{ error: string | null; liaisons: LiaisonProjet[] | null }>`
  - `delier(engagementId: string, projectId: string): Promise<{ error: string | null; liaisons: LiaisonProjet[] | null }>`
  - `synchroniserColonne(engagementId: string, liaisonsFraiches: LiaisonProjet[], updateEngagement: (id: string, patch: { projectId: string | null }) => Promise<{ error: string | null }>): Promise<{ error: string | null }>`
  
  Et sur `TaskPopover`, une prop `projetSelectionne: string | null`.

Les deux mutations renvoient les liaisons fraîches en plus de l'erreur, parce que l'appelant doit immédiatement en déduire le projet principal à recopier dans la colonne.

- [ ] **Step 1: Ajouter les deux mutations au hook**

Dans `useLiaisonsProjet.ts`, ajouter l'import `import { useAuth } from '../lib/auth';`, récupérer la session dans le hook (`const { session } = useAuth();`), et ajouter avant le `return` :

```ts
  // Contrairement à la lecture, un échec d'écriture DOIT se voir : ici
  // l'utilisateur vient d'agir, et le message doit dire quoi faire plutôt
  // que ce qui a cassé.
  const MESSAGE_TABLE_ABSENTE =
    'Le rattachement multiple n’est pas encore disponible : applique la migration 0016.';

  async function lier(engagementId: string, projectId: string) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement_project')
      .insert({
        user_id: session.user.id,
        engagement_id: engagementId,
        project_id: projectId,
        position: liaisons?.filter((l) => l.engagementId === engagementId).length ?? 0,
      });
    if (insertError) return { error: MESSAGE_TABLE_ABSENTE, liaisons: null };
    return { error: null, liaisons: await refresh() };
  }

  async function delier(engagementId: string, projectId: string) {
    const { error: deleteError } = await getSupabaseClient()
      .from('engagement_project')
      .delete()
      .eq('engagement_id', engagementId)
      .eq('project_id', projectId);
    if (deleteError) return { error: MESSAGE_TABLE_ABSENTE, liaisons: null };
    return { error: null, liaisons: await refresh() };
  }
```

et les exposer : `return { liaisons, loading, refresh, lier, delier, synchroniserColonne };` — `synchroniserColonne` étant ajoutée à l'étape suivante.

- [ ] **Step 2: Écrire la synchronisation de compatibilité**

Toujours dans `useLiaisonsProjet.ts`, ajouter une fonction qui relit les liaisons fraîches et recopie le projet principal dans la colonne. Elle prend `updateEngagement` en paramètre plutôt que d'appeler `useEngagements`, pour ne pas monter un second chargement complet des engagements dans ce hook :

```ts
  /**
   * Écriture de COMPATIBILITÉ, à retirer le jour où `project_id` disparaît.
   *
   * L'application installée lit encore cette colonne. Cesser de l'écrire
   * figerait ses rattachements à leur dernière valeur, sans le dire. On la
   * remet donc au projet principal après chaque modification — et à `null`
   * quand l'engagement n'est plus lié à rien.
   */
  async function synchroniserColonne(
    engagementId: string,
    liaisonsFraiches: LiaisonProjet[],
    updateEngagement: (id: string, patch: { projectId: string | null }) => Promise<{ error: string | null }>
  ) {
    return updateEngagement(engagementId, {
      projectId: projetPrincipal(liaisonsFraiches, engagementId),
    });
  }
```

Importer `projetPrincipal` depuis `../lib/projets`, et exposer `synchroniserColonne`.

- [ ] **Step 3: Rattacher et détacher depuis `DetailProjet`**

Dans `DetailProjet.tsx`, récupérer `lier`, `delier`, `synchroniserColonne` et `liaisons` du hook, et `updateEngagement` de `useEngagements`. Ajouter les deux gestionnaires. Ils sont symétriques et ne diffèrent que par la mutation appelée — c'est voulu : chacun se lit seul, et les factoriser derrière un drapeau les rendrait tous deux plus difficiles à suivre pour trois lignes gagnées.

```tsx
  async function handleLier(engagementId: string) {
    if (!id) return;
    setActionError(null);
    const { error: lierError, liaisons: fraiches } = await lier(engagementId, id);
    if (lierError) {
      setActionError(lierError);
      return;
    }
    const { error: syncError } = await synchroniserColonne(engagementId, fraiches ?? [], updateEngagement);
    if (syncError) setActionError(syncError);
  }

  async function handleDelier(engagementId: string) {
    if (!id) return;
    setActionError(null);
    const { error: delierError, liaisons: fraiches } = await delier(engagementId, id);
    if (delierError) {
      setActionError(delierError);
      return;
    }
    const { error: syncError } = await synchroniserColonne(engagementId, fraiches ?? [], updateEngagement);
    if (syncError) setActionError(syncError);
  }
```

Le `?? []` n'est pas de la superstition : `lier` et `delier` ne renvoient des liaisons `null` que sur le chemin d'erreur, déjà traité au-dessus — mais le type l'autorise, et `projetPrincipal` n'accepte pas `null` par conception, puisqu'on ne l'appelle qu'en écrivant.

- [ ] **Step 4: Ajouter le sélecteur et le bouton de détachement**

Dans la section Composition, après la liste, un sélecteur des skills rattachables — non archivés, pas des projets, pas déjà membres :

```tsx
        <label className="mt-3 flex flex-col gap-2">
          <span className="font-data text-libelle uppercase tracking-[0.1em] text-muted">
            Rattacher un skill
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleLier(e.target.value);
            }}
            className={`border border-ink-700 bg-ink-800 px-3 py-2 text-corps text-champagne ${FOCUS_RING}`}
          >
            <option value="">Choisir…</option>
            {rattachables.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
```

avec, près des autres `useMemo` :

```tsx
  // Les tâches ne se rattachent pas d'ici : on les rattache depuis le
  // calendrier, là où on les planifie. Le modèle les accepte, c'est
  // l'interface qui choisit de ne pas les proposer.
  const rattachables = useMemo(() => {
    const dejaMembres = new Set(children.map((e) => e.id));
    return engagements.filter(
      (e) => !e.isProject && !e.scheduledAt && !e.archivedAt && !dejaMembres.has(e.id)
    );
  }, [engagements, children]);
```

et, sur chaque ligne de la liste, un bouton de détachement à côté du lien existant. `FOCUS_RING` doit être déclaré en tête du fichier s'il ne l'est pas déjà, sur le modèle de `Reglages.tsx` :

```tsx
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
```

- [ ] **Step 5: Rebrancher le popover du calendrier**

`TaskPopover` lit aujourd'hui `task.projectId` pour la valeur de son `<select>`. La colonne n'étant plus la source de vérité, la valeur doit venir de la liaison. Ajouter une prop plutôt que de faire lire le hook au composant, qui reste ainsi sans dépendance de données :

```tsx
  projetSelectionne: string | null;
```

et remplacer `value={task.projectId ?? ''}` par `value={projetSelectionne ?? ''}`.

Dans `Calendrier.tsx`, ajouter les imports — `import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';`, `import { projetPrincipal } from '../lib/projets';` et `import type { LiaisonProjet } from '../lib/types';` — récupérer `liaisons`, `lier`, `delier` et `synchroniserColonne` du hook, puis réécrire le gestionnaire. Le popover restant à choix unique, choisir un projet **remplace** le précédent :

```tsx
  async function handleChangeProject(taskId: string, projectId: string | null) {
    // Choix unique sur un modèle multiple : on retire les liaisons
    // existantes de cette tâche avant d'en poser une. Le modèle en
    // accepterait plusieurs ; c'est l'interface qui n'en propose qu'une.
    const actuelles = (liaisons ?? []).filter((l) => l.engagementId === taskId);
    for (const l of actuelles) {
      const { error } = await delier(taskId, l.projectId);
      if (error) {
        setActionError(error);
        return;
      }
    }
    let fraiches: LiaisonProjet[] | null = liaisons;
    if (projectId) {
      const { error, liaisons: apres } = await lier(taskId, projectId);
      if (error) {
        setActionError(error);
        return;
      }
      fraiches = apres;
    }
    const { error: syncError } = await synchroniserColonne(taskId, fraiches ?? [], updateEngagement);
    if (syncError) {
      setActionError(syncError);
      return;
    }
    setActionError(null);
    setPopoverTask((current) => (current && current.id === taskId ? { ...current, projectId } : current));
  }
```

et passer la prop au popover :

```tsx
  projetSelectionne={popoverTask ? projetPrincipal(liaisons ?? [], popoverTask.id) : null}
```

- [ ] **Step 6: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 228 tests.

Run: `npm run typecheck`
Expected: propre. Un `TaskPopover` appelé sans sa nouvelle prop **doit** faire échouer cette commande — c'est le filet qui garantit qu'aucun site d'appel n'a été oublié.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/hooks/useLiaisonsProjet.ts src/renderer/src/screens/DetailProjet.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Calendrier.tsx
git commit -m "feat: attach and detach project members through the link table"
```

---

### Task 4 : Vérification finale, dans les deux états de migration

**Files:** aucun, sauf correctifs issus des constats.

C'est le seul chantier de la série où **l'état pré-migration est une fonctionnalité**. Il se vérifie donc deux fois, et l'ordre naturel donne le premier état gratuitement : il suffit de ne pas encore coller le SQL.

- [ ] **Step 1: Énumérer les classes introduites**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "\b(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9./]+"| sort -u`

Vérifier que l'ensemble obtenu est **inclus** dans les six rôles et les sept crans. Lister ce qui existe puis contrôler l'inclusion, jamais l'inverse.

- [ ] **Step 2: Suite complète et typage**

Run: `npm test`
Expected: **228 tests, 17 fichiers.** Un total doublé signifie qu'un worktree traîne.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Merge local dans master**

`preview_start` lit le `launch.json` du dépôt racine et sert toujours `master`, jamais le worktree, silencieusement. La vérification live n'a donc de sens qu'après le merge local.

- [ ] **Step 4: Vérification live AVANT la migration**

La table n'existe pas encore. Contrôler :

1. La page d'un projet affiche bien ses membres **hérités de `project_id`** — rien n'a disparu.
2. Tenter de rattacher un skill affiche le message qui dit d'appliquer la migration 0016, et non une erreur technique.
3. La console ne montre aucune erreur non gérée au chargement de la page projet.
4. Le calendrier fonctionne, et son popover affiche le projet hérité.

- [ ] **Step 5: Appliquer la migration**

Coller `supabase/migrations/0016_project_links.sql` dans l'éditeur SQL Supabase. Vérifier que la reprise a bien créé une liaison par rattachement existant.

- [ ] **Step 6: Vérification live APRÈS la migration**

1. Les membres affichés sont les mêmes qu'avant — la reprise n'a rien perdu.
2. Rattacher un skill fonctionne, détacher aussi.
3. **Le cas qui motive tout le chantier** : rattacher un même skill à deux projets différents, et vérifier qu'il apparaît dans la composition des deux.
4. Après avoir rattaché un skill à deux projets puis détaché le premier, `project_id` suit bien — la colonne vaut le projet restant.
5. Le popover du calendrier change bien le projet d'une tâche, et l'ancien rattachement est remplacé et non cumulé.

- [ ] **Step 7: Push, seulement si tout est passé**

Ne pas enchaîner en proposant une release.

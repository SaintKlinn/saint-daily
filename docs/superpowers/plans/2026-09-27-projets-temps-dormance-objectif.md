# Projets : temps, dormance et objectif — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à un projet les trois informations qui font qu'on ouvre son écran — le temps qu'on y a passé, la date où on y a touché pour la dernière fois, et l'objectif de rythme qu'on s'est donné.

**Architecture:** Trois fonctions pures s'ajoutent à `lib/projets.ts` ; tout le reste est du câblage de code déjà écrit et déjà testé — `formatMinutes`, `daysSinceLastPractice`, `computeGoalProgress` — qui accepte déjà un simple tableau d'entrées sans se soucier de savoir à qui il appartient. La seule chose qui manquait était de rassembler les entrées d'un projet.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Supabase (PostgREST), react-router-dom (HashRouter), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-projets-temps-dormance-objectif-design.md`

## Global Constraints

- **Aucune migration de base, aucune colonne nouvelle.** Les trois champs d'objectif — `goalPeriod`, `goalMetric`, `goalTarget` — existent sur tout engagement depuis la migration 0012.
- **Toute la logique dérivée vit dans `lib/projets.ts`, en fonctions pures.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où ce calcul peut être vérifié. Un calcul fait dans un écran est un calcul invérifiable.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px. Aucune valeur arbitraire.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet.
- **Aucun seuil de dormance.** On affiche la date, jamais un jugement.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 232 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/lib/projets.ts` | **modifié** — trois fonctions dérivées s'ajoutent aux quatre règles de résolution |
| `src/renderer/src/lib/projets.test.ts` | **modifié** — leurs tests |
| `src/renderer/src/components/Objectif.tsx` | **créé** — `GoalProgress` et `GoalSetter`, extraits de `DetailSkill` pour servir les deux écrans |
| `src/renderer/src/screens/DetailSkill.tsx` | **modifié** — consomme les deux composants extraits au lieu de les déclarer |
| `src/renderer/src/screens/DetailProjet.tsx` | **modifié** — temps, dormance, objectif |
| `src/renderer/src/screens/ListeProjets.tsx` | **modifié** — temps et dormance par ligne |

## Décision d'architecture : extraire plutôt que dupliquer

La spec (§5) dit « on reprend le motif tel quel plutôt que d'en inventer un second ». Deux lectures étaient possibles : copier les composants, ou les extraire.

**On extrait.** `GoalSetter` et `GoalProgress` sont aujourd'hui déclarés au bas de `DetailSkill.tsx`, un fichier de **682 lignes**. Les dupliquer dans `DetailProjet` créerait deux formulaires à tenir en phase, ce qu'un relecteur signalerait à juste titre — et le second écran n'a aucune raison d'avoir une version divergente du premier. L'extraction allège au passage le fichier qu'on touche, ce qu'un bon développeur fait du code qu'il ouvre.

Elle modifie `DetailSkill`, qui n'est pas au périmètre de B3. C'est assumé : c'est le coût de ne pas dupliquer, et il est plus faible que celui de la divergence.

---

### Task 1 : Les trois fonctions dérivées

**Files:**
- Modify: `src/renderer/src/lib/projets.ts`
- Modify: `src/renderer/src/lib/projets.test.ts`

**Interfaces:**
- Consumes: `Engagement` de `lib/types.ts` (déjà importé dans ce fichier).
- Produces:
  - `entreesDuProjet<T>(entreesParEngagement: Record<string, T[]>, membres: Engagement[], projetId: string): T[]`
  - `tempsCumuleMinutes(entrees: { durationMinutes: number }[]): number`
  - `formatDormance(jours: number | null): string`

**Aucun écran n'est modifié par cette tâche.**

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `src/renderer/src/lib/projets.test.ts`, et compléter l'import de la première ligne pour inclure les trois nouveaux noms :

```ts
describe('entreesDuProjet', () => {
  it('réunit les entrées des membres et celles du projet lui-même', () => {
    // La règle qui compte : un projet EST un engagement et peut porter des
    // entrées directement — ce que fera la « session de chantier ». Ne
    // compter que les membres rendrait ce temps-là invisible dans le total
    // de son propre projet.
    const parEngagement = {
      menuiserie: [{ durationMinutes: 30 }],
      maison: [{ durationMinutes: 90 }],
    };
    const membres = [unEngagement({ id: 'menuiserie' })];
    const resultat = entreesDuProjet(parEngagement, membres, 'maison');
    expect(resultat.map((e) => e.durationMinutes).sort((a, b) => a - b)).toEqual([30, 90]);
  });

  it('rend une liste vide pour un projet sans membre ni entrée propre', () => {
    // Surtout pas les entrées de tout le monde : le `Record` contient celles
    // d'engagements qui ne le concernent pas.
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    expect(entreesDuProjet(parEngagement, [], 'maison')).toEqual([]);
  });

  it('tolère un membre absent du Record', () => {
    // Le hook n'indexe que les engagements qui ONT des entrées : l'absence
    // est la normale, pas une anomalie.
    const membres = [unEngagement({ id: 'menuiserie' }), unEngagement({ id: 'plomberie' })];
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 30 }]);
  });

  it('ne compte pas deux fois si le projet figure parmi ses propres membres', () => {
    // La contrainte `check (engagement_id <> project_id)` de la migration
    // 0016 l'interdit en base, mais la fonction ne doit pas dépendre d'une
    // garantie posée ailleurs pour rester juste.
    const parEngagement = { maison: [{ durationMinutes: 90 }] };
    const membres = [unEngagement({ id: 'maison', isProject: true })];
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 90 }]);
  });

  it('compte le temps d’un skill partagé dans chacun de ses deux projets', () => {
    // Le cas qui justifie tout le modèle du chantier A : « menuiserie » sert
    // la maison ET l'atelier, et ses 30 minutes comptent des deux côtés.
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    const membres = [unEngagement({ id: 'menuiserie' })];
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 30 }]);
    expect(entreesDuProjet(parEngagement, membres, 'atelier')).toEqual([{ durationMinutes: 30 }]);
  });
});

describe('tempsCumuleMinutes', () => {
  it('somme les durées', () => {
    expect(tempsCumuleMinutes([{ durationMinutes: 30 }, { durationMinutes: 90 }])).toBe(120);
  });

  it('rend zéro sur une liste vide', () => {
    expect(tempsCumuleMinutes([])).toBe(0);
  });
});

describe('formatDormance', () => {
  it('distingue « aucune activité » de « aujourd’hui »', () => {
    // `daysSinceLastPractice` rend `null` quand il n'y a aucune entrée, et
    // `0` quand la dernière est du jour. Les confondre dirait d'un chantier
    // jamais commencé qu'on y a touché aujourd'hui.
    expect(formatDormance(null)).toBe('Aucune activité');
    expect(formatDormance(0)).toBe("Aujourd'hui");
  });

  it('dit « hier » au singulier', () => {
    expect(formatDormance(1)).toBe('Hier');
  });

  it('compte en jours jusqu’à 13', () => {
    expect(formatDormance(2)).toBe('Il y a 2 jours');
    expect(formatDormance(13)).toBe('Il y a 13 jours');
  });

  it('bascule en semaines à 14 jours', () => {
    expect(formatDormance(14)).toBe('Il y a 2 semaines');
    expect(formatDormance(55)).toBe('Il y a 7 semaines');
  });

  it('bascule en mois à 56 jours, sans jamais paraître reculer', () => {
    // Le piège que ce test garde : avec `Math.floor(jours / 30)`, 56 jours
    // donnerait « 1 mois » juste après « 7 semaines » — une valeur qui se
    // lit comme PLUS PETITE que la précédente alors que le temps a avancé.
    // L'arrondi évite cette marche arrière apparente.
    expect(formatDormance(56)).toBe('Il y a 2 mois');
    expect(formatDormance(200)).toBe('Il y a 7 mois');
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: FAIL — les trois fonctions n'existent pas encore. Le message exact dépend de la version de Vite ; ce qui compte est que la cause soit bien « n'est pas une fonction » ou « introuvable », pas une assertion.

- [ ] **Step 3: Écrire les trois fonctions**

Ajouter à la fin de `src/renderer/src/lib/projets.ts` :

```ts
/**
 * Les entrées de pratique d'un projet : celles de ses membres, plus les
 * siennes propres.
 *
 * Un projet EST un engagement et peut donc porter des entrées directement —
 * c'est ce que fera la « session de chantier ». Ne compter que les membres
 * rendrait ce temps-là invisible dans le total de son propre projet. La règle
 * vit ici et non chez l'appelant, précisément pour qu'un test puisse la
 * contredire.
 *
 * Générique sur le type d'entrée : l'appelant récupère le type concret qu'il
 * a fourni, et les fonctions qui consomment le résultat — `formatMinutes`,
 * `daysSinceLastPractice`, `computeGoalProgress` — n'exigent chacune qu'une
 * poignée de champs.
 */
export function entreesDuProjet<T>(
  entreesParEngagement: Record<string, T[]>,
  membres: Engagement[],
  projetId: string
): T[] {
  // Un `Set` plutôt qu'un tableau : si le projet figurait parmi ses propres
  // membres, ses entrées compteraient double. La contrainte
  // `check (engagement_id <> project_id)` de la 0016 l'interdit en base, mais
  // cette fonction ne doit pas dépendre d'une garantie posée ailleurs.
  const ids = new Set(membres.map((m) => m.id));
  ids.add(projetId);
  return [...ids].flatMap((id) => entreesParEngagement[id] ?? []);
}

/**
 * Le total en minutes d'un ensemble d'entrées.
 *
 * Trivial, et nommé pour ça : noyé dans un `reduce` d'écran il serait
 * invérifiable, alors qu'il porte la seule unité de toute la tranche.
 */
export function tempsCumuleMinutes(entrees: { durationMinutes: number }[]): number {
  return entrees.reduce((total, e) => total + e.durationMinutes, 0);
}

/**
 * La dernière activité d'un chantier, en toutes lettres.
 *
 * L'application rend ailleurs les jours bruts — « pas pratiqué depuis 3
 * jours » dans les notifications de l'Accueil — ce qui convient à un skill
 * quotidien, dont les écarts se comptent en jours. Un chantier est l'inverse :
 * ses écarts se comptent en semaines, et « il y a 47 jours » se lit moins bien
 * que « il y a 7 semaines ».
 *
 * `null` veut dire « aucune entrée » et non « zéro jour » : c'est ce que rend
 * `daysSinceLastPractice` sur une liste vide, et les confondre dirait d'un
 * chantier jamais commencé qu'on y a touché aujourd'hui.
 *
 * Les mois sont ARRONDIS et non tronqués. Avec une troncature, 56 jours
 * donneraient « 1 mois » juste après « 7 semaines » : une valeur qui se lit
 * comme plus petite que la précédente alors que le temps a avancé.
 */
export function formatDormance(jours: number | null): string {
  if (jours === null) return 'Aucune activité';
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  if (jours < 14) return `Il y a ${jours} jours`;
  if (jours < 56) return `Il y a ${Math.floor(jours / 7)} semaines`;
  return `Il y a ${Math.round(jours / 30)} mois`;
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: PASS — les 16 tests existants plus 13 nouveaux, soit 29 dans ce fichier.

- [ ] **Step 5: Vérifier la suite entière et le typage**

Run: `npm test`
Expected: PASS — 232 + 13 = **245 tests**, 17 fichiers.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/projets.ts src/renderer/src/lib/projets.test.ts
git commit -m "feat: derive a project's practice entries, time and dormancy"
```

---

### Task 2 : L'écran du projet

**Files:**
- Create: `src/renderer/src/components/Objectif.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/screens/DetailProjet.tsx`

**Interfaces:**
- Consumes: `entreesDuProjet`, `tempsCumuleMinutes`, `formatDormance` de `lib/projets.ts` ; `membresDuProjet` (déjà utilisée par `DetailProjet`) ; `formatMinutes` de `lib/retrospective.ts` ; `daysSinceLastPractice` de `lib/streaks.ts` ; `computeGoalProgress` de `lib/motivation.ts` ; `useAllPracticeEntries` de `hooks/usePracticeEntries.ts`.
- Produces: `GoalProgress({ progress })` et `GoalSetter({ onSubmit })` exportés depuis `components/Objectif.tsx`.

- [ ] **Step 1: Extraire les deux composants**

Créer `src/renderer/src/components/Objectif.tsx` et y **déplacer sans les modifier** les composants `GoalProgress` et `GoalSetter` actuellement déclarés au bas de `src/renderer/src/screens/DetailSkill.tsx`. Les exporter tous les deux. Reprendre leurs imports (`Button`, les types `GoalMetric` / `GoalPeriod`, `GoalProgress` de `lib/motivation`) et la constante `FOCUS_RING` si l'un des deux l'utilise.

En tête du fichier, expliquer pourquoi il existe :

```tsx
// Extraits de DetailSkill pour servir aussi l'écran d'un projet : les trois
// champs d'objectif vivent sur TOUT engagement, et un projet en porte un
// aussi légitimement qu'un skill. Les dupliquer aurait créé deux formulaires
// à tenir en phase, sans qu'aucun des deux écrans n'ait de raison de diverger.
```

- [ ] **Step 2: Rebrancher `DetailSkill` sur les composants extraits**

Supprimer les deux déclarations locales de `DetailSkill.tsx` et ajouter `import { GoalProgress, GoalSetter } from '../components/Objectif';`. Rien d'autre ne change dans ce fichier — la section « Objectif » les utilise déjà par ces noms.

- [ ] **Step 3: Vérifier que l'extraction n'a rien cassé**

Run: `npm test` puis `npm run typecheck`
Expected: 245 tests, typage propre. Cette étape ne change aucun comportement ; si le typecheck échoue, c'est qu'un import a été oublié dans le fichier extrait.

- [ ] **Step 4: Calculer les trois informations dans `DetailProjet`**

Ajouter les imports :

```tsx
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { entreesDuProjet, formatDormance, membresDuProjet, tempsCumuleMinutes } from '../lib/projets';
import { formatMinutes } from '../lib/retrospective';
import { daysSinceLastPractice } from '../lib/streaks';
import { computeGoalProgress } from '../lib/motivation';
import { GoalProgress, GoalSetter } from '../components/Objectif';
```

(`membresDuProjet` est déjà importée depuis `lib/projets` : compléter l'import existant plutôt que d'en ajouter un second.)

Puis, après le `useMemo` qui calcule `children` :

```tsx
  // Les identifiants sont TRIÉS : `useAllPracticeEntries` mémorise sur
  // `engagementIds.join(',')`, donc deux tableaux de même contenu dans un
  // ordre différent produisent deux clés différentes et relancent la requête
  // à chaque rendu où l'ordre change.
  const idsConcernes = useMemo(
    () => (id ? [...new Set([...children.map((c) => c.id), id])].sort() : []),
    [children, id]
  );
  const { entriesBySkill } = useAllPracticeEntries(idsConcernes);
  const entrees = useMemo(
    () => (id ? entreesDuProjet(entriesBySkill, children, id) : []),
    [entriesBySkill, children, id]
  );
  const minutes = useMemo(() => tempsCumuleMinutes(entrees), [entrees]);
  const dormance = useMemo(() => formatDormance(daysSinceLastPractice(entrees)), [entrees]);
  const objectif = useMemo(
    () =>
      project?.goalPeriod && project.goalMetric && project.goalTarget
        ? computeGoalProgress(entrees, project.goalPeriod, project.goalMetric, project.goalTarget)
        : null,
    [entrees, project]
  );

  async function handleGoalChange(patch: {
    goalPeriod: GoalPeriod | null;
    goalMetric: GoalMetric | null;
    goalTarget: number | null;
  }) {
    if (!project) return;
    setActionError(null);
    const { error: goalError } = await updateEngagement(project.id, patch);
    if (goalError) setActionError(goalError);
  }
```

Ajouter `import type { GoalMetric, GoalPeriod } from '../lib/types';`.

- [ ] **Step 5: Afficher les trois informations**

Sous le bloc d'en-tête du projet — celui qui porte `RayCorner`, le `h1` et les tags — insérer :

```tsx
      <div className="flex flex-wrap gap-8">
        <div>
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Temps cumulé</p>
          <p className="mt-1 text-corps text-champagne">{formatMinutes(minutes)}</p>
        </div>
        <div>
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Dernière activité</p>
          <p className="mt-1 text-corps text-champagne">{dormance}</p>
        </div>
      </div>

      <section className="flex flex-col gap-0">
        <h2 className="mb-1 font-data text-libelle uppercase tracking-[0.1em] text-muted">Objectif</h2>
        {objectif ? (
          <div className="flex flex-col gap-3">
            <GoalProgress progress={objectif} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => handleGoalChange({ goalPeriod: null, goalMetric: null, goalTarget: null })}
            >
              Retirer l'objectif
            </Button>
          </div>
        ) : (
          <GoalSetter onSubmit={handleGoalChange} />
        )}
      </section>
```

Ajouter `import Button from '../components/Button';` s'il n'est pas déjà importé.

`gap-8` entre les deux chiffres et `gap-3` à l'intérieur du bloc objectif : 32 px entre deux groupes, 12 px pour une grappe de contrôles. Les titres reprennent le motif de section de `Reglages.tsx` — `font-data text-libelle uppercase tracking-[0.1em] text-muted`.

- [ ] **Step 6: Vérifier tests et typage**

Run: `npm test` puis `npm run typecheck`
Expected: 245 tests (cette tâche n'en ajoute aucun), typage propre.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Objectif.tsx src/renderer/src/screens/DetailSkill.tsx src/renderer/src/screens/DetailProjet.tsx
git commit -m "feat: show a project's time, dormancy and rhythm goal"
```

---

### Task 3 : La liste

**Files:**
- Modify: `src/renderer/src/screens/ListeProjets.tsx`

**Interfaces:**
- Consumes: `membresDuProjet`, `entreesDuProjet`, `tempsCumuleMinutes`, `formatDormance` de `lib/projets.ts` ; `formatMinutes` ; `daysSinceLastPractice` ; `useAllPracticeEntries` ; `useLiaisonsProjet`.
- Produces: rien.

- [ ] **Step 1: Charger les liaisons et les entrées**

`ListeProjets` ne connaît aujourd'hui que `useEngagements`. Ajouter les imports :

```tsx
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { entreesDuProjet, formatDormance, membresDuProjet, tempsCumuleMinutes } from '../lib/projets';
import { formatMinutes } from '../lib/retrospective';
import { daysSinceLastPractice } from '../lib/streaks';
```

et, après le `useMemo` qui calcule `projects` :

```tsx
  const { liaisons } = useLiaisonsProjet();
  const membresParProjet = useMemo(
    () => new Map(projects.map((p) => [p.id, membresDuProjet(engagements, liaisons, p.id)])),
    [projects, engagements, liaisons]
  );
  // Une seule requête pour l'écran entier, et non une par projet : on réunit
  // les identifiants de tous les membres de tous les projets, plus les projets
  // eux-mêmes. Triés et dédoublonnés — `useAllPracticeEntries` mémorise sur
  // `engagementIds.join(',')`, donc un ordre instable relancerait la requête
  // à chaque rendu.
  const idsConcernes = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) {
      ids.add(p.id);
      for (const m of membresParProjet.get(p.id) ?? []) ids.add(m.id);
    }
    return [...ids].sort();
  }, [projects, membresParProjet]);
  const { entriesBySkill } = useAllPracticeEntries(idsConcernes);
```

- [ ] **Step 2: Afficher les deux informations par ligne**

Précalculer la ligne de chaque projet dans un `useMemo`, à la suite de l'étape précédente. **Surtout pas de calcul dans le JSX** : la contrainte globale de cette tranche est que tout ce qui peut être faux vive dans une fonction pure, et un `reduce` glissé dans un `map` de rendu échappe à la fois au test et à la relecture.

```tsx
  const resumeParProjet = useMemo(() => {
    const resume = new Map<string, string>();
    for (const p of projects) {
      const entrees = entreesDuProjet(entriesBySkill, membresParProjet.get(p.id) ?? [], p.id);
      resume.set(
        p.id,
        `${formatMinutes(tempsCumuleMinutes(entrees))} · ${formatDormance(daysSinceLastPractice(entrees))}`
      );
    }
    return resume;
  }, [projects, membresParProjet, entriesBySkill]);
```

Puis, dans le `projects.map(...)`, sous le bloc qui porte le nom et les tags :

```tsx
              <p className="mt-1 text-secondaire text-muted">{resumeParProjet.get(project.id)}</p>
```

Le point médian sépare deux informations de même rang, comme le fait déjà la ligne de tags. `text-secondaire` et `mt-1` reprennent exactement le traitement des tags juste au-dessus, pour que les deux lignes secondaires se lisent au même niveau.

- [ ] **Step 3: Vérifier tests et typage**

Run: `npm test` puis `npm run typecheck`
Expected: 245 tests, typage propre.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/ListeProjets.tsx
git commit -m "feat: show time and dormancy on each project row"
```

---

### Task 4 : Vérification finale

**Files:** aucun, sauf correctifs issus des constats.

- [ ] **Step 1: Énumérer les classes introduites par le diff**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "\b(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9./]+" | sort -u`

Vérifier que l'ensemble obtenu est **inclus** dans les six rôles et les sept crans. Lister ce qui existe puis contrôler l'inclusion, jamais l'inverse. `tracking-[0.1em]` est un interlettrage, hors des deux échelles, et préexiste au chantier.

- [ ] **Step 2: Suite complète et typage**

Run: `npm test`
Expected: **245 tests, 17 fichiers.** Un total doublé signifie qu'un worktree traîne.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Merge local dans master**

`preview_start` lit le `launch.json` du dépôt racine et sert toujours `master`, jamais le worktree, silencieusement. La vérification live n'a donc de sens qu'après le merge local.

- [ ] **Step 4: Vérification live**

1. **Un projet avec plusieurs membres** — le temps cumulé vaut bien la somme des entrées de tous ses membres.
2. **Un skill partagé entre deux projets** — son temps apparaît **dans les deux**, et non dans un seul. C'est le cas qui justifie tout le modèle du chantier A.
3. **Un projet sans aucune activité** — « Aucune activité », pas « Aujourd'hui » ni un tiret vide.
4. **Une entrée posée sur le projet lui-même** — elle compte dans son propre total. Se produit en enregistrant une entrée de pratique directement sur le projet.
5. **Un objectif posé puis retiré** — la barre apparaît avec son libellé, « Retirer l'objectif » la fait disparaître et rend le formulaire.
6. **La liste** — chaque ligne porte le temps et la dormance, et l'écran ne fait **qu'une** requête d'entrées de pratique, vérifiable dans l'onglet réseau.
7. **L'écran d'un skill** — sa section Objectif fonctionne exactement comme avant l'extraction.

- [ ] **Step 5: Push, seulement si tout est passé**

Ne pas enchaîner en proposant une release.

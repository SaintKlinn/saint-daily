# Projets : jalons, avancement et tri — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au projet ses jalons et sa part franchie, puis rendre la liste des projets triable sur l'avancement, le temps, la dormance et le nom.

**Architecture:** Deux fonctions pures s'ajoutent à `lib/projets.ts`. Les jalons existent déjà — `engagement_milestone` est clé sur `engagement_id` et un projet est un engagement — donc aucune migration. Les deux listes de jalons divergentes de l'application fusionnent en un seul composant avant d'en servir un troisième écran, et la liste des projets gagne une lecture groupée des jalons calquée sur `useAllPracticeEntries`.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Supabase (PostgREST), react-router-dom (HashRouter), motion/react, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-projets-jalons-avancement-tri-design.md`

## Global Constraints

- **Aucune migration de base, aucune colonne nouvelle.** `engagement_milestone` porte déjà `engagement_id`, et un projet est un engagement.
- **Toute la logique dérivée vit dans `lib/projets.ts`, en fonctions pures.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où ce calcul peut être vérifié. Un tri fait dans un écran est un tri invérifiable.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px. Aucune valeur arbitraire.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet, et hors la géométrie de la case à cocher, exception déjà écrite et commentée dans le dépôt (voir tâche 2).
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 244 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.
- **Le verrou de génération** est obligatoire sur tout hook dont la valeur fermée peut changer pendant qu'une requête est en vol. Voir tâche 3.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/lib/projets.ts` | **modifié** — `avancementProjet` et `trierProjets` s'ajoutent aux sept fonctions existantes |
| `src/renderer/src/lib/projets.test.ts` | **modifié** — leurs tests |
| `src/renderer/src/components/MilestoneChecklist.tsx` | **modifié** — une seule liste de jalons pour trois écrans : sa célébration à l'intérieur, deux tailles, plus de titre |
| `src/renderer/src/screens/DetailSkill.tsx` | **modifié** — consomme le composant ; perd sa liste inline, son `NewMilestoneForm` dupliqué et son état de célébration |
| `src/renderer/src/components/TaskPopover.tsx` | **modifié** — rend son propre titre « Sous-tâches » |
| `src/renderer/src/screens/Focus.tsx` | **modifié** — rend son propre titre ; `onToggle` rend `{ error }` |
| `src/renderer/src/hooks/useMilestones.ts` | **modifié** — verrou de génération, puis `useAllMilestones` |
| `src/renderer/src/screens/DetailProjet.tsx` | **modifié** — section « Jalons » et barre d'avancement |
| `src/renderer/src/screens/ListeProjets.tsx` | **modifié** — avancement par ligne et sélecteur de tri |

## Décision d'architecture : le composant unifié ne rend pas son titre

La spec (§2) demande de consolider les deux listes de jalons. En mesurant, elles divergent sur **six** points, pas un :

| | `MilestoneChecklist` (actuel) | inline dans `DetailSkill` |
|---|---|---|
| Titre | `<p className="text-libelle uppercase tracking-[0.04em] text-muted">Sous-tâches</p>` | `<h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Jalons</h2>` dans un `<section>` |
| Case | `h-[16px] w-[16px]` | `h-[18px] w-[18px]` |
| Marge négative | `-ml-[24px]` | `-ml-[25px]` |
| `CheckIcon` | `size={10}` | `size={11}` |
| Écart libellé | `gap-2` | `gap-3` |
| Célébration | absente | `motion.span`, plus un état, un timeout et son nettoyage |

**Le titre sort du composant.** Une étiquette de champ dans un popover et un titre de section de page ne sont pas la même chose, et les paramétrer reviendrait à déplacer la divergence dans une prop. L'appelant rend son propre titre, dans le style de son contexte ; le composant rend l'erreur, la liste et le formulaire d'ajout. C'est la seule des six divergences qui **disparaît** au lieu d'être absorbée.

**La taille devient un préréglage à deux valeurs.** Les quatre valeurs géométriques sont couplées — la marge négative vaut −(rembourrage du `<ul>` + moitié de la case) — et le dépôt s'est déjà trompé une fois en en changeant une sans l'autre. Les écrire ensemble, une seule fois, est l'amélioration ; imposer une taille unique changerait la géométrie de `TaskPopover` et `Focus` au-delà de ce que la spec autorise.

**La célébration entre dans le composant** et y apporte son propre état. C'est ce qui justifie l'opération : `DetailSkill` — 682 lignes — perd `celebratingMilestoneId`, `celebrationTimeoutRef` et son `useEffect` de nettoyage.

---

### Task 1 : Les deux fonctions dérivées

**Files:**
- Modify: `src/renderer/src/lib/projets.ts`
- Modify: `src/renderer/src/lib/projets.test.ts`

**Interfaces:**
- Consumes: rien. Ce fichier n'importe que `Engagement` et `LiaisonProjet` de `lib/types.ts`, déjà en place.
- Produces:
  - `export type CritereTri = 'dormance' | 'temps' | 'avancement' | 'nom'`
  - `export interface LigneProjet { id: string; nom: string; minutes: number; jours: number | null; avancement: number | null }`
  - `avancementProjet(jalons: { completedAt: string | null }[]): { franchis: number; total: number; ratio: number }`
  - `trierProjets(lignes: LigneProjet[], critere: CritereTri): LigneProjet[]`

**Aucun écran n'est modifié par cette tâche.**

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `src/renderer/src/lib/projets.test.ts`, et compléter l'import de la deuxième ligne pour inclure `avancementProjet` et `trierProjets` :

```ts
describe('avancementProjet', () => {
  it('rend un total nul sur une liste vide, sans diviser par zéro', () => {
    // `total: 0` est le signal que l'écran lit pour ne rien afficher du
    // tout : « 0 sur 0 » dirait faussement qu'un chantier sans jalon n'a
    // pas avancé, alors qu'il n'a rien à mesurer.
    expect(avancementProjet([])).toEqual({ franchis: 0, total: 0, ratio: 0 });
  });

  it('compte zéro franchi sur trois', () => {
    const jalons = [{ completedAt: null }, { completedAt: null }, { completedAt: null }];
    expect(avancementProjet(jalons)).toEqual({ franchis: 0, total: 3, ratio: 0 });
  });

  it('compte trois franchis sur trois', () => {
    const jalons = [
      { completedAt: '2026-09-01T10:00:00Z' },
      { completedAt: '2026-09-02T10:00:00Z' },
      { completedAt: '2026-09-03T10:00:00Z' },
    ];
    expect(avancementProjet(jalons)).toEqual({ franchis: 3, total: 3, ratio: 1 });
  });

  it('rend la fraction brute, sans arrondir', () => {
    // L'arrondi appartient à l'affichage. La fonction qui rend 0.333… ne
    // doit pas décider à la place de la barre ni du libellé.
    const jalons = [{ completedAt: '2026-09-01T10:00:00Z' }, { completedAt: null }, { completedAt: null }];
    const { ratio } = avancementProjet(jalons);
    expect(ratio).toBeCloseTo(1 / 3, 10);
  });
});

describe('trierProjets', () => {
  function uneLigne(partiel: Partial<LigneProjet> & { id: string }): LigneProjet {
    return { nom: partiel.id, minutes: 0, jours: null, avancement: null, ...partiel };
  }

  it('met le plus dormant en haut', () => {
    const lignes = [
      uneLigne({ id: 'recent', jours: 2 }),
      uneLigne({ id: 'oublie', jours: 40 }),
      uneLigne({ id: 'moyen', jours: 10 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['oublie', 'moyen', 'recent']);
  });

  it('met le plus investi en haut', () => {
    const lignes = [
      uneLigne({ id: 'petit', minutes: 30 }),
      uneLigne({ id: 'gros', minutes: 600 }),
      uneLigne({ id: 'moyen', minutes: 120 }),
    ];
    expect(trierProjets(lignes, 'temps').map((l) => l.id)).toEqual(['gros', 'moyen', 'petit']);
  });

  it('met le moins avancé en haut', () => {
    const lignes = [
      uneLigne({ id: 'presque', avancement: 0.9 }),
      uneLigne({ id: 'debut', avancement: 0.1 }),
      uneLigne({ id: 'moitie', avancement: 0.5 }),
    ];
    expect(trierProjets(lignes, 'avancement').map((l) => l.id)).toEqual(['debut', 'moitie', 'presque']);
  });

  it('trie par nom en tenant compte des accents', () => {
    // `localeCompare` en français, sinon « Élagage » passerait après
    // « Zinguerie » parce que son point de code est plus haut.
    const lignes = [uneLigne({ id: 'z', nom: 'Zinguerie' }), uneLigne({ id: 'e', nom: 'Élagage' }), uneLigne({ id: 'a', nom: 'Atelier' })];
    expect(trierProjets(lignes, 'nom').map((l) => l.id)).toEqual(['a', 'e', 'z']);
  });

  it('range les projets sans aucune activité en bas, pas en tête', () => {
    // LA règle de cette tranche. Un chantier jamais commencé n'est pas le
    // plus négligé — il n'a pas commencé — et le mettre en tête
    // enterrerait sous lui le chantier réellement abandonné, c'est-à-dire
    // le signal que tout ce tri existe pour montrer.
    const lignes = [
      uneLigne({ id: 'jamais', jours: null }),
      uneLigne({ id: 'oublie', jours: 40 }),
      uneLigne({ id: 'recent', jours: 2 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['oublie', 'recent', 'jamais']);
  });

  it('range les projets sans aucun jalon en bas', () => {
    const lignes = [
      uneLigne({ id: 'sansJalon', avancement: null }),
      uneLigne({ id: 'presque', avancement: 0.9 }),
      uneLigne({ id: 'debut', avancement: 0.1 }),
    ];
    expect(trierProjets(lignes, 'avancement').map((l) => l.id)).toEqual(['debut', 'presque', 'sansJalon']);
  });

  it('garde l’ordre d’origine entre deux valeurs égales', () => {
    // Sans stabilité, deux rendus successifs échangeraient deux lignes
    // sans qu’aucune donnée n’ait bougé.
    const lignes = [
      uneLigne({ id: 'premier', jours: 5 }),
      uneLigne({ id: 'second', jours: 5 }),
      uneLigne({ id: 'troisieme', jours: 5 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['premier', 'second', 'troisieme']);
  });

  it('ne modifie pas le tableau qu’on lui passe', () => {
    // L’appelant passe le résultat d’un `useMemo` dont React réutilise
    // l’identité : le muter ferait diverger l’affichage de l’état.
    const lignes = [uneLigne({ id: 'b', jours: 1 }), uneLigne({ id: 'a', jours: 9 })];
    trierProjets(lignes, 'dormance');
    expect(lignes.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('ne jette pas sur une liste vide', () => {
    expect(trierProjets([], 'dormance')).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: FAIL — `avancementProjet` et `trierProjets` n'existent pas encore. La cause doit être « n'est pas une fonction » ou un échec d'import, pas une assertion.

- [ ] **Step 3: Écrire les deux fonctions**

Ajouter à la fin de `src/renderer/src/lib/projets.ts` :

```ts
/**
 * La part franchie des jalons d'un projet.
 *
 * Ce sont les jalons du projet LUI-MÊME, jamais ceux de ses skills
 * membres. Les deux ne parlent pas de la même chose : les jalons d'un
 * chantier sont ses livrables (« fondations », « murs »), ceux d'un skill
 * sont des étapes d'apprentissage (« maîtriser l'assemblage à queue
 * d'aronde »). Les additionner donnerait un pourcentage vide de sens, où
 * cocher une étape de menuiserie ferait « avancer la maison ».
 *
 * C'est une asymétrie assumée avec `tempsCumuleMinutes`, qui lui agrège
 * les membres : le temps passé sur la menuiserie EST du temps passé sur la
 * maison, alors qu'une étape d'apprentissage n'est PAS un livrable. Écrit
 * ici pour qu'une relecture ne « corrige » pas l'asymétrie en croyant
 * réparer un oubli.
 *
 * `total: 0` est le signal rendu à l'appelant : c'est à lui de n'afficher
 * ni barre ni libellé plutôt qu'un « 0 sur 0 », qui dirait à tort qu'un
 * chantier sans jalon n'a pas avancé.
 */
export function avancementProjet(jalons: { completedAt: string | null }[]): {
  franchis: number;
  total: number;
  ratio: number;
} {
  const total = jalons.length;
  const franchis = jalons.filter((j) => j.completedAt !== null).length;
  return { franchis, total, ratio: total === 0 ? 0 : franchis / total };
}

/** Le critère de tri de la liste des projets. Chacun a un sens unique. */
export type CritereTri = 'dormance' | 'temps' | 'avancement' | 'nom';

/**
 * Une ligne de la liste des projets, réduite à ce sur quoi on trie.
 *
 * Le tri reçoit des valeurs DÉJÀ dérivées, jamais des engagements : c'est
 * ce qui le rend vérifiable sans réseau. `avancement` vaut `null` quand le
 * projet n'a aucun jalon — la traduction depuis `avancementProjet` se fait
 * chez l'appelant, avec `total === 0 ? null : ratio`.
 */
export interface LigneProjet {
  id: string;
  nom: string;
  minutes: number;
  jours: number | null;
  avancement: number | null;
}

export function trierProjets(lignes: LigneProjet[], critere: CritereTri): LigneProjet[] {
  // Les valeurs absentes descendent, quel que soit le critère. Un chantier
  // jamais commencé n'est pas le plus négligé, et le mettre en tête
  // enterrerait sous lui celui qui l'est vraiment — le signal que ce tri
  // existe pour montrer.
  const absentEnBas = (
    a: number | null,
    b: number | null,
    comparer: (x: number, y: number) => number
  ): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return comparer(a, b);
  };
  const decroissant = (x: number, y: number) => y - x;
  const croissant = (x: number, y: number) => x - y;

  // `sort` mute son receveur : on copie, parce que l'appelant passe le
  // résultat d'un `useMemo` dont React réutilise l'identité.
  return [...lignes].sort((a, b) => {
    switch (critere) {
      case 'dormance':
        return absentEnBas(a.jours, b.jours, decroissant);
      case 'temps':
        // `minutes` n'est jamais nul : zéro minute est une valeur, pas une
        // absence, et l'ordre décroissant la range déjà en bas.
        return decroissant(a.minutes, b.minutes);
      case 'avancement':
        return absentEnBas(a.avancement, b.avancement, croissant);
      case 'nom':
        // En français : sans la locale, « Élagage » passerait après
        // « Zinguerie », son point de code étant plus haut.
        return a.nom.localeCompare(b.nom, 'fr');
    }
  });
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx vitest run src/renderer/src/lib/projets.test.ts`
Expected: PASS — les 28 tests existants plus 13 nouveaux, soit **41** dans ce fichier.

- [ ] **Step 5: Suite complète et typage**

Run: `npx vitest run`
Expected: PASS — 244 + 13 = **257 tests**, 17 fichiers.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/projets.ts src/renderer/src/lib/projets.test.ts
git commit -m "feat: derive a project's milestone progress and sort its list"
```

---

### Task 2 : La liste de jalons unifiée

**Files:**
- Modify: `src/renderer/src/components/MilestoneChecklist.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`
- Modify: `src/renderer/src/components/TaskPopover.tsx`
- Modify: `src/renderer/src/screens/Focus.tsx`

**Interfaces:**
- Consumes: `EngagementMilestone` de `lib/types.ts` ; `CheckIcon` de `components/icons` ; `Button` de `components/Button` ; `motion` de `motion/react`.
- Produces: `MilestoneChecklist` en export par défaut, avec la signature
  `{ milestones: EngagementMilestone[]; onToggle: (id: string, completed: boolean) => Promise<{ error: string | null }>; onAdd: (label: string) => Promise<{ error: string | null }>; error: string | null; taille?: 'compacte' | 'normale' }`.
  Le composant ne rend **aucun titre** : l'appelant rend le sien.

**Aucun comportement nouveau dans cette tâche, hors la célébration qui arrive sur `TaskPopover` et `Focus`.**

- [ ] **Step 1: Réécrire le composant**

Remplacer tout le contenu de `src/renderer/src/components/MilestoneChecklist.tsx` par :

```tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { EngagementMilestone } from '../lib/types';
import { CheckIcon } from './icons';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// La géométrie de la case est une exception assumée aux sept crans
// d'espacement, au même titre que le `gap-10` du rail : ce n'est pas un
// rythme, c'est une dérivation. La marge négative vaut −(rembourrage du
// `<ul>` + moitié de la case) et centre la case sur le trait vertical ;
// les quatre valeurs d'un préréglage bougent donc ENSEMBLE. Le dépôt s'est
// déjà trompé en changeant le rembourrage sans la marge, et la case s'est
// décalée de 2 px. Les réunir ici est la raison d'être de ce préréglage.
const TAILLES = {
  compacte: { case: 'h-[16px] w-[16px]', marge: '-ml-[24px]', icone: 10, ecart: 'gap-2' },
  normale: { case: 'h-[18px] w-[18px]', marge: '-ml-[25px]', icone: 11, ecart: 'gap-3' },
} as const;

/**
 * La liste de jalons de l'application — une seule, pour les trois écrans
 * qui en portent une.
 *
 * Elle ne rend pas de titre : une étiquette de champ dans un popover et un
 * titre de section de page ne sont pas la même chose, et les paramétrer
 * aurait déplacé la divergence dans une prop au lieu de la supprimer.
 * L'appelant rend le sien, dans le style de son contexte.
 *
 * La célébration vit ici, avec son état : le composant sait de lui-même à
 * quel instant une case passe à cochée, et la lui confier a retiré de
 * `DetailSkill` un état, un timeout et son nettoyage au démontage.
 */
export default function MilestoneChecklist({
  milestones,
  onToggle,
  onAdd,
  error,
  taille = 'compacte',
}: {
  milestones: EngagementMilestone[];
  onToggle: (id: string, completed: boolean) => Promise<{ error: string | null }>;
  onAdd: (label: string) => Promise<{ error: string | null }>;
  error: string | null;
  taille?: keyof typeof TAILLES;
}) {
  const t = TAILLES[taille];
  const [celebre, setCelebre] = useState<string | null>(null);
  // Posé dans un gestionnaire d'événement, pas dans un effet : aucune
  // fonction de nettoyage n'est rendue là. On garde donc l'id du timeout
  // pour pouvoir l'annuler, au démontage pendant la pulsation comme
  // lorsque deux jalons sont cochés coup sur coup.
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function basculer(id: string, completed: boolean) {
    const { error: toggleError } = await onToggle(id, completed);
    // On ne célèbre que ce qui a réellement été écrit, et jamais un
    // décochage.
    if (toggleError || !completed) return;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setCelebre(id);
    timeoutRef.current = window.setTimeout(() => {
      setCelebre((actuel) => (actuel === id ? null : actuel));
      timeoutRef.current = null;
    }, 400);
  }

  return (
    <div className="relative flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-0 border-l border-ink-700 pl-4">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center py-2">
              <label className={`flex cursor-pointer items-center ${t.ecart}`}>
                <span className={`relative ${t.marge} ${t.case} flex shrink-0 items-center justify-center`}>
                  <input
                    type="checkbox"
                    checked={!!m.completedAt}
                    onChange={(e) => basculer(m.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                  >
                    {m.completedAt && <CheckIcon size={t.icone} />}
                  </span>
                  {celebre === m.id && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-accent-bright"
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 2.2 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </span>
                <span className={`text-corps ${m.completedAt ? 'text-muted line-through' : 'text-champagne'}`}>
                  {m.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <NewMilestoneForm onAdd={onAdd} />
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        setSubmitting(true);
        setError(null);
        const { error: addError } = await onAdd(label);
        setSubmitting(false);
        if (addError) {
          setError(addError);
          return;
        }
        input.value = '';
      }}
      className="mt-1 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          name="label"
          aria-label="Nouveau jalon"
          placeholder="Nouveau jalon"
          disabled={submitting}
          className={`flex-1 border border-ink-700 bg-ink-900 px-3 py-1 text-secondaire text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
```

Le champ d'ajout dit désormais « Nouveau jalon » partout, y compris dans son `aria-label` : c'est le libellé de `DetailSkill`, et « jalon » couvre les trois écrans là où « sous-tâche » ne conviendrait pas à un projet.

- [ ] **Step 2: Rendre son titre dans `TaskPopover`**

Dans `src/renderer/src/components/TaskPopover.tsx`, l'appel à `MilestoneChecklist` (vers la ligne 113) perd son titre implicite. L'envelopper :

```tsx
        <div className="relative flex flex-col gap-2">
          <p className="text-libelle uppercase tracking-[0.04em] text-muted">Sous-tâches</p>
          <MilestoneChecklist
            milestones={milestones}
            onToggle={toggleMilestone}
            onAdd={addMilestone}
            error={milestonesError}
          />
        </div>
```

`toggleMilestone` vient de `useMilestones` et rend déjà `{ error: string | null }` : rien d'autre à changer ici. La taille reste `compacte`, le défaut.

- [ ] **Step 3: Rendre son titre dans `Focus`, et rendre l'erreur depuis `onToggle`**

Dans `src/renderer/src/screens/Focus.tsx`, `handleToggleMilestone` (ligne 91) ne rend rien aujourd'hui ; le composant a besoin du résultat pour ne pas célébrer une écriture ratée. Ajouter la ligne de retour, exactement comme `handleAddMilestone` juste au-dessus le fait déjà :

```tsx
  async function handleToggleMilestone(id: string, completed: boolean) {
    setActionError(null);
    const { error: toggleError } = await toggleMilestone(id, completed);
    if (toggleError) setActionError(toggleError);
    return { error: toggleError };
  }
```

Puis envelopper l'appel (vers la ligne 142) :

```tsx
        <div className="flex flex-col gap-2">
          <p className="text-libelle uppercase tracking-[0.04em] text-muted">Sous-tâches</p>
          <MilestoneChecklist
            milestones={milestones}
            onToggle={handleToggleMilestone}
            onAdd={handleAddMilestone}
            error={milestonesError ?? actionError}
          />
        </div>
```

- [ ] **Step 4: Brancher `DetailSkill` sur le composant**

Dans `src/renderer/src/screens/DetailSkill.tsx` :

1. Ajouter `import MilestoneChecklist from '../components/MilestoneChecklist';`
2. **Supprimer** l'état `celebratingMilestoneId` et `celebrationTimeoutRef` (vers les lignes 77 et 83), ainsi que le `useEffect` de nettoyage du timeout de célébration (vers les lignes 107-113). Ne pas toucher à `streakPulse` ni à son effet, qui sont un autre mécanisme.
3. Réduire `handleToggleMilestone` (ligne 186) à ce qui reste, en lui faisant rendre l'erreur :

```tsx
  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    setActionError(null);
    const { error } = await toggleMilestone(milestoneId, completed);
    if (error) setActionError(error);
    return { error };
  }
```

4. Remplacer le corps de la section « Jalons » (le `<ul>` des lignes 392-442 et le `<NewMilestoneForm onAdd={addMilestone} />` qui le suit) par l'appel au composant, en gardant le `h2` et en laissant le composant porter l'erreur :

```tsx
          <section>
            <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Jalons</h2>
            <MilestoneChecklist
              milestones={milestones}
              onToggle={handleToggleMilestone}
              onAdd={addMilestone}
              error={milestonesError}
              taille="normale"
            />
          </section>
```

5. **Supprimer** la déclaration locale de `NewMilestoneForm` (vers la ligne 556) — le composant a la sienne.
6. Nettoyer les imports devenus inutiles. Attention : `CheckIcon` et `motion` peuvent servir ailleurs dans ce fichier (`streakPulse` utilise `motion`) ; ne retirer que ce qui n'a plus aucun usage, et laisser `npm run typecheck` trancher.

- [ ] **Step 5: Vérifier que rien n'a bougé**

Run: `npx vitest run`
Expected: PASS — **257 tests**, 17 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre. Un échec ici désigne presque sûrement un import oublié à l'étape 4.6, ou un `onToggle` qui ne rend pas `{ error }`.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/MilestoneChecklist.tsx src/renderer/src/components/TaskPopover.tsx src/renderer/src/screens/Focus.tsx src/renderer/src/screens/DetailSkill.tsx
git commit -m "refactor: merge the two milestone lists into one component"
```

---

### Task 3 : Les jalons du projet

**Files:**
- Modify: `src/renderer/src/hooks/useMilestones.ts`
- Modify: `src/renderer/src/screens/DetailProjet.tsx`

**Interfaces:**
- Consumes: `avancementProjet` de `lib/projets.ts` (tâche 1) ; `MilestoneChecklist` de `components/MilestoneChecklist` avec `taille="normale"` et `onToggle` rendant `{ error: string | null }` (tâche 2) ; `useMilestones` de `hooks/useMilestones` ; `BarreProgression` de `components/BarreProgression`.
- Produces: rien de nouveau pour les tâches suivantes.

- [ ] **Step 1: Poser le verrou de génération sur `useMilestones`**

`useMilestones` porte le même défaut que `useAllPracticeEntries` avant le correctif du 27 septembre : son `refresh` est un `useCallback` sur `[engagementId]`, et quand cet identifiant change — navigation d'une fiche de skill à une autre, même route `skills/:id`, sans démontage — la requête précédente reste en vol et peut se résoudre **après** la nouvelle, écrasant la bonne liste par l'ancienne. Rien ne vient ensuite corriger l'affichage.

Dans `src/renderer/src/hooks/useMilestones.ts` : ajouter `useRef` à l'import de React, déclarer le compteur dans le hook, l'incrémenter en tête de `refresh` — **avant** la sortie anticipée sur `!engagementId`, pour qu'un vidage périme aussi ce qui est en vol — et rendre la fonction sans toucher à l'état si la génération a bougé pendant l'attente :

```ts
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
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
    // Appel périmé : une génération plus récente a démarré pendant
    // l'attente ci-dessus (nouvel `engagementId`), son résultat est déjà
    // affiché ou en cours. Une réponse arrivée en retard ne doit pas
    // l'écraser — rien ne viendrait corriger ensuite.
    if (generation !== generationRef.current) return;
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setMilestones((data as MilestoneRow[]).map(fromRow));
    }
    setLoading(false);
  }, [engagementId]);
```

- [ ] **Step 2: Calculer l'avancement dans `DetailProjet`**

Dans `src/renderer/src/screens/DetailProjet.tsx`, ajouter les imports :

```tsx
import { useMilestones } from '../hooks/useMilestones';
import MilestoneChecklist from '../components/MilestoneChecklist';
import BarreProgression from '../components/BarreProgression';
```

et compléter l'import existant de `../lib/projets` pour inclure `avancementProjet` — ce fichier en importe déjà plusieurs, compléter plutôt qu'ajouter une seconde ligne.

Après le `useMemo` qui calcule `objectif` :

```tsx
  const { milestones, error: jalonsError, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const avancement = useMemo(() => avancementProjet(milestones), [milestones]);

  async function handleToggleJalon(jalonId: string, completed: boolean) {
    setActionError(null);
    const { error: toggleError } = await toggleMilestone(jalonId, completed);
    if (toggleError) setActionError(toggleError);
    return { error: toggleError };
  }
```

- [ ] **Step 3: Afficher la section**

Sous la section « Objectif » et avant le bloc du bouton de suppression, insérer :

```tsx
      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Jalons</h2>
        <MilestoneChecklist
          milestones={milestones}
          onToggle={handleToggleJalon}
          onAdd={addMilestone}
          error={jalonsError}
          taille="normale"
        />
        {avancement.total > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Avancement</span>
              <span className="font-data text-libelle tabular-nums text-champagne">
                {avancement.franchis} jalon{avancement.franchis > 1 ? 's' : ''} sur {avancement.total}
              </span>
            </div>
            <BarreProgression
              ratio={avancement.ratio}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={avancement.total}
              aria-valuenow={avancement.franchis}
              aria-label="Avancement du projet"
            />
          </div>
        )}
      </section>
```

La forme — libellé à gauche, mesure à droite, rail dessous — est celle de `GoalProgress` juste au-dessus, pour que les deux proportions de l'écran se lisent pareil. `avancement.total > 0` porte la règle du §1 de la spec : pas de « 0 sur 0 » sur un chantier qui n'a rien à mesurer.

- [ ] **Step 4: Vérifier tests et typage**

Run: `npx vitest run`
Expected: PASS — **257 tests**, 17 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hooks/useMilestones.ts src/renderer/src/screens/DetailProjet.tsx
git commit -m "feat: show a project's milestones and its progress"
```

---

### Task 4 : La liste

**Files:**
- Modify: `src/renderer/src/hooks/useMilestones.ts`
- Modify: `src/renderer/src/screens/ListeProjets.tsx`

**Interfaces:**
- Consumes: `avancementProjet`, `trierProjets`, `CritereTri`, `LigneProjet`, `membresDuProjet`, `entreesDuProjet`, `tempsCumuleMinutes`, `formatDormance` de `lib/projets.ts` ; `formatMinutes` de `lib/retrospective.ts` ; `daysSinceLastPractice` de `lib/streaks.ts` ; `useAllPracticeEntries` et `useLiaisonsProjet`, déjà utilisés par cet écran.
- Produces: `useAllMilestones(engagementIds: string[])` dans `hooks/useMilestones.ts`, rendant `{ milestonesByEngagement: Record<string, EngagementMilestone[]>, loading: boolean, error: string | null, refresh: () => Promise<void> }`.

- [ ] **Step 1: Écrire `useAllMilestones`**

Ajouter à la fin de `src/renderer/src/hooks/useMilestones.ts`, calqué sur `useAllPracticeEntries` de `hooks/usePracticeEntries.ts` — le lire avant d'écrire, notamment pour `fetchAllPages` et la mémoïsation sur la clé jointe :

```ts
/**
 * Les jalons de plusieurs engagements en une seule requête paginée —
 * utilisé par la liste des projets pour calculer l'avancement de chaque
 * ligne sans une requête par projet.
 *
 * L'appelant passe des identifiants TRIÉS et DÉDOUBLONNÉS : la
 * mémoïsation se fait sur `engagementIds.join(',')`, donc deux tableaux de
 * même contenu dans un ordre différent produiraient deux clés différentes
 * et relanceraient la requête à chaque rendu où l'ordre change.
 */
export function useAllMilestones(engagementIds: string[]) {
  const [milestonesByEngagement, setMilestonesByEngagement] = useState<Record<string, EngagementMilestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = engagementIds.join(',');
  // Même verrou de génération que `useMilestones` ci-dessus : quand la
  // liste d'ids change, la requête précédente reste en vol et pourrait,
  // en se résolvant après coup, écraser un résultat plus complet.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (engagementIds.length === 0) {
      setMilestonesByEngagement({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { rows, error: fetchError } = await fetchAllPages<MilestoneRow>((from, to) =>
      getSupabaseClient()
        .from('engagement_milestone')
        .select('*')
        .in('engagement_id', engagementIds)
        // Une lecture paginée a besoin d'un ordre total : `position` n'est
        // unique qu'au sein d'un engagement, donc `id` départage pour que
        // chaque ligne apparaisse exactement une fois quel que soit le
        // plan d'exécution.
        .order('position', { ascending: true })
        .order('id')
        .range(from, to)
    );
    if (generation !== generationRef.current) return;
    setError(fetchError);
    const parEngagement: Record<string, EngagementMilestone[]> = {};
    for (const row of rows) {
      const jalon = fromRow(row);
      (parEngagement[jalon.engagementId] ??= []).push(jalon);
    }
    setMilestonesByEngagement(parEngagement);
    setLoading(false);
    // `key` est la vraie dépendance : évite de recréer cette fonction, et
    // donc de re-déclencher l'effet, à chaque nouvelle identité de tableau
    // sans changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { milestonesByEngagement, loading, error, refresh };
}
```

`fetchAllPages` n'est pas importé dans ce fichier. Il est exporté par `hooks/usePracticeEntries.ts`, qui est dans le même dossier, donc :

```ts
import { fetchAllPages } from './usePracticeEntries';
```

(`lib/exportData.ts` et `hooks/useDailyReflections.ts` l'importent déjà de là.) Ajouter aussi `useRef` à l'import de React s'il n'y est pas — `useCallback`, `useEffect` et `useState` y sont déjà pour `useMilestones`.

- [ ] **Step 2: Calculer les lignes dans `ListeProjets`**

Dans `src/renderer/src/screens/ListeProjets.tsx`, ajouter :

```tsx
import { useState } from 'react';
import { useAllMilestones } from '../hooks/useMilestones';
```

(`useState` peut déjà être importé ; compléter l'import existant de `react` plutôt qu'en ajouter un second.) Compléter l'import de `../lib/projets` pour inclure `avancementProjet`, `trierProjets` et le type `CritereTri`.

Après le `useMemo` qui calcule `idsConcernes`, remplacer le `useMemo` `resumeParProjet` par le calcul des lignes, puis leur tri :

```tsx
  const { milestonesByEngagement } = useAllMilestones(idsConcernes);
  const [critere, setCritere] = useState<CritereTri>('dormance');

  const lignes = useMemo(() => {
    return projects.map((p) => {
      const entrees = entreesDuProjet(entriesBySkill, membresParProjet.get(p.id) ?? [], p.id);
      // L'avancement ne compte QUE les jalons du projet lui-même, jamais
      // ceux de ses membres : ce sont des livrables, pas des étapes
      // d'apprentissage. Voir `avancementProjet`.
      const { total, ratio } = avancementProjet(milestonesByEngagement[p.id] ?? []);
      return {
        id: p.id,
        nom: p.name,
        minutes: tempsCumuleMinutes(entrees),
        jours: daysSinceLastPractice(entrees),
        // `null` dit « aucun jalon », que le tri range en bas ; `0` dirait
        // « aucun jalon franchi », qui est autre chose.
        avancement: total === 0 ? null : ratio,
      };
    });
  }, [projects, membresParProjet, entriesBySkill, milestonesByEngagement]);

  const lignesTriees = useMemo(() => trierProjets(lignes, critere), [lignes, critere]);
  const franchisParProjet = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      const { franchis, total } = avancementProjet(milestonesByEngagement[p.id] ?? []);
      if (total > 0) m.set(p.id, `${franchis}/${total}`);
    }
    return m;
  }, [projects, milestonesByEngagement]);
```

`idsConcernes` réunit déjà les membres de tous les projets **plus les projets eux-mêmes**, triés et dédoublonnés : c'est exactement ce dont `useAllMilestones` a besoin, et on ne recalcule pas une seconde liste. Les jalons des membres sont ramenés sans être utilisés — c'est le prix d'une requête unique, et il est plus faible que celui d'une seconde requête pour le seul sous-ensemble des projets.

- [ ] **Step 3: Rendre le sélecteur et les lignes triées**

Dans l'en-tête, à côté du lien « + Nouveau projet » :

```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-titre-ecran text-champagne">Projets</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-libelle uppercase tracking-[0.04em] text-muted">
            Trier par
            <select
              value={critere}
              onChange={(e) => setCritere(e.target.value as CritereTri)}
              aria-label="Critère de tri des projets"
              className={`border border-ink-700 bg-ink-800 px-3 py-2 font-sans normal-case tracking-normal text-corps text-champagne ${FOCUS_RING}`}
            >
              <option value="dormance">Dernière activité</option>
              <option value="temps">Temps cumulé</option>
              <option value="avancement">Avancement</option>
              <option value="nom">Nom</option>
            </select>
          </label>
          <Link to="/projets/nouveau" className={buttonClassName('primary')}>
            + Nouveau projet
          </Link>
        </div>
      </div>
```

`FOCUS_RING` n'existe pas dans ce fichier : le déclarer en tête, sous les imports, copié verbatim depuis `src/renderer/src/screens/DetailProjet.tsx` (lignes 12-13). C'est ce que font les treize autres fichiers du dépôt qui l'utilisent ; la constante n'est exportée de nulle part.

Puis remplacer `projects.map(...)` par `lignesTriees.map(...)` dans le corps de la liste, en adaptant le contenu de la ligne — la ligne itère désormais sur une `LigneProjet`, pas sur un engagement, donc le lien et le nom se lisent dessus :

```tsx
        {lignesTriees.map((ligne) => (
          <Link
            key={ligne.id}
            to={`/projets/${ligne.id}`}
            className="flex items-center gap-2 bg-ink-800 p-4 transition-colors duration-200 hover:bg-ink-700"
          >
            <div className="flex-1">
              <span className="font-serif text-titre text-champagne">{ligne.nom}</span>
              <p className="mt-1 text-secondaire text-muted">
                {formatMinutes(ligne.minutes)} · {formatDormance(ligne.jours)}
                {franchisParProjet.has(ligne.id) ? ` · ${franchisParProjet.get(ligne.id)}` : ''}
              </p>
            </div>
          </Link>
        ))}
        {lignesTriees.length === 0 && <EmptyState>Aucun projet pour l'instant.</EmptyState>}
```

La ligne de tags disparaît du rendu : `LigneProjet` ne les porte pas, et la ligne dérivée occupe désormais la place. C'est assumé — les tags d'un projet restent visibles sur son écran, et B1 décidera de leur sort dans la liste.

- [ ] **Step 4: Vérifier tests et typage**

Run: `npx vitest run`
Expected: PASS — **257 tests**, 17 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hooks/useMilestones.ts src/renderer/src/screens/ListeProjets.tsx
git commit -m "feat: sort the project list and show each project's progress"
```

---

### Task 5 : Vérification finale

**Files:** aucun, sauf correctifs issus des constats.

- [ ] **Step 1: Énumérer les classes introduites par le diff**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "\b(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9./]+" | sort -u`

Vérifier que l'ensemble obtenu est **inclus** dans les six rôles et les sept crans. Lister ce qui existe puis contrôler l'inclusion, jamais l'inverse. Deux exceptions attendues et déjà documentées : `tracking-[0.04em]` et `tracking-[0.1em]` sont des interlettrages hors des deux échelles, et la géométrie de la case à cocher (`h-[16px]`, `h-[18px]`, `-ml-[24px]`, `-ml-[25px]`, `border-[1.5px]`) est l'exception commentée de la tâche 2.

- [ ] **Step 2: Suite complète et typage**

Run: `npx vitest run`
Expected: **257 tests, 17 fichiers.** Un total doublé signifie qu'un worktree traîne — lancer alors `npx vitest run --dir src/renderer` pour confirmer.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Merge local dans master**

`preview_start` lit le `launch.json` du dépôt racine et sert toujours `master`, jamais le worktree, silencieusement. La vérification live n'a donc de sens qu'après le merge local.

- [ ] **Step 4: Vérification live**

Le compte dev porte déjà le jeu d'essai de B3 : skills Menuiserie (90 min) et Plomberie (45 min), projets Maison (les deux), Atelier (Menuiserie seule) et Jardin (vide).

1. **Un projet avec des jalons partiellement franchis** — poser quatre jalons sur Maison, en cocher un : « 1 jalon sur 4 », barre au quart, et la ligne de la liste finit par « · 1/4 ».
2. **Un projet sans aucun jalon** — Jardin : la liste des jalons est vide avec son champ d'ajout, **ni barre ni libellé d'avancement**, et sa ligne ne porte pas de « 0/0 ».
3. **Les quatre critères de tri** — chacun réordonne réellement la liste, et dans le bon sens : dormance et temps décroissants, avancement croissant, nom alphabétique.
4. **La place des absents** — Jardin, sans activité ni jalon, est **en bas** en tri par dormance comme en tri par avancement.
5. **La célébration sur les trois écrans** — cocher un jalon sur `DetailProjet`, un jalon sur `DetailSkill`, une sous-tâche depuis le popover du calendrier : la même pulsation dans les trois cas, et rien au décochage.
6. **Les sous-tâches inchangées par ailleurs** — la liste de `TaskPopover` et celle de `Focus` gardent leur titre « Sous-tâches » et leur case compacte.
7. **Une seule requête de jalons pour la liste** — vérifiable dans `performance.getEntriesByType('resource')`, filtré sur `engagement_milestone`.

**Répéter les chargements à froid.** Leçon de B3 : une course montre ses deux visages, donc six chargements et non un, et redémarrer le serveur de dev avant de compter pour ne pas mesurer l'ancien module.

- [ ] **Step 5: Push, seulement si tout est passé**

Ne pas enchaîner en proposant une release.

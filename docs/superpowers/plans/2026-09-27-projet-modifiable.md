# Le projet modifiable — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre un projet modifiable — le renommer, corriger ses tags, écrire ses notes, l'archiver — et faire disparaître les projets archivés de la liste.

**Architecture:** Aucun changement de modèle : `updateEngagement` accepte déjà `name`, `notes` et `tags`, et `setArchived` existe. Une seule fonction pure s'ajoute, `analyserTags`, qui remplace quatre copies verbatim de la découpe des tags et y ajoute le dédoublonnage. Le mécanisme d'édition de `NotesSection` — sauvegarde au blur, bouton, confirmation, deux refs contre la double écriture — est extrait en `ChampSauvegarde` et sert les trois champs du projet.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Supabase (PostgREST), react-router-dom (HashRouter), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-projet-modifiable-design.md`

## Global Constraints

- **Aucune migration de base, aucune colonne nouvelle.**
- **Toute la logique dérivée vit en fonctions pures dans `lib/`.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où un calcul peut être vérifié.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px. Aucune valeur arbitraire.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 257 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/lib/tags.ts` | **créé** — `analyserTags`, seule logique de cette tranche |
| `src/renderer/src/lib/tags.test.ts` | **créé** — ses tests |
| `src/renderer/src/screens/NouveauProjet.tsx` | **modifié** — consomme `analyserTags` |
| `src/renderer/src/screens/NouveauSkill.tsx` | **modifié** — idem |
| `src/renderer/src/screens/NouvelleEntree.tsx` | **modifié** — idem |
| `src/renderer/src/screens/NouvelleTache.tsx` | **modifié** — idem |
| `src/renderer/src/components/ChampSauvegarde.tsx` | **créé** — le mécanisme d'édition extrait de `NotesSection` |
| `src/renderer/src/screens/DetailSkill.tsx` | **modifié** — consomme `ChampSauvegarde`, perd sa `NotesSection` locale |
| `src/renderer/src/screens/DetailProjet.tsx` | **modifié** — nom cliquable, sections Tags et Notes, bouton d'archivage |
| `src/renderer/src/screens/ListeProjets.tsx` | **modifié** — bascule « Voir les projets en pause », archivés exclus en amont du tri |

## Décision d'architecture : le mode d'édition du nom vit dans l'écran, pas dans le composant

La spec (§2) veut que le nom reste un `h1` en serif 28 px et bascule en champ au clic. La tentation est de donner à `ChampSauvegarde` une prop « affiche du texte jusqu'à ce qu'on clique ». On ne le fait pas : le composant ne saurait plus s'il est un champ ou un titre, et il faudrait lui passer la typographie du titre.

**L'écran tient le booléen, le composant ne sait que sauvegarder.** `DetailProjet` rend le `h1` quand `enEditionNom` est faux et le `ChampSauvegarde` quand il est vrai. Le nom partage ainsi les deux refs anti-double-écriture sans que le composant gagne une variante.

**Le retour au texte se fait sans prop supplémentaire.** Le `onBlur` de React est un `focusout` : il remonte. L'écran enveloppe donc le champ dans un `div` portant `onBlur={() => setEnEditionNom(false)}` et se passe d'un `onApresBlur` que `ChampSauvegarde` aurait dû relayer.

---

### Task 1 : Les tags

**Files:**
- Create: `src/renderer/src/lib/tags.ts`
- Create: `src/renderer/src/lib/tags.test.ts`
- Modify: `src/renderer/src/screens/NouveauProjet.tsx:25-28`
- Modify: `src/renderer/src/screens/NouveauSkill.tsx:30-33`
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx:49-52`
- Modify: `src/renderer/src/screens/NouvelleTache.tsx:77-80`

**Interfaces:**
- Consumes: rien.
- Produces: `analyserTags(saisie: string): string[]`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/renderer/src/lib/tags.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { analyserTags } from './tags';

describe('analyserTags', () => {
  it('rend une liste vide sur une saisie vide', () => {
    // Surtout pas `['']` : un tag vide se retrouverait en base et
    // apparaîtrait comme un filtre sans libellé dans la liste des tags.
    expect(analyserTags('')).toEqual([]);
  });

  it('taille les blancs autour des virgules', () => {
    // Le cas normal de la frappe.
    expect(analyserTags('Maison , Artisanat ,Bois')).toEqual(['Maison', 'Artisanat', 'Bois']);
  });

  it('ignore les virgules en trop, en tête, en fin et doublées', () => {
    expect(analyserTags(',Maison,,Bois,')).toEqual(['Maison', 'Bois']);
  });

  it('rend une liste vide quand la saisie n’est que virgules et blancs', () => {
    expect(analyserTags(' , ,, ')).toEqual([]);
  });

  it('dédoublonne le même tag saisi deux fois', () => {
    // C'est la raison d'être de cette fonction : un champ qu'on rouvre et
    // réenregistre accumule les doublons, là où un formulaire de création
    // rempli une fois ne le fait pas.
    expect(analyserTags('Maison, Bois, Maison')).toEqual(['Maison', 'Bois']);
  });

  it('dédoublonne sans tenir compte de la casse, en gardant la première orthographe', () => {
    // `filterByTag` (lib/streaks.ts) compare en minuscules, donc « Maison »
    // et « maison » sélectionnent déjà les mêmes éléments. Mais la liste de
    // tags de l'écran Skills les compte séparément, donc les deux
    // apparaîtraient comme deux filtres distincts menant au même résultat.
    expect(analyserTags('Maison, maison, MAISON')).toEqual(['Maison']);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/renderer/src/lib/tags.test.ts`
Expected: FAIL — le module `./tags` n'existe pas. L'échec doit porter sur l'import, pas sur une assertion.

- [ ] **Step 3: Écrire la fonction**

Créer `src/renderer/src/lib/tags.ts` :

```ts
/**
 * La saisie de tags, séparée par des virgules, en liste de tags.
 *
 * Découpe, taille les blancs, jette les vides, et dédoublonne SANS tenir
 * compte de la casse, en gardant la première orthographe rencontrée.
 *
 * Le dédoublonnage est la raison d'être de cette fonction. Les quatre
 * écrans de création qui l'appellent sont remplis une fois, et y saisir
 * deux fois le même tag est sans lendemain ; un champ qu'on rouvre et
 * réenregistre est l'inverse, et c'est exactement là que les doublons
 * s'accumulent.
 *
 * La casse est ignorée parce que le reste de l'application l'ignore déjà :
 * `filterByTag` (`lib/streaks.ts`) compare en minuscules, donc « Maison »
 * et « maison » sélectionnent les mêmes éléments. Mais la liste de tags de
 * l'écran Skills les compte séparément, donc les laisser coexister
 * fabriquerait deux filtres distincts menant au même résultat.
 */
export function analyserTags(saisie: string): string[] {
  const vus = new Set<string>();
  const tags: string[] = [];
  for (const brut of saisie.split(',')) {
    const tag = brut.trim();
    if (!tag) continue;
    const cle = tag.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    tags.push(tag);
  }
  return tags;
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx vitest run src/renderer/src/lib/tags.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Rebrancher les quatre écrans de création**

Dans chacun des quatre fichiers, remplacer le bloc de découpe par l'appel, et ajouter l'import.

`src/renderer/src/screens/NouveauProjet.tsx` — ajouter `import { analyserTags } from '../lib/tags';`, puis remplacer les lignes 25-28 :

```tsx
    const tags = analyserTags(tagsInput);
```

`src/renderer/src/screens/NouveauSkill.tsx` — même import, même remplacement des lignes 30-33 :

```tsx
    const tags = analyserTags(tagsInput);
```

`src/renderer/src/screens/NouvelleEntree.tsx` — même import, même remplacement des lignes 49-52 :

```tsx
    const tags = analyserTags(tagsInput);
```

`src/renderer/src/screens/NouvelleTache.tsx` — même import, même remplacement des lignes 77-80 :

```tsx
    const tags = analyserTags(tagsInput);
```

Les quatre blocs sont identiques mot pour mot avant remplacement ; vérifier qu'il n'en reste aucun avec `grep -rn "split(',')" src/renderer/src/`, qui ne doit plus rien rendre hors fichiers de test.

- [ ] **Step 6: Suite complète et typage**

Run: `npx vitest run`
Expected: PASS — 257 + 6 = **263 tests**, 18 fichiers. Le fichier de plus est `tags.test.ts`.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/tags.ts src/renderer/src/lib/tags.test.ts src/renderer/src/screens/NouveauProjet.tsx src/renderer/src/screens/NouveauSkill.tsx src/renderer/src/screens/NouvelleEntree.tsx src/renderer/src/screens/NouvelleTache.tsx
git commit -m "feat: parse tag input in one place and deduplicate it"
```

---

### Task 2 : Le champ sauvegardé

**Files:**
- Create: `src/renderer/src/components/ChampSauvegarde.tsx`
- Modify: `src/renderer/src/screens/DetailSkill.tsx`

**Interfaces:**
- Consumes: `Button` de `components/Button`.
- Produces: `ChampSauvegarde` en export par défaut, avec la signature
  `{ valeur: string; onSave: (valeur: string | null) => Promise<{ error: string | null }>; lignes?: number; ariaLabel: string; placeholder?: string; confirmation: string; autoFocus?: boolean }`.
  `onSave` reçoit `null` quand le champ est vide après taille, et la chaîne sinon.

**Aucun comportement nouveau dans cette tâche.**

- [ ] **Step 1: Créer le composant**

Créer `src/renderer/src/components/ChampSauvegarde.tsx` en déplaçant le mécanisme de `NotesSection` (`src/renderer/src/screens/DetailSkill.tsx:412`) sans le modifier, et en rendant un `input` ou un `textarea` selon `lignes` :

```tsx
import { useRef, useState } from 'react';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

/**
 * Un champ qui s'enregistre au blur, extrait de la `NotesSection` de
 * `DetailSkill` pour servir aussi les trois champs d'un projet.
 *
 * L'appelant le monte avec une `key` liée à l'engagement (`key={project.id}`) :
 * l'état local est ainsi réinitialisé quand on passe d'un engagement à un
 * autre sans démontage, ce que la route `projets/:id` fait.
 */
export default function ChampSauvegarde({
  valeur,
  onSave,
  lignes,
  ariaLabel,
  placeholder,
  confirmation,
  autoFocus,
}: {
  valeur: string;
  onSave: (valeur: string | null) => Promise<{ error: string | null }>;
  lignes?: number;
  ariaLabel: string;
  placeholder?: string;
  confirmation: string;
  autoFocus?: boolean;
}) {
  const [saisie, setSaisie] = useState(valeur);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Des refs et non la prop `valeur` : cliquer sur « Enregistrer » déclenche
  // d'abord le blur du champ, donc deux appels rapprochés avant que la prop
  // rafraîchie ne revienne. Ces deux refs rendent le second no-op au lieu
  // d'écrire deux fois la même valeur.
  const persistedRef = useRef(valeur);
  const inFlightRef = useRef(false);

  async function enregistrer() {
    const suivant = saisie.trim() ? saisie : null;
    const suivantTexte = suivant ?? '';
    if (inFlightRef.current || persistedRef.current === suivantTexte) return;
    inFlightRef.current = true;
    setStatus('saving');
    setError(null);
    const { error: saveError } = await onSave(suivant);
    inFlightRef.current = false;
    if (saveError) {
      setStatus('idle');
      // La saisie reste dans le champ — pas de perte, retry manuel.
      setError(saveError);
      return;
    }
    persistedRef.current = suivantTexte;
    setStatus('saved');
  }

  const classes = `border border-ink-700 bg-ink-900 px-3 py-2 text-corps text-champagne placeholder:text-muted ${FOCUS_RING}`;

  return (
    <div className="flex flex-col gap-2">
      {lignes === undefined ? (
        <input
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setStatus('idle');
          }}
          onBlur={enregistrer}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={classes}
        />
      ) : (
        <textarea
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setStatus('idle');
          }}
          onBlur={enregistrer}
          rows={lignes}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={classes}
        />
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={enregistrer} disabled={status === 'saving'}>
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {status === 'saved' && <span className="text-corps text-muted">{confirmation}</span>}
      </div>
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rebrancher `DetailSkill`**

Dans `src/renderer/src/screens/DetailSkill.tsx` :

1. Ajouter `import ChampSauvegarde from '../components/ChampSauvegarde';`
2. Remplacer l'appel à `NotesSection` (ligne 404) :

```tsx
            <ChampSauvegarde
              key={skill.id}
              valeur={skill.notes ?? ''}
              onSave={(notes) => updateEngagement(skill.id, { notes })}
              lignes={4}
              ariaLabel="Notes sur ce skill"
              placeholder="Aucune note. Écris ici tes réflexions sur ce skill…"
              confirmation="Notes enregistrées."
            />
```

3. **Supprimer** la déclaration locale de `NotesSection` (à partir de la ligne 412, jusqu'à sa fermeture).
4. Nettoyer les imports devenus inutiles. Attention : `useRef` et `useState` servent ailleurs dans ce fichier ; ne retirer que ce qui n'a plus aucun usage, et laisser `npm run typecheck` trancher.

- [ ] **Step 3: Vérifier que rien n'a bougé**

Run: `npx vitest run`
Expected: PASS — **263 tests**, 18 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre. Un échec ici désigne presque sûrement un import oublié à l'étape 2.4.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ChampSauvegarde.tsx src/renderer/src/screens/DetailSkill.tsx
git commit -m "refactor: extract the save-on-blur field out of the skill screen"
```

---

### Task 3 : L'écran du projet

**Files:**
- Modify: `src/renderer/src/screens/DetailProjet.tsx`

**Interfaces:**
- Consumes: `analyserTags` de `lib/tags.ts` (tâche 1) ; `ChampSauvegarde` de `components/ChampSauvegarde` (tâche 2) ; `updateEngagement` et `setArchived` de `hooks/useEngagements`.
- Produces: rien.

- [ ] **Step 1: Ajouter les imports et les gestionnaires**

Dans `src/renderer/src/screens/DetailProjet.tsx`, ajouter :

```tsx
import ChampSauvegarde from '../components/ChampSauvegarde';
import { analyserTags } from '../lib/tags';
```

Compléter la déstructuration de `useEngagements()` (ligne 35) pour inclure `setArchived` :

```tsx
  const { engagements, loading, error, softDelete, updateEngagement, setArchived } = useEngagements();
```

Puis, à côté des autres gestionnaires :

```tsx
  const [enEditionNom, setEnEditionNom] = useState(false);

  async function handleRenommer(nom: string | null) {
    if (!project) return { error: 'Projet introuvable' };
    // Un nom vide n'est pas enregistré : `name` est obligatoire à la
    // création, et le rendre effaçable après coup produirait un projet sans
    // nom dans toutes les listes. Le champ garde sa saisie, l'écran garde
    // l'ancien nom.
    if (nom === null) return { error: 'Le nom ne peut pas être vide' };
    setActionError(null);
    const { error: renameError } = await updateEngagement(project.id, { name: nom });
    if (renameError) setActionError(renameError);
    return { error: renameError };
  }

  async function handleTags(saisie: string | null) {
    if (!project) return { error: 'Projet introuvable' };
    setActionError(null);
    const { error: tagsError } = await updateEngagement(project.id, { tags: analyserTags(saisie ?? '') });
    if (tagsError) setActionError(tagsError);
    return { error: tagsError };
  }

  async function handleArchiver() {
    if (!project) return;
    setActionError(null);
    const { error: archiveError } = await setArchived(project.id, !project.archivedAt);
    if (archiveError) setActionError(archiveError);
  }
```

- [ ] **Step 2: Rendre le nom cliquable**

Remplacer le bloc d'en-tête (lignes 171-178) par :

```tsx
      <div className="relative overflow-hidden border border-ink-700 bg-ink-900 p-6">
        <RayCorner variant={0} />
        {/* Le nom reste un titre tant qu'on ne le modifie pas : le rendre
            champ en permanence remplacerait un serif 28 px par une boîte
            bordée sur un écran qu'on regarde bien plus qu'on ne le modifie.
            Le mode vit ici et non dans `ChampSauvegarde`, qui ne saurait
            plus s'il est un champ ou un titre.

            Le `onBlur` du div suffit à en sortir : celui de React est un
            `focusout`, donc il remonte depuis le champ. */}
        {enEditionNom ? (
          <div className="relative" onBlur={() => setEnEditionNom(false)}>
            <ChampSauvegarde
              key={project.id}
              valeur={project.name}
              onSave={handleRenommer}
              ariaLabel="Nom du projet"
              confirmation="Nom enregistré."
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEnEditionNom(true)}
            aria-label="Renommer le projet"
            className={`relative block text-left font-serif text-titre-ecran text-champagne ${FOCUS_RING}`}
          >
            {project.name}
          </button>
        )}
      </div>
```

Les tags et les notes quittent l'en-tête : ils ont désormais leur propre section, et les afficher deux fois sur le même écran serait une redondance qu'un relecteur signalerait à juste titre.

- [ ] **Step 3: Ajouter les sections Tags et Notes**

Après la section « Jalons » et avant le bloc du bouton de suppression, insérer :

```tsx
      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Tags</h2>
        <ChampSauvegarde
          key={project.id}
          valeur={project.tags.join(', ')}
          onSave={handleTags}
          ariaLabel="Tags du projet"
          placeholder="Maison, Perso"
          confirmation="Tags enregistrés."
        />
      </section>

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Notes</h2>
        <ChampSauvegarde
          key={project.id}
          valeur={project.notes ?? ''}
          onSave={(notes) => updateEngagement(project.id, { notes })}
          lignes={4}
          ariaLabel="Notes sur ce projet"
          placeholder="Aucune note. Écris ici ce que ce chantier demande…"
          confirmation="Notes enregistrées."
        />
      </section>
```

Les trois `ChampSauvegarde` de cet écran portent `key={project.id}` pour la raison que `NotesSection` documentait déjà : la route `projets/:id` change de projet **sans démonter le composant**, et sans cette `key` l'état local — la saisie en cours, le statut, les deux refs — survivrait au changement et le champ afficherait le texte du projet précédent. Les trois clés peuvent être identiques : une `key` ne distingue que des frères, et ces trois-là ne le sont pas.

Le motif de section — `<section>` nu, `h2` en `font-sans text-corps font-semibold text-champagne` — est celui que cet écran utilise déjà pour « Objectif », « Jalons » et « Composition », et celui de la section « Notes » de `DetailSkill`.

- [ ] **Step 4: Ajouter le bouton d'archivage**

Dans le bloc qui porte `BoutonSuppression`, ajouter le bouton d'archivage avant lui, sur le motif de `DetailSkill.tsx:274` :

```tsx
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleArchiver}>
          {project.archivedAt ? 'Désarchiver' : 'Archiver'}
        </Button>
        <BoutonSuppression onConfirm={handleDelete} busy={deleting} />
        <p className="text-secondaire text-muted">
          Supprimer un projet envoie aussi à la corbeille les engagements dont il est le projet principal.
        </p>
      </div>
```

**Archiver un projet n'archive pas ses membres** : `setArchived` ne touche que l'engagement qu'on lui nomme, et c'est voulu — un skill appartient à plusieurs chantiers, en mettre un en pause ne doit pas suspendre un skill travaillé ailleurs. Rien à écrire pour cela, mais rien à ajouter non plus qui le contredirait.

- [ ] **Step 5: Vérifier tests et typage**

Run: `npx vitest run`
Expected: PASS — **263 tests**, 18 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/DetailProjet.tsx
git commit -m "feat: rename, retag, annotate and archive a project"
```

---

### Task 4 : La liste

**Files:**
- Modify: `src/renderer/src/screens/ListeProjets.tsx`

**Interfaces:**
- Consumes: `Toggle` de `components/Toggle` — signature `{ checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; bordered?: boolean }`.
- Produces: rien.

- [ ] **Step 1: Filtrer les archivés en amont**

`ListeProjets` calcule aujourd'hui `const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);` et rien d'autre : `useEngagements` ne filtre pas les archivés à la lecture, donc un projet archivé reste dans la liste, indiscernable d'un projet actif.

Ajouter l'import `import Toggle from '../components/Toggle';`, puis remplacer ce `useMemo` :

```tsx
  const [voirArchives, setVoirArchives] = useState(false);
  // Le filtre est EN AMONT du tri, sur les projets et non sur les lignes
  // dérivées : un projet archivé ne doit pas seulement disparaître de
  // l'affichage, il ne doit pas non plus peser sur l'ensemble
  // d'identifiants envoyé aux deux requêtes groupées — celle des entrées de
  // pratique et celle des jalons.
  const projects = useMemo(
    () => engagements.filter((e) => e.isProject && (voirArchives || !e.archivedAt)),
    [engagements, voirArchives]
  );
```

`useState` est déjà importé dans ce fichier depuis la tranche B4 — compléter l'import existant de `react` plutôt qu'en ajouter un second.

Tout le reste suit sans y toucher : `membresParProjet`, `idsConcernes`, `lignes`, `lignesTriees` et `franchisParProjet` dérivent tous de `projects`.

- [ ] **Step 2: Ajouter la bascule**

Dans l'en-tête, la bascule passe **avant** le sélecteur de tri, sur le motif de `ListeSkills.tsx:56`. L'en-tête entier devient :

```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-titre-ecran text-champagne">Projets</h1>
        <div className="flex items-center gap-3">
          <Toggle
            bordered={false}
            checked={voirArchives}
            onChange={setVoirArchives}
            label="Voir les projets en pause"
          />
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

Le commentaire que la tranche B4 a laissé au-dessus du `label` — celui qui explique pourquoi le tri par défaut est la dormance et pourquoi il ne persiste pas — reste en place.

- [ ] **Step 3: Vérifier tests et typage**

Run: `npx vitest run`
Expected: PASS — **263 tests**, 18 fichiers. Cette tâche n'en ajoute aucun.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/ListeProjets.tsx
git commit -m "feat: hide archived projects behind a toggle"
```

---

### Task 5 : Vérification finale

**Files:** aucun, sauf correctifs issus des constats.

- [ ] **Step 1: Énumérer les classes introduites par le diff**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "\b(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9./]+" | sort -u`

Vérifier que l'ensemble obtenu est **inclus** dans les six rôles et les sept crans. Lister ce qui existe puis contrôler l'inclusion, jamais l'inverse.

Une seule exception attendue : `tracking-[0.04em]`, un interlettrage hors des deux échelles qui préexiste au chantier. **Et ne pas écrire de nom de classe dans un commentaire** : cette énumération capture les commentaires comme le code, et un `gap-10` cité en exemple a déjà fait croire à une infraction sur la tranche précédente.

- [ ] **Step 2: Suite complète et typage**

Run: `npx vitest run`
Expected: **263 tests, 18 fichiers.** Un total doublé signifie qu'un worktree traîne — lancer alors `npx vitest run --dir src/renderer` pour confirmer.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Merge local dans master**

`preview_start` lit le `launch.json` du dépôt racine et sert toujours `master`, jamais le worktree, silencieusement. La vérification live n'a donc de sens qu'après le merge local.

- [ ] **Step 4: Vérification live**

Le compte dev porte le jeu d'essai des tranches précédentes : projets Maison (deux skills, quatre jalons dont deux cochés), Atelier (Menuiserie, le skill partagé) et Jardin (vide).

1. **Renommer** — cliquer le titre de Jardin, taper un autre nom, quitter le champ : le titre redevient un titre et porte le nouveau nom ; la liste le montre renommé.
2. **Un nom vide est refusé** — vider le champ du nom et quitter : le projet garde son nom, et un message le dit.
3. **Les tags, dédoublonnés** — saisir `Maison, maison, Bois` sur Atelier, enregistrer, recharger : le champ lit `Maison, Bois`.
4. **Les notes** — écrire sur Maison, quitter le champ, voir « Notes enregistrées. », recharger : le texte est là.
5. **Archiver** — archiver Jardin : il quitte la liste. Ouvrir « Voir les projets en pause » : il revient. Le bouton dit « Désarchiver ».
6. **Les membres restent actifs** — après avoir archivé Maison, Menuiserie et Plomberie sont toujours dans la liste des skills sans être en pause.
7. **Les notes d'un skill** — l'écran de Menuiserie enregistre ses notes exactement comme avant l'extraction.

**Répéter les chargements à froid.** Leçon de B3 : une course montre ses deux visages, donc six chargements et non un, et redémarrer le serveur de dev avant de compter pour ne pas mesurer l'ancien module.

- [ ] **Step 5: Push, seulement si tout est passé**

Ne pas enchaîner en proposant une release.

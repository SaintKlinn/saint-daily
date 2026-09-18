# Système typographique et d'espacement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le nuage de valeurs typographiques et d'espacement de l'application par deux échelles nommées, pour que la hiérarchie existe et que les groupes se lisent.

**Architecture:** Une source unique `src/renderer/src/theme/typographie.ts`, sur le modèle exact de `theme/colors.ts`, consommée par `tailwind.config.ts`. L'échelle de texte **remplace** `theme.fontSize` afin qu'un usage résiduel devienne une classe inexistante, donc visible. L'échelle d'espacement n'est pas câblée dans la config — ses sept valeurs sont déjà des valeurs Tailwind par défaut — et son respect est tenu par la relecture et trois `grep` de vérification.

**Tech Stack:** Electron 44, React 19, TypeScript, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-systeme-typographique-design.md`

## Global Constraints

- **Aucune valeur arbitraire de texte** (`text-[Npx]`) ne subsiste dans `src/renderer/src/screens/` ni `src/renderer/src/components/`, hors les exceptions nommées à la tâche 7.
- **Aucun demi-cran d'espacement** (`gap-1.5`, `py-2.5`, `mt-0.5`…) ni valeur arbitraire d'espacement (`py-[18px]`, `px-[22px]`) ne subsiste, hors `gap-px` qui dessine un filet et non un espacement.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px).
- **L'écart entre deux groupes vaut 24 px ; l'écart interne vaut 8 px.** C'est la règle qui produit « l'air » et qu'une relecture vérifie en premier.
- **Le français** pour l'interface, les commentaires et les noms de rôle. Les messages de commit en anglais.
- **Aucune migration de base, aucun changement de données.** Ce plan est entièrement côté rendu.
- **Les 195 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/theme/typographie.ts` | **créé** — source unique des deux échelles |
| `src/renderer/src/theme/typographie.test.ts` | **créé** — non-régression sur les valeurs de la spec |
| `tailwind.config.ts` | **modifié** — consomme `fontSize` depuis la source unique |
| `src/renderer/src/screens/*.tsx` (21 fichiers) | **modifiés** — migration texte puis espacement |
| `src/renderer/src/components/*.tsx` (24 fichiers) | **modifiés** — idem |

---

### Task 1 : La source unique et son câblage

**Files:**
- Create: `src/renderer/src/theme/typographie.ts`
- Create: `src/renderer/src/theme/typographie.test.ts`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: `fontSize` (objet de six rôles, chacun un tuple `[taille, { lineHeight, fontWeight }]` — la forme attendue par `theme.fontSize` de Tailwind) et `espacement` (les sept valeurs autorisées, en pixels, pour documentation et test).
- Consumes: rien.

**Avertissement pour l'implémenteur :** cette tâche **casse volontairement** le rendu de tous les écrans. Remplacer `theme.fontSize` supprime `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl` du thème ; les 292 usages actuels deviennent des classes inexistantes et le texte hérite de sa taille parente. C'est attendu et c'est le but : le rendu redevient correct à la fin de la tâche 3. Ne pas « réparer » ce symptôme.

- [ ] **Step 1 : Écrire la source unique**

```ts
// src/renderer/src/theme/typographie.ts

// Source unique des échelles typographique et d'espacement — consommée par
// tailwind.config.ts, sur le modèle de theme/colors.ts. Les deux échelles
// vivent dans le même fichier parce qu'elles forment un seul système :
// séparées, elles dérivent l'une de l'autre, ce qui est précisément ce qui
// est arrivé à l'application avant cette refonte.
//
// Le diagnostic, pour que personne ne rouvre le débat sans les chiffres :
// sept tailles distinctes entre 9 et 15 px portaient 259 des 292 usages de
// texte, soit 89 %. Sept paliers dans une bande de six pixels sont
// perceptuellement indistinguables — rien ne ressortait, donc rien ne
// hiérarchisait.

// Chaque palier est un tuple [taille, { lineHeight, fontWeight }], la forme
// attendue par `theme.fontSize` de Tailwind.
//
// Poser la hauteur de ligne ici est la moitié du correctif : les valeurs
// arbitraires (`text-[13px]`) ne fixent QUE la taille, et `index.css` ne
// pose aucune base, donc tout le texte de l'application héritait d'un
// `line-height: normal` voisin de 1,2.
//
// La graisse y est posée aussi, pour que le rôle porte son poids sans
// qu'on ait à l'écrire à chaque usage. Tailwind émet les utilitaires de
// `fontSize` avant ceux de `fontWeight`, donc un `font-semibold` explicite
// dans le balisage l'emporte sur la valeur du tuple — c'est ce qui permet
// aux titres de section de carte d'être du `corps` en 600. Cette priorité
// est vérifiée à l'étape 4 plutôt que supposée.
export const fontSize = {
  libelle: ['11px', { lineHeight: '1.45', fontWeight: '600' }],
  secondaire: ['13px', { lineHeight: '1.55', fontWeight: '400' }],
  corps: ['15px', { lineHeight: '1.6', fontWeight: '400' }],
  titre: ['20px', { lineHeight: '1.35', fontWeight: '500' }],
  'titre-ecran': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
  heros: ['40px', { lineHeight: '1.05', fontWeight: '400' }],
} as const;

// Les sept valeurs d'espacement autorisées, en pixels, avec le cran
// Tailwind correspondant.
//
// Elles ne sont PAS câblées dans tailwind.config.ts : `1`, `2`, `3`, `4`,
// `6`, `8` et `12` existent déjà dans l'échelle Tailwind par défaut, il n'y
// a donc rien à étendre. Et remplacer `theme.spacing` serait nuisible :
// il pilote aussi `w-`, `h-`, `inset-` et une dizaine d'autres familles
// dont les besoins sont géométriques et non rythmiques — la grille horaire
// du calendrier, les 72 px du rail, les cases de la heatmap.
//
// Ce tableau sert donc de référence pour la relecture et pour le test, pas
// de configuration. La discipline sur les espacements est tenue par les
// trois `grep` de vérification de la tâche 7.
export const espacement = {
  serre: { px: 4, cran: '1' },
  interne: { px: 8, cran: '2' },
  interneLarge: { px: 12, cran: '3' },
  carte: { px: 16, cran: '4' },
  entreGroupes: { px: 24, cran: '6' },
  entreSections: { px: 32, cran: '8' },
  page: { px: 48, cran: '12' },
} as const;
```

- [ ] **Step 2 : Écrire le test de non-régression**

```ts
// src/renderer/src/theme/typographie.test.ts
import { describe, expect, it } from 'vitest';
import { espacement, fontSize } from './typographie';

describe('échelle typographique', () => {
  it('expose exactement les six rôles de la spec', () => {
    expect(Object.keys(fontSize)).toEqual([
      'libelle',
      'secondaire',
      'corps',
      'titre',
      'titre-ecran',
      'heros',
    ]);
  });

  it('porte les tailles de la spec', () => {
    expect(fontSize.libelle[0]).toBe('11px');
    expect(fontSize.secondaire[0]).toBe('13px');
    expect(fontSize.corps[0]).toBe('15px');
    expect(fontSize.titre[0]).toBe('20px');
    expect(fontSize['titre-ecran'][0]).toBe('28px');
    expect(fontSize.heros[0]).toBe('40px');
  });

  it('donne un interlignage explicite à chaque palier', () => {
    // C'est le point du correctif : aucun palier ne doit laisser la
    // hauteur de ligne à `normal`.
    for (const [role, [, meta]] of Object.entries(fontSize)) {
      expect(meta.lineHeight, role).toBeTruthy();
      expect(Number(meta.lineHeight), role).toBeGreaterThan(1);
    }
  });

  it('culmine sur le corps, puis resserre à mesure que la taille monte', () => {
    // La courbe n'est pas monotone et ne doit pas l'être : elle monte
    // jusqu'au corps, qui est le seul palier à porter du texte suivi et
    // donc celui qui a le plus besoin d'air entre ses lignes, puis
    // redescend — un titre de 40 px avec un rapport de 1,6 serait déchiré.
    const lh = (r: keyof typeof fontSize) => Number(fontSize[r][1].lineHeight);

    expect(lh('corps')).toBeGreaterThan(lh('secondaire'));
    expect(lh('secondaire')).toBeGreaterThan(lh('libelle'));

    // À partir du corps, strictement décroissant.
    expect(lh('titre')).toBeLessThan(lh('corps'));
    expect(lh('titre-ecran')).toBeLessThan(lh('titre'));
    expect(lh('heros')).toBeLessThan(lh('titre-ecran'));

    // Et aucun palier de petite taille ne descend sous 1,4 : c'est le
    // plancher qui produit « l'air » dans les textes courts.
    for (const r of ['libelle', 'secondaire', 'corps'] as const) {
      expect(lh(r), r).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('donne une graisse à chaque palier', () => {
    for (const [role, [, meta]] of Object.entries(fontSize)) {
      expect(['400', '500', '600'], role).toContain(meta.fontWeight);
    }
  });
});

describe('échelle d’espacement', () => {
  it('expose les sept valeurs de la spec, toutes multiples de 4', () => {
    const px = Object.values(espacement).map((e) => e.px);
    expect(px).toEqual([4, 8, 12, 16, 24, 32, 48]);
    for (const v of px) expect(v % 4).toBe(0);
  });

  it('garde un écart entre groupes valant trois fois l’écart interne', () => {
    // La règle centrale de la spec : 8 dedans contre 24 dehors. Si
    // quelqu’un rapproche ces deux valeurs, le groupement disparaît et
    // les deux symptômes d’origine reviennent.
    expect(espacement.entreGroupes.px).toBe(espacement.interne.px * 3);
  });
});
```

- [ ] **Step 3 : Lancer le test et vérifier qu'il passe**

```
npx vitest run src/renderer/src/theme/typographie.test.ts
```

Attendu : 7 tests verts.

- [ ] **Step 4 : Câbler dans `tailwind.config.ts`**

`fontSize` **remplace** au lieu d'étendre — il se place donc dans `theme`, à côté de `extend`, et non dedans.

```ts
import type { Config } from 'tailwindcss';
import { colors } from './src/renderer/src/theme/colors';
import { fontSize } from './src/renderer/src/theme/typographie';

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    // Hors `extend` : remplacer l'échelle par défaut supprime `text-xs`,
    // `text-sm`, `text-base` et consorts, de sorte qu'un usage résiduel
    // devienne une classe inexistante — visible immédiatement plutôt que
    // silencieusement rendu. C'est ce qui rend la migration vérifiable.
    fontSize: fontSize as unknown as Config['theme']['fontSize'],
    extend: {
      colors: {
        ink: colors.ink,
        champagne: colors.champagne,
        muted: colors.muted,
        accent: colors.accent,
        danger: colors.danger,
        heatmap: colors.heatmap,
      },
      fontFamily: {
        serif: ['"IBM Plex Serif"', 'ui-serif', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5 : Vérifier que les six rôles sortent, et que la graisse du balisage gagne**

Le point à ne pas supposer : la spec fait reposer les titres de section de carte sur `text-corps font-semibold`, ce qui n'a de sens que si `font-semibold` l'emporte sur le `fontWeight` du tuple. Créer un fichier de sonde temporaire, compiler la CSS, lire le résultat, puis supprimer la sonde.

```
printf '<div class="text-corps text-libelle text-titre text-titre-ecran text-heros text-secondaire text-corps font-semibold text-sm"></div>' > sonde.tmp.html
npx tailwindcss -i src/renderer/src/index.css -o sonde.tmp.css --content sonde.tmp.html
```

Vérifier dans `sonde.tmp.css` :
1. les six classes de rôle existent, chacune avec `font-size` **et** `line-height` ;
2. `.text-sm` **n'existe pas** (preuve que le remplacement a bien eu lieu) ;
3. la règle `.font-semibold` apparaît **après** `.text-corps` dans le fichier.

Si le point 3 est faux, retirer `fontWeight` des six tuples et écrire les graisses dans le balisage à la tâche 6 — la spec reste satisfaite, seul le porteur de la graisse change. Consigner le choix retenu.

```
rm -f sonde.tmp.html sonde.tmp.css
```

- [ ] **Step 6 : Typecheck**

```
npm run typecheck
```

Attendu : propre. Les tests restent verts (`npx vitest run`) : 202 tests, 14 fichiers.

- [ ] **Step 7 : Commit**

```
git add src/renderer/src/theme/typographie.ts src/renderer/src/theme/typographie.test.ts tailwind.config.ts
git commit -m "feat: add the single source for the type and spacing scales"
```

---

### Task 2 : Migration mécanique du texte

**Files:**
- Modify: les 45 fichiers de `src/renderer/src/screens/` et `src/renderer/src/components/`

**Interfaces:**
- Consumes: les six rôles de la tâche 1.
- Produces: un arbre où seuls `text-xs` (traité tâche 3) et les exceptions (tâche 7) restent hors échelle.

Toutes les correspondances de la spec **sauf `text-xs`**, qui demande un arbitrage par usage.

- [ ] **Step 1 : Relever les compteurs de départ**

```
grep -roh "text-\[[0-9]*px\]\|text-xs\|text-sm\|text-lg\|text-xl\|text-2xl" src/renderer/src/screens src/renderer/src/components | sort | uniq -c | sort -rn
```

Noter le total : 292. Il servira de contrôle à l'étape 4.

- [ ] **Step 2 : Appliquer les substitutions**

L'ordre importe : traiter `text-[15px]` avant `text-[1...]` n'a pas d'incidence ici puisque chaque motif est ancré par `]`, mais `text-sm` doit passer **après** `text-xs` n'est pas concerné (il est laissé de côté). Lancer depuis la racine du worktree.

```
cd src/renderer/src
FILES=$(ls screens/*.tsx components/*.tsx)

# --- vers libelle (11 px) ---
sed -i 's/text-\[9px\]/text-libelle/g'  $FILES
sed -i 's/text-\[10px\]/text-libelle/g' $FILES
sed -i 's/text-\[11px\]/text-libelle/g' $FILES

# --- vers secondaire (13 px) ---
sed -i 's/text-\[13px\]/text-secondaire/g' $FILES

# --- vers corps (15 px) ---
sed -i 's/\btext-sm\b/text-corps/g'      $FILES
sed -i 's/text-\[15px\]/text-corps/g'    $FILES

# --- vers titre (20 px) ---
sed -i 's/\btext-lg\b/text-titre/g'      $FILES
sed -i 's/text-\[19px\]/text-titre/g'    $FILES
sed -i 's/\btext-xl\b/text-titre/g'      $FILES

# --- vers titre-ecran (28 px) ---
sed -i 's/\btext-2xl\b/text-titre-ecran/g'   $FILES
sed -i 's/text-\[26px\]/text-titre-ecran/g'  $FILES
sed -i 's/text-\[30px\]/text-titre-ecran/g'  $FILES
sed -i 's/text-\[32px\]/text-titre-ecran/g'  $FILES

# --- vers heros (40 px) ---
sed -i 's/text-\[34px\]/text-heros/g' $FILES
sed -i 's/text-\[36px\]/text-heros/g' $FILES
sed -i 's/text-\[38px\]/text-heros/g' $FILES
sed -i 's/text-\[44px\]/text-heros/g' $FILES
cd ../../..
```

**Pourquoi `\b` sur `text-sm`, `text-lg`, `text-xl` et `text-2xl`.** Sans limite de mot, `text-xl` remplacerait le début de `text-2xl` et produirait `text-2text-titre`. Et `text-sm` sans `\b` toucherait un éventuel `text-smth`. Vérifier à l'étape 4 qu'aucune classe composite n'a été produite.

- [ ] **Step 3 : Vérifier qu'aucune classe malformée n'a été créée**

```
grep -rn "text-[0-9]text-\|text-text-\|-text-libelle\|-text-corps" src/renderer/src/screens src/renderer/src/components
```

Attendu : aucun résultat. Un résultat ici signifie qu'une substitution a mordu sur une autre — corriger à la main avant de continuer.

- [ ] **Step 4 : Vérifier les compteurs d'arrivée**

```
grep -roh "text-libelle\|text-secondaire\|text-corps\|text-titre-ecran\|text-titre\|text-heros\|text-xs\|text-\[[0-9]*px\]" src/renderer/src/screens src/renderer/src/components | sort | uniq -c | sort -rn
```

Attendu, exactement :

| Classe | Compte |
|---|---|
| `text-corps` | 120 |
| `text-libelle` | 47 |
| `text-secondaire` | 49 |
| `text-xs` | 43 |
| `text-titre` | 11 |
| `text-titre-ecran` | 17 |
| `text-heros` | 5 |
| `text-[Npx]` | 0 |

Total 292. **Attention à l'ordre du motif de `grep` ci-dessus** : `text-titre-ecran` précède `text-titre`, sans quoi `text-titre` capturerait le préfixe des deux et fausserait les deux comptes.

Si un compte diffère, ne pas poursuivre : retrouver l'écart avec `git diff` avant de passer à la suite.

- [ ] **Step 5 : Typecheck et tests**

```
npm run typecheck
npx vitest run
```

Attendu : propre, 202 tests verts. Aucun test ne dépend de classes de mise en forme.

- [ ] **Step 6 : Commit**

```
git add src/renderer/src/screens src/renderer/src/components
git commit -m "refactor: map every text size onto the six named roles"
```

---

### Task 3 : L'arbitrage `text-xs`

**Files:**
- Modify: les fichiers contenant `text-xs` (43 usages)

**Interfaces:**
- Consumes: `libelle` et `secondaire` de la tâche 1.
- Produces: plus aucun `text-xs` dans l'arbre.

C'est le seul cas de la migration texte qui demande de regarder chaque usage. Règle de la spec : **si la classe voisine comporte `uppercase`, c'est un libellé → `text-libelle` ; sinon c'est du texte d'appoint → `text-secondaire`.**

- [ ] **Step 1 : Lister les usages avec leur contexte**

```
grep -rn "text-xs" src/renderer/src/screens src/renderer/src/components
```

- [ ] **Step 2 : Séparer les deux familles**

```
echo "--- en capitales -> text-libelle ---"
grep -rn "text-xs" src/renderer/src/screens src/renderer/src/components | grep "uppercase" | wc -l
echo "--- sans capitales -> text-secondaire ---"
grep -rn "text-xs" src/renderer/src/screens src/renderer/src/components | grep -v "uppercase" | wc -l
```

La somme doit faire 43. Les deux occurrences de `Pomodoro.tsx` en `font-data text-xs uppercase tracking-[0.1em]` relèvent de la première famille.

- [ ] **Step 3 : Appliquer, ligne à ligne**

Une substitution globale est impossible : les deux familles cohabitent dans les mêmes fichiers. Pour chaque ligne listée à l'étape 2, remplacer `text-xs` par `text-libelle` si la ligne contient `uppercase`, sinon par `text-secondaire`.

Cette boucle le fait de façon sûre, en ne traitant que les lignes contenant `text-xs` et en décidant par ligne :

```
for f in src/renderer/src/screens/*.tsx src/renderer/src/components/*.tsx; do
  perl -i -pe 's/\btext-xs\b/ $& =~ \/x\/ && \/uppercase\/ ? "text-libelle" : "text-secondaire" /ge' "$f"
done
```

**Si cette commande paraît fragile, la faire à la main** : 43 usages sont parcourables, et une substitution fausse est plus coûteuse que dix minutes d'édition. L'important est la règle, pas l'outil.

- [ ] **Step 4 : Vérifier**

```
grep -rn "text-xs" src/renderer/src/screens src/renderer/src/components
```

Attendu : aucun résultat.

```
grep -roh "text-libelle\|text-secondaire" src/renderer/src/screens src/renderer/src/components | sort | uniq -c
```

Attendu : `text-libelle` + `text-secondaire` = 47 + 49 + 43 = 139 au total, répartis selon le décompte de l'étape 2.

- [ ] **Step 5 : Le rendu redevient correct — vérifier à l'œil**

C'est le premier point du plan où l'application s'affiche normalement. Lancer le serveur de développement **depuis le checkout principal après merge** — `preview_start` sert le dépôt racine et non le worktree (voir la note de session). À défaut, `npm run dev` et regarder l'Accueil : le texte doit être à sa taille, aucun bloc ne doit avoir hérité d'une taille parente.

- [ ] **Step 6 : Typecheck, tests, commit**

```
npm run typecheck
npx vitest run
git add src/renderer/src/screens src/renderer/src/components
git commit -m "refactor: split the 12px size between label and secondary roles"
```

---

### Task 4 : Migration mécanique des espacements

**Files:**
- Modify: les 45 fichiers de `screens/` et `components/`

**Interfaces:**
- Consumes: `espacement` de la tâche 1.
- Produces: un arbre sans demi-cran ni valeur arbitraire d'espacement.

Purement substitutif, selon la table de la spec. Le jugement vient à la tâche 5.

- [ ] **Step 1 : Relever les compteurs de départ**

```
grep -roh "\b\(gap\|p\|px\|py\|m\|mt\|mb\|ml\|mr\)-[0-9.]*\|\b\(gap\|p\|px\|py\)-\[[0-9]*px\]" src/renderer/src/screens src/renderer/src/components | sort | uniq -c | sort -rn
```

- [ ] **Step 2 : Appliquer les substitutions**

Les préfixes traités : `gap`, `gap-x`, `gap-y`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mt`, `mb`, `ml`, `mr`, `space-x`, `space-y`.

```
cd src/renderer/src
FILES=$(ls screens/*.tsx components/*.tsx)
P='\(gap\|gap-x\|gap-y\|p\|px\|py\|pt\|pb\|pl\|pr\|m\|mt\|mb\|ml\|mr\|space-x\|space-y\)'

# --- demi-crans, arrondis vers le haut ---
sed -i "s/\b$P-0\.5\b/\1-1/g"   $FILES   # 2 px  -> 4 px
sed -i "s/\b$P-1\.5\b/\1-2/g"   $FILES   # 6 px  -> 8 px
sed -i "s/\b$P-2\.5\b/\1-3/g"   $FILES   # 10 px -> 12 px
sed -i "s/\b$P-3\.5\b/\1-4/g"   $FILES   # 14 px -> 16 px

# --- crans hors échelle ---
sed -i "s/\b$P-5\b/\1-6/g"      $FILES   # 20 px -> 24 px
sed -i "s/\b$P-7\b/\1-8/g"      $FILES   # 28 px -> 32 px
sed -i "s/\b$P-9\b/\1-8/g"      $FILES   # 36 px -> 32 px

# --- valeurs arbitraires ---
sed -i "s/\b$P-\[18px\]/\1-4/g" $FILES   # 18 px -> 16 px
sed -i "s/\b$P-\[22px\]/\1-6/g" $FILES   # 22 px -> 24 px
cd ../../..
```

**`gap-px` n'est pas touché** : il dessine les filets de séparation des listes de `Journal` et `Corbeille` par la couleur de fond du conteneur. C'est un trait, pas un espacement — motivé au §2 de la spec.

**`gap-0` n'est pas touché** non plus : zéro est l'absence d'espacement, pas une valeur d'échelle.

- [ ] **Step 3 : Vérifier qu'il ne reste aucun demi-cran ni arbitraire**

```
grep -rn "\b\(gap\|gap-x\|gap-y\|p\|px\|py\|pt\|pb\|pl\|pr\|m\|mt\|mb\|ml\|mr\|space-x\|space-y\)-[0-9]*\.5\b" src/renderer/src/screens src/renderer/src/components
grep -rn "\b\(gap\|p\|px\|py\)-\[" src/renderer/src/screens src/renderer/src/components
```

Attendu : aucun résultat pour les deux.

- [ ] **Step 4 : Vérifier qu'il ne reste aucun cran hors échelle**

```
grep -rn "\b\(gap\|gap-x\|gap-y\|p\|px\|py\|pt\|pb\|pl\|pr\|m\|mt\|mb\|ml\|mr\|space-x\|space-y\)-\(5\|7\|9\|10\|11\|14\|16\|20\|24\)\b" src/renderer/src/screens src/renderer/src/components
```

Attendu : aucun résultat. Les seules valeurs admises sont `0`, `px`, `1`, `2`, `3`, `4`, `6`, `8`, `12`.

- [ ] **Step 5 : Typecheck, tests, commit**

```
npm run typecheck
npx vitest run
git add src/renderer/src/screens src/renderer/src/components
git commit -m "refactor: map every spacing value onto the seven-step scale"
```

---

### Task 5 : L'air — les quatre écrans nommés par l'utilisateur

**Files:**
- Modify: `src/renderer/src/screens/Accueil.tsx`, `Calendrier.tsx`, `Bilan.tsx`, `Journal.tsx`, et les composants qu'ils montent : `HeatmapCalendrier.tsx`, `BarreRepartition.tsx`, `SemaineVsSemaine.tsx`, `MeilleureHeureProductivite.tsx`, `TaskPopover.tsx`

**Interfaces:**
- Consumes: l'échelle d'espacement, désormais respectée.
- Produces: la règle dedans/dehors appliquée sur les écrans où l'utilisateur a signalé la gêne.

**C'est la tâche qui règle réellement le problème.** Les tâches 4 et 5 sont distinctes pour une raison de fond : la table de correspondance produit des valeurs propres, mais conserve l'erreur d'origine — le même écart sert à l'intérieur d'un groupe et entre deux groupes. Une migration qui s'arrête à la tâche 4 laisse la hiérarchie exactement aussi floue qu'avant.

La question à poser à chaque `gap`, `p` et `m` de ces fichiers, une par une :

> Cet écart sépare-t-il deux choses **d'un même groupe** — un libellé et sa valeur, deux lignes d'une liste — ou **deux groupes** — deux cartes, deux sections ?

Dedans → `2` (8 px). Dehors → `6` (24 px). Entre sections d'un écran → `8` (32 px). Autour de l'en-tête d'écran → `12` (48 px).

- [ ] **Step 1 : Inventorier les écarts de ces neuf fichiers**

```
grep -n "gap-\|\bp-\|px-\|py-\|mt-\|mb-" src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/Calendrier.tsx src/renderer/src/screens/Bilan.tsx src/renderer/src/screens/Journal.tsx src/renderer/src/components/HeatmapCalendrier.tsx src/renderer/src/components/BarreRepartition.tsx src/renderer/src/components/SemaineVsSemaine.tsx src/renderer/src/components/MeilleureHeureProductivite.tsx src/renderer/src/components/TaskPopover.tsx
```

- [ ] **Step 2 : Classer chaque écart, puis corriger**

Pour chaque ligne de l'inventaire, écrire son verdict — *dedans* ou *dehors* — puis appliquer la valeur correspondante. Les cas déjà identifiés, à traiter en priorité :

- **`Bilan.tsx`** : le conteneur d'écran est en `gap-7` (devenu `gap-8` à la tâche 4) et chaque `Section` en `gap-4` avec `p-6`. Les `Section` sont des groupes : leur écart mutuel va à `8` (32 px), leur rembourrage à `4` (16 px), et l'écart interne entre le titre et le contenu à `2` (8 px). La grille `lg:grid-cols-2` doit passer à `gap-6` (24 px) : deux cartes côte à côte sont deux groupes.
- **`SemaineVsSemaine.tsx`** : les deux blocs sont côte à côte en `gap-3` (12 px) — deux groupes, donc `6` (24 px). À l'intérieur d'un bloc, l'écart titre/valeur/séances reste `1` (4 px) : ces trois lignes sont **une** information.
- **`BarreRepartition.tsx`** : `gap-3` entre les lignes de la liste — chaque ligne est un groupe, donc `6`. À l'intérieur d'une ligne, libellé et rail restent à `2`.
- **`Journal.tsx`** : les articles sont séparés par `gap-px` (le filet, conservé) et rembourrés en `py-4 px-[18px]` → `py-4 px-4`. À l'intérieur d'un article, `gap-2` entre le titre, la note et les tags.
- **`Accueil.tsx`** : vérifier que les bandeaux de rituel, les compteurs et « Rappels dus » sont bien séparés par `8` (32 px) et non par l'écart interne de leurs cartes.
- **`Calendrier.tsx`** : l'écran le plus dense. Les dimensions de la grille horaire viennent de `calendarLayout.ts` et **ne sont pas** des espacements — ne pas y toucher. Ne traiter que l'en-tête, la barre d'outils et le `TaskPopover`.

- [ ] **Step 3 : Vérifier que l'échelle est toujours respectée**

Relancer les deux `grep` de l'étape 3 de la tâche 4 : aucun demi-cran, aucune valeur arbitraire réintroduite.

- [ ] **Step 4 : Typecheck, tests, commit**

```
npm run typecheck
npx vitest run
git add src/renderer/src/screens src/renderer/src/components
git commit -m "fix: separate groups by 24px on the four screens the user named"
```

---

### Task 6 : L'air — le reste de l'application

**Files:**
- Modify: les écrans et composants non traités à la tâche 5

**Interfaces:**
- Consumes: la même règle dedans/dehors.
- Produces: l'application entière au même rythme.

Même travail que la tâche 5, même question, sur les fichiers restants : `ListeSkills`, `DetailSkill`, `NouveauSkill`, `NouvelleEntree`, `NouvelleTache`, `ListeProjets`, `NouveauProjet`, `DetailProjet`, `Pomodoro`, `Reglages`, `Corbeille`, `Focus`, `Login`, `Introuvable`, et les composants `AppShell`, `EmptyState`, `FormField`, `Button`, `Toggle`, `GoalProgress`, `MilestoneChecklist`, `RecurrenceEditor`, `SkillPicker`, `UpdateBanner`, `BoutonSuppression`, `ProgressRing`, `PastilleCompte`.

- [ ] **Step 1 : Traiter les écrans de formulaire**

`NouveauSkill`, `NouvelleEntree`, `NouvelleTache`, `NouveauProjet` partagent une structure : libellé en `libelle`, en-tête en `titre-ecran`, puis une pile de champs. Les champs sont des groupes → `gap-6` (24 px) entre eux ; à l'intérieur d'un champ, libellé et saisie → `gap-1` (4 px), ce que `FormField` fait déjà.

- [ ] **Step 2 : Traiter `Reglages`**

Le cas le plus net de l'application : des groupes titrés (Rappels, Pomodoro, Données, Modèles de note, À propos) qui doivent être séparés par `8` (32 px), avec les réglages d'un même groupe à `2` (8 px). `Toggle` porte déjà son propre rythme (`py-4` + filet) — le conserver.

- [ ] **Step 3 : Traiter les écrans de liste et de détail**

`ListeSkills`, `ListeProjets`, `Corbeille` : une ligne = un groupe → `6` entre les lignes, `2` dedans. `DetailSkill` et `DetailProjet` : les `<section>` sont des groupes → `8` entre elles.

- [ ] **Step 4 : Vérifier les composants partagés**

Cette étape **vérifie**, elle n'applique pas : les `sed` de la tâche 4 ont déjà converti globalement `-9` → `-8` et `-5` → `-6`. `EmptyState` doit donc déjà porter `px-6 py-8` (et non plus `py-9`), et `Button` `px-6 py-3` pour la taille `md` (et non plus `px-5`), `px-4 py-2` étant conservé pour `sm`. Le confirmer :

```
grep -n "px-\|py-" src/renderer/src/components/EmptyState.tsx src/renderer/src/components/Button.tsx
```

Si ces valeurs ne sont pas celles attendues, c'est la tâche 4 qui a échoué sur ces fichiers — le signaler plutôt que de corriger ici, parce que l'écart vaudrait alors pour d'autres fichiers aussi.

**Ne pas toucher** aux dimensions géométriques : les 72 px du rail dans `AppShell`, le diamètre de `ProgressRing`, les 40 px de `PastilleCompte`. Ce ne sont pas des espacements.

- [ ] **Step 5 : Vérifier, typecheck, tests, commit**

```
grep -rn "\b\(gap\|gap-x\|gap-y\|p\|px\|py\|pt\|pb\|pl\|pr\|m\|mt\|mb\|ml\|mr\)-[0-9]*\.5\b" src/renderer/src/screens src/renderer/src/components
npm run typecheck
npx vitest run
git add src/renderer/src/screens src/renderer/src/components
git commit -m "fix: apply the same inside/outside rhythm to the rest of the app"
```

---

### Task 7 : Les graisses, la heatmap, les exceptions et la vérification finale

**Files:**
- Modify: `src/renderer/src/components/HeatmapCalendrier.tsx`, `src/renderer/src/screens/PomodoroOverlay.tsx`, `src/renderer/src/screens/AgendaWidget.tsx`, plus les fichiers où deux textes de même taille doivent se distinguer

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: l'état final attendu par la spec.

- [ ] **Step 1 : Les graisses**

Si l'étape 5 de la tâche 1 a confirmé que le balisage l'emporte, les tuples portent déjà la graisse de chaque rôle et il n'y a qu'à traiter les exceptions : les titres de section de carte gardent `font-semibold` sur `text-corps`. Vérifier qu'ils l'ont tous :

```
grep -rn "text-corps font-semibold\|font-semibold.*text-corps" src/renderer/src/screens src/renderer/src/components
```

Attendu : les six titres de section de carte (cinq dans `Bilan.tsx`, ceux de `DetailSkill.tsx` et `DetailProjet.tsx`).

Si l'étape 5 de la tâche 1 a conclu l'inverse, écrire ici les graisses dans le balisage, rôle par rôle, selon la table du §1 de la spec.

- [ ] **Step 2 : Agrandir la heatmap**

Les libellés de jour étaient à 9 px parce que les lignes faisaient 11 px. Ils sont désormais à `text-libelle` (11 px) : les cases doivent suivre. Remplacer les trois dimensions de `HeatmapCalendrier.tsx` :

```tsx
// Les cases passent de 11 à 13 px : `text-libelle` fait 11 px, et un
// libellé de 11 px dans une ligne de 11 px ne tient pas. La heatmap y
// gagne en lisibilité, ce qui est le sujet de cette refonte.
<span key={label} className="h-[13px] font-data text-libelle leading-[13px] text-muted">
```

Puis, pour les cases et la légende, `h-[11px] w-[11px]` → `h-[13px] w-[13px]`.

- [ ] **Step 3 : Vérifier que la heatmap défile toujours**

53 colonnes de 13 px plus 3 px d'écart font environ 870 px au lieu de 740. Le conteneur est déjà en `overflow-x-auto` — **le confirmer plutôt que le supposer** : ouvrir le Bilan, mesurer `scrollWidth` contre `clientWidth` du conteneur de la grille, et vérifier que la page elle-même ne défile pas horizontalement.

- [ ] **Step 4 : Documenter les deux exceptions**

En tête de `PomodoroOverlay.tsx` et de `AgendaWidget.tsx` :

```tsx
// Exception assumée à l'échelle d'espacement (voir la spec du système
// typographique, §5) : ces fenêtres sont distinctes et minuscules. Une
// fenêtre de 300 px n'obéit pas au rythme d'une fenêtre de 1280 — un
// écart de 24 px entre groupes y mangerait le contenu. Elles adoptent
// l'échelle de TEXTE, et conservent leurs espacements propres.
```

- [ ] **Step 5 : Les trois `grep` de vérification de la spec**

```
grep -rn "text-\[" src/renderer/src/screens src/renderer/src/components
grep -rn "\b\(gap\|gap-x\|gap-y\|p\|px\|py\|pt\|pb\|pl\|pr\|m\|mt\|mb\|ml\|mr\)-[0-9]*\.5\b" src/renderer/src/screens src/renderer/src/components
grep -rn "\b\(gap\|p\|px\|py\)-\[" src/renderer/src/screens src/renderer/src/components
```

Et celui-ci, **qui est le plus important des quatre** — il liste toute classe de taille de texte n'appartenant pas aux six rôles, quelle que soit sa forme :

```
grep -rn "text-\(xs\|sm\|base\|lg\|[0-9]*xl\)\b" src/renderer/src/screens src/renderer/src/components
```

**Pourquoi celui-là compte le plus.** L'inventaire d'origine de ce plan énumérait les tailles qu'il *savait* chercher — `text-xs`, `text-sm`, `text-lg`, `text-xl`, `text-2xl` — et a donc raté `text-3xl`, présent une seule fois, sur le minuteur de l'écran Pomodoro. Comme la tâche 1 supprime l'échelle Tailwind par défaut, cette classe orpheline ne rendait plus rien du tout : le minuteur s'affichait à la taille héritée, sans qu'aucun test ni aucun compteur ne bronche. Ce `grep`-là énumère par *famille* et non par valeur connue, donc il attrape aussi ce que l'inventaire n'avait pas imaginé.

Attendu : **les quatre ne renvoient rien.**

Ne pas se laisser induire en erreur par les dimensions de la heatmap posées à l'étape 2 : `h-[13px]`, `w-[13px]` et `leading-[13px]` sont des valeurs arbitraires, mais aucune ne contient la chaîne `text-[`, donc le premier motif ne les capture pas. Elles sont par ailleurs légitimes — ce sont des dimensions géométriques, pas des tailles de texte, et la contrainte globale ne porte que sur ces dernières.

- [ ] **Step 6 : Vérification finale**

```
npm run typecheck
npx vitest run
npm run build
```

Attendu : propre, 202 tests verts, build réussi.

- [ ] **Step 7 : Vérification live, après merge dans le checkout principal**

`preview_start` sert le dépôt racine et non le worktree. Après merge, lancer le serveur et **mesurer** sur l'Accueil, le Calendrier, le Bilan et le Journal :

1. que la hauteur de ligne du texte courant vaut bien 1,6 × 15 px = 24 px (`getComputedStyle(el).lineHeight`) ;
2. que l'écart entre deux cartes voisines vaut 24 px et l'écart interne 8 px — c'est la règle centrale de la spec, et la seule mesure qui prouve que « l'air » a été produit ;
3. qu'aucun écran ne défile horizontalement.

- [ ] **Step 8 : Commit**

```
git add src/renderer/src
git commit -m "fix: enlarge the heatmap, note the two window exceptions, verify the scales"
```

---

## Auto-relecture

**Couverture de la spec.** Les six sections de la spec sont couvertes : §1 l'échelle typographique → tâches 1 à 3 ; §2 l'échelle d'espacement → tâches 4 à 6 ; §3 la table de correspondance → tâches 2 et 4, valeur par valeur ; §4 la mise en œuvre → tâche 1, y compris les trois `grep` reportés en tâche 7 ; §5 les exceptions → tâche 7 ; §6 le découpage → les sept tâches, qui éclatent les quatre chantiers de la spec là où une relecture peut accepter l'un et rejeter l'autre.

**Écart assumé avec la spec, à consigner.** La spec §4 annonçait que l'échelle d'espacement « étend » `theme.spacing`. Vérification faite, les sept valeurs retenues — 4, 8, 12, 16, 24, 32, 48 px — correspondent aux crans `1`, `2`, `3`, `4`, `6`, `8`, `12` qui **existent déjà** dans Tailwind par défaut : il n'y a donc rien à étendre, et `tailwind.config.ts` ne change pas pour les espacements. La conclusion de la spec est inchangée — la discipline reste tenue par la relecture et les `grep`, pas par le compilateur.

**Cohérence des noms et des types.** `fontSize` et `espacement` sont nommés à la tâche 1 et repris tels quels ensuite. Les six rôles portent partout les mêmes noms (`libelle`, `secondaire`, `corps`, `titre`, `titre-ecran`, `heros`). Le compte de tests passe de 195 à 202 dès la tâche 1 et cette valeur est reprise à chaque étape de vérification.

**Les deux pièges que l'auto-relecture a rattrapés.**

Le premier est dans les commandes : l'étape 4 de la tâche 2 vérifie les compteurs avec un `grep` dont l'ordre des alternatives compte — `text-titre-ecran` doit précéder `text-titre`, sinon le second capture le préfixe du premier et les deux comptes sont faux. Le même piège vaut pour les `sed` de l'étape 2, d'où les limites de mot sur `text-xl` face à `text-2xl` : sans elles, la substitution produit `text-2text-titre`. Une étape de vérification dédiée (étape 3) existe pour attraper exactement cette classe d'erreur.

Le second était dans un test que ce plan écrivait lui-même. La première version affirmait que l'interlignage décroît à mesure que la taille monte. C'est faux : les rapports sont 1,45 → 1,55 → 1,6 → 1,35 → 1,2 → 1,05. La courbe **culmine sur le corps** — le seul palier qui porte du texte suivi, donc celui qui a le plus besoin d'air — avant de redescendre. Le test aurait échoué dès le premier palier, à la tâche 1, et un implémenteur aurait pu « corriger » l'échelle pour satisfaire un test faux plutôt que l'inverse. Le test énonce désormais la vraie forme de la courbe, ce qui la documente au passage.

**Compteurs vérifiés.** Les totaux annoncés à l'étape 4 de la tâche 2 ont été recalculés depuis le relevé du dépôt : 47 + 49 + 120 + 11 + 17 + 5 + 43 (`text-xs` restant) = 292, ce qui correspond au total mesuré.

**Ce qui reste incertain et doit être tranché à l'exécution.** L'étape 5 de la tâche 1 décide si la graisse vit dans les tuples de l'échelle ou dans le balisage, selon l'ordre réel d'émission des utilitaires par Tailwind. Les deux voies satisfont la spec ; le plan donne la vérification et la solution de repli, et demande que le choix soit consigné.

# Rail de navigation, compte et logo — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le rail de navigation lisible — ordre, libellés, icône Skills — le doter d'un état déplié épinglable, corriger l'alignement de la barre active, déplacer l'identité du compte vers le héros d'Accueil, et agrandir le logo en lui donnant la boucle de Saint Gym.

**Architecture:** Les décisions qui peuvent être justes ou fausses sortent du JSX vers deux modules purs — `lib/navigation.ts` (ordre et groupes) et `lib/preferencesAffichage.ts` (épinglage persisté) — parce que le dépôt n'a **aucun socle de test de composants** et que c'est la seule façon de les couvrir. `AppShell` devient un consommateur de ces données. L'icône est désignée par une **clé** et non par un composant, ce qui garde `navigation.ts` libre de tout import React et rend la correspondance exhaustive par le typage (`Record<CleIcone, …>`) plutôt que par un test.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, motion/react 13, react-router-dom (HashRouter), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-rail-navigation-compte-logo-design.md`

## Global Constraints

- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px. Aucune valeur arbitraire (`text-[15px]`).
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet et non un espacement.
- **72 px et 200 px sont des constantes de mise en page, pas des crans d'espacement.** Le `gap-10` du rail reste l'exception déjà déclarée : le rail suit sa logique propre.
- **Le rail doit s'afficher même si `localStorage` est vide, refusé ou corrompu.** Toute lecture et toute écriture sont gardées par un `try/catch`, et le défaut est « replié ».
- **`prefers-reduced-motion` est honoré** pour la boucle du logo comme pour la transition de largeur.
- **Aucune migration de base, aucun appel réseau nouveau.** Le pseudonyme vient de `user_metadata.username` que la session porte déjà — propriété à préserver, c'est ce qui le rend disponible base injoignable.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 202 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche. Un total de 404 signifie seulement qu'un worktree traîne.
- **`preview_start` sert le dépôt racine, jamais le worktree.** Cycle : commit dans le worktree → merge local dans `master` → vérification live → push seulement si elle passe.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/lib/navigation.ts` | **créé** — ordre, groupes, libellés, clés d'icône du rail |
| `src/renderer/src/lib/navigation.test.ts` | **créé** — ordre, groupes, unicité, ancrage |
| `src/renderer/src/lib/preferencesAffichage.ts` | **créé** — lecture/écriture de l'épinglage, stockage injectable |
| `src/renderer/src/lib/preferencesAffichage.test.ts` | **créé** — défauts, corruption, stockage qui lève |
| `src/renderer/src/components/icons.tsx` | **modifié** — ajout de `SkillIcon` et `ChevronsIcon` |
| `src/renderer/src/components/AppShell.tsx` | **modifié** — consomme les données de nav, deux largeurs, barre active |
| `src/renderer/src/components/PastilleCompte.tsx` | **supprimé** — remplacé par `LigneCompte.tsx` |
| `src/renderer/src/components/LigneCompte.tsx` | **créé** — initiale seule ou initiale + pseudonyme, cliquable |
| `src/renderer/src/components/LogoMark.tsx` | **modifié** — prop `animation` en union de deux valeurs |
| `src/renderer/src/index.css` | **modifié** — keyframe `logo-ray-grow` portée de Saint Gym |
| `src/renderer/src/lib/identite.ts` | **modifié** — ajout de `salutation()` |
| `src/renderer/src/lib/identite.test.ts` | **modifié** — couverture de `salutation()` |
| `src/renderer/src/screens/Accueil.tsx` | **modifié** — héros « Bon retour \<Pseudo\>. » |
| `src/renderer/src/screens/Reglages.tsx` | **modifié** — section Compte en tête, déconnexion rapatriée |
| `src/renderer/src/components/UpdateBanner.tsx`, `screens/Login.tsx`, `screens/Introuvable.tsx` | **modifiés** — nouvelle prop de `LogoMark` |

## Écart assumé avec le découpage de la spec

La spec (§7) plaçait la mesure de la barre active *dans* le chantier 2, après le câblage des données de nav. Ce plan la sort en **tâche 2 autonome, sans aucune modification de fichier**, exécutée **avant** toute restructuration du rail : une fois le lien passé en pleine largeur, la mesure ne porte plus sur le défaut d'origine et ne peut plus ni le confirmer ni l'infirmer. L'intention de la spec — « mesure d'abord, correction ensuite » — est tenue plus strictement, pas relâchée.

---

### Task 1 : Les données de navigation et l'icône Skills

**Files:**
- Create: `src/renderer/src/lib/navigation.ts`
- Create: `src/renderer/src/lib/navigation.test.ts`
- Modify: `src/renderer/src/components/icons.tsx`

**Interfaces:**
- Consumes: rien.
- Produces: `type CleIcone = 'accueil' | 'calendrier' | 'skill' | 'projets' | 'journal' | 'bilan' | 'reglages'` ; `interface EntreeNav { to: string; libelle: string; icone: CleIcone; exact?: boolean }` ; `interface GroupeNav { entrees: EntreeNav[]; ancreEnBas?: boolean }` ; `const GROUPES_NAV: GroupeNav[]` ; `const ENTREES_NAV: EntreeNav[]`. Et le composant `SkillIcon({ size, className })` exporté depuis `components/icons.tsx`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/renderer/src/lib/navigation.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { ENTREES_NAV, GROUPES_NAV } from './navigation';

describe('groupes de navigation', () => {
  it('range les entrées par horizon de temps', () => {
    // Aujourd'hui d'abord, puis ce qui revient, puis le long terme ; puis
    // le regard en arrière, où l'on consigne avant de relire ; puis
    // Réglages, qui n'appartient à aucun des deux.
    expect(ENTREES_NAV.map((e) => e.to)).toEqual([
      '/',
      '/calendrier',
      '/skills',
      '/projets',
      '/journal',
      '/bilan',
      '/reglages',
    ]);
  });

  it('découpe en trois groupes de 4, 2 et 1', () => {
    expect(GROUPES_NAV.map((g) => g.entrees.length)).toEqual([4, 2, 1]);
  });

  it('n’ancre en bas que le dernier groupe', () => {
    expect(GROUPES_NAV.filter((g) => g.ancreEnBas)).toHaveLength(1);
    expect(GROUPES_NAV.at(-1)?.ancreEnBas).toBe(true);
  });

  it('ne cite aucune route ni aucune clé d’icône deux fois', () => {
    // Deux entrées sur la même clé d'icône rendraient le rail illisible
    // exactement comme avant ce chantier — c'est le symptôme d'origine.
    const routes = ENTREES_NAV.map((e) => e.to);
    expect(new Set(routes).size).toBe(routes.length);
    const icones = ENTREES_NAV.map((e) => e.icone);
    expect(new Set(icones).size).toBe(icones.length);
  });

  it('ne marque `exact` que la racine', () => {
    // Sans `end` sur « / », la racine reste active sur toutes les routes
    // filles ; avec `end` sur une autre entrée, celle-ci s'éteint sur ses
    // propres sous-routes (/skills/:id, /projets/:id).
    expect(ENTREES_NAV.filter((e) => e.exact).map((e) => e.to)).toEqual(['/']);
  });

  it('donne un libellé non vide à chaque entrée', () => {
    // Le libellé est le nom accessible du lien : vide, l'entrée devient
    // inatteignable au lecteur d'écran.
    for (const e of ENTREES_NAV) expect(e.libelle.trim(), e.to).not.toBe('');
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/renderer/src/lib/navigation.test.ts`
Expected: FAIL — `Failed to resolve import "./navigation"`.

- [ ] **Step 3: Écrire le module**

Créer `src/renderer/src/lib/navigation.ts` :

```ts
// La liste des entrées du rail vit ici plutôt que dans le JSX d'AppShell :
// c'est ce qui rend l'ordre et les groupes vérifiables par un test, dans un
// dépôt qui n'a aucun socle de test de composants (voir la spec, §6).
//
// L'icône est désignée par une CLÉ et non par le composant lui-même. Deux
// raisons : ce module reste libre de tout import React, donc testable sans
// moteur de rendu ; et le `Record<CleIcone, …>` d'AppShell rend la
// correspondance exhaustive par le typage — oublier une icône devient une
// erreur de compilation, pas un trou découvert à l'exécution.

export type CleIcone =
  | 'accueil'
  | 'calendrier'
  | 'skill'
  | 'projets'
  | 'journal'
  | 'bilan'
  | 'reglages';

export interface EntreeNav {
  to: string;
  /** Nom accessible du lien ET texte affiché quand le rail est déplié. */
  libelle: string;
  icone: CleIcone;
  /** Passe `end` à NavLink. Seule la racine en a besoin : sans lui, « / »
   *  resterait actif sur toutes les routes filles. */
  exact?: boolean;
}

export interface GroupeNav {
  entrees: EntreeNav[];
  /** Pousse le groupe au bas du rail. Réglages seul : il n'appartient ni
   *  au travail du jour ni au regard en arrière. */
  ancreEnBas?: boolean;
}

// L'ordre suit l'horizon de temps. L'ordre précédent — Skills avant
// Calendrier, Bilan avant Journal — ne suivait aucun raisonnement d'usage :
// une journée commence par ce qu'il y a à faire, et l'on consigne avant de
// relire.
export const GROUPES_NAV: GroupeNav[] = [
  {
    entrees: [
      { to: '/', libelle: 'Accueil', icone: 'accueil', exact: true },
      { to: '/calendrier', libelle: 'Calendrier', icone: 'calendrier' },
      { to: '/skills', libelle: 'Skills', icone: 'skill' },
      { to: '/projets', libelle: 'Projets', icone: 'projets' },
    ],
  },
  {
    entrees: [
      { to: '/journal', libelle: 'Journal', icone: 'journal' },
      { to: '/bilan', libelle: 'Bilan', icone: 'bilan' },
    ],
  },
  {
    entrees: [{ to: '/reglages', libelle: 'Réglages', icone: 'reglages' }],
    ancreEnBas: true,
  },
];

/** À plat, dans l'ordre d'affichage. Sert au test et à toute vérification
 *  qui raisonne sur les entrées sans se soucier des groupes. */
export const ENTREES_NAV: EntreeNav[] = GROUPES_NAV.flatMap((g) => g.entrees);
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run src/renderer/src/lib/navigation.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Ajouter `SkillIcon` et `ChevronsIcon` à `icons.tsx`**

Ajouter à la fin de `src/renderer/src/components/icons.tsx`, en suivant la forme exacte des icônes existantes (`viewBox="0 0 24 24"`, `strokeWidth="1.6"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`) :

```tsx
// Skills était servi par `ListIcon` — trois traits horizontaux, soit
// exactement le signe d'une liste de tâches, et sa voisine `NotebookIcon`
// porte elle aussi trois traits sur sa reliure. Aucune convention
// graphique ne porte « skill » ; « ce qui revient » en a une, et depuis la
// migration 0004 un skill est précisément un engagement sans
// `scheduled_at` — c'est-à-dire ce qui revient. D'où la flèche circulaire.
export function SkillIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  );
}

// Chevron double du bouton d'épinglage du rail. `direction` plutôt que
// deux composants : c'est le même tracé retourné, et un seul composant
// garde les deux états rigoureusement symétriques.
export function ChevronsIcon({
  size = 16,
  className,
  direction = 'droite',
}: IconProps & { direction?: 'droite' | 'gauche' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      style={direction === 'gauche' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="m7 6 6 6-6 6" />
      <path d="m14 6 6 6-6 6" />
    </svg>
  );
}
```

- [ ] **Step 6: Vérifier la suite entière et le typage**

Run: `npm test`
Expected: PASS — 202 + 6 = **208 tests**, 15 fichiers.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/navigation.ts src/renderer/src/lib/navigation.test.ts src/renderer/src/components/icons.tsx
git commit -m "feat: extract nav entries into testable data, add a skill icon"
```

---

### Task 2 : Mesurer la barre active — observation, aucun code

Cette tâche **ne modifie aucun fichier**. Elle existe parce que le constat « la barre jaune est légèrement plus basse » n'a jamais été mesuré, et qu'un correctif posé sur une cause supposée est un correctif au hasard. Elle doit être exécutée **avant** la tâche 3 : une fois le rail restructuré, la mesure ne porte plus sur le défaut d'origine.

**Files:** aucun.

**Interfaces:**
- Consumes: rien.
- Produces: un constat écrit, rapporté à l'utilisateur, qui confirme ou infirme l'hypothèse avant que la tâche 3 ne corrige.

- [ ] **Step 1: Lancer l'application**

Run: `preview_start` avec le nom du serveur de `.claude/launch.json`.
Rappel : `preview_start` sert le **dépôt racine**, jamais le worktree.

- [ ] **Step 2: Mesurer le centre de la barre et celui de son icône**

Naviguer sur `/` puis exécuter, via `javascript_tool` :

```js
const lien = document.querySelector('nav a[aria-current="page"]');
const barre = [...lien.querySelectorAll('span')].find((s) => s.offsetWidth === 3);
const icone = lien.querySelector('svg');
const cb = barre.getBoundingClientRect();
const ci = icone.getBoundingClientRect();
({
  centreBarre: cb.top + cb.height / 2,
  centreIcone: ci.top + ci.height / 2,
  ecart: (cb.top + cb.height / 2) - (ci.top + ci.height / 2),
  transformCalculee: getComputedStyle(barre).transform,
});
```

- [ ] **Step 3: Interpréter**

L'hypothèse de la spec est **confirmée** si `ecart` vaut environ **+10** (la moitié de `h-5`) et que `transformCalculee` ne contient **pas** de translation verticale de `-50 %` — signe que motion a écrasé le `-translate-y-1/2` de la classe Tailwind.

Elle est **infirmée** dans tout autre cas. Un `ecart` proche de 0 signifie que le défaut est ailleurs : mesurer alors le logo (`nav svg[aria-hidden="true"]` en premier) et la barre l'un par rapport à l'autre, puisque c'est la comparaison que l'utilisateur a formulée.

- [ ] **Step 4: Rapporter avant de corriger**

Écrire le constat — les trois nombres et la conclusion — et le remonter à l'utilisateur. **Si l'hypothèse est infirmée, s'arrêter ici** et attendre son arbitrage : la tâche 3 suppose la cause connue.

- [ ] **Step 5: Arrêter le serveur**

Run: `preview_stop` avec le `serverId` rendu à l'étape 1.

---

### Task 3 : Le rail consomme les données, et la barre est recentrée

**Files:**
- Modify: `src/renderer/src/components/AppShell.tsx:8-24` (imports et liste) et `:79-125` (le `<nav>`)

**Interfaces:**
- Consumes: `GROUPES_NAV`, `CleIcone` de `lib/navigation.ts` ; `SkillIcon` de `components/icons.tsx`.
- Produces: la constante locale `ICONES: Record<CleIcone, (props: { size?: number; className?: string }) => JSX.Element>`, et une structure de lien **pleine largeur** dont les tâches 5 et 6 dépendent.

La largeur du rail reste **72 px** : cette tâche ne change que l'ordre, les groupes, le filet, et la géométrie interne du lien.

- [ ] **Step 1: Remplacer les imports et la liste en tête de fichier**

Dans `AppShell.tsx`, remplacer la ligne 8 et le bloc `navItems` (lignes 14-24) par :

```tsx
import {
  HomeIcon,
  SkillIcon,
  CalendarIcon,
  FolderIcon,
  ChartIcon,
  NotebookIcon,
  GearIcon,
} from './icons';
import { GROUPES_NAV, type CleIcone } from '../lib/navigation';
```

puis, à la place de `navItems` :

```tsx
// La correspondance clé -> composant vit ici et non dans navigation.ts,
// qui doit rester libre de React pour être testable sans moteur de rendu.
// Le `Record<CleIcone, …>` la rend exhaustive : ajouter une clé sans son
// icône ne compile pas.
const ICONES: Record<CleIcone, (props: { size?: number; className?: string }) => JSX.Element> = {
  accueil: HomeIcon,
  calendrier: CalendarIcon,
  skill: SkillIcon,
  projets: FolderIcon,
  journal: NotebookIcon,
  bilan: ChartIcon,
  reglages: GearIcon,
};
```

Note : `ListIcon` n'est plus importée par `AppShell` mais **n'est pas supprimée** de `icons.tsx` — vérifier ses autres consommateurs avec `grep -rn "ListIcon" src/` avant toute suppression, qui n'est de toute façon pas au programme de ce plan.

- [ ] **Step 2: Remplacer le contenu du `<nav>`**

Remplacer les lignes 88-123 (de `<LogoMark …>` à `<PastilleCompte />` inclus) par :

```tsx
        <LogoMark width={30} height={20} animated className="relative" />
        {/* `flex-1` : c'est ce bloc, et non la pastille, qui porte
            désormais la poussée vers le bas — `mt-auto` s'applique au
            groupe Réglages à l'intérieur. */}
        <div className="relative flex w-full flex-1 flex-col items-center gap-3">
          {GROUPES_NAV.map((groupe, index) => (
            <Fragment key={groupe.entrees[0].to}>
              {/* Filet entre les deux premiers groupes. 12 px de part et
                  d'autre (cran 3) : la distance entre groupes se lit 24 px,
                  plus l'épaisseur du trait, qui est un filet et non un
                  espacement — même statut que `gap-px` dans la spec
                  typographique. Pas de filet devant le groupe ancré en
                  bas : `mt-auto` l'éloigne déjà sans ambiguïté. */}
              {index > 0 && !groupe.ancreEnBas && (
                <span aria-hidden="true" className="h-px w-8 shrink-0 bg-ink-700" />
              )}
              <div
                className={`flex w-full flex-col items-center gap-2 ${groupe.ancreEnBas ? 'mt-auto' : ''}`}
              >
                {groupe.entrees.map(({ to, libelle, icone, exact }) => {
                  const Icon = ICONES[icone];
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={exact}
                      title={libelle}
                      aria-label={libelle}
                      // Pleine largeur dès maintenant, même si rien n'est
                      // encore affiché à droite de l'icône : c'est ce qui
                      // permet d'ancrer la barre active au bord du RAIL et
                      // non au bord de l'icône, donc de lui garder le même
                      // x quand la tâche 5 introduira la seconde largeur.
                      // `px-4` (16 px) de chaque côté d'une icône de 40
                      // donne exactement les 72 px du rail replié.
                      className="relative flex h-10 w-full items-center rounded-[10px] px-4 text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="nav-active-bar"
                              // PIÈGE : surtout pas de `-translate-y-1/2`
                              // ici. Motion pilote `transform` en propre
                              // pendant une animation de `layoutId` et
                              // écrase la transform posée par la classe,
                              // ce qui laissait la barre 10 px trop bas —
                              // le défaut que cette tâche corrige. Le
                              // centrage passe donc par `top-0 bottom-0
                              // my-auto`, qui ne touche pas à `transform`.
                              className="absolute left-1 top-0 bottom-0 my-auto h-5 w-[3px] rounded-full bg-accent-bright"
                              style={{ boxShadow: `0 0 10px ${colors.accent.bright}b3` }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          {isActive && (
                            // La pastille est posée sur le LIEN et non sur
                            // la case d'icône : elle couvre donc la ligne
                            // entière, et s'étendra d'elle-même à 200 px
                            // quand la tâche 5 dépliera le rail, pour que
                            // l'état actif porte icône ET libellé.
                            //
                            // Conséquence visible à contrôler en live : le
                            // halo de l'élément actif fait désormais 72 px
                            // de large au lieu de 40 même rail replié.
                            // C'est voulu — c'est une ligne active, plus
                            // une case active.
                            <motion.span
                              layoutId="nav-active-pill"
                              className="absolute inset-0 rounded-[10px]"
                              style={{
                                background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 72%)`,
                              }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                            <Icon className={`relative ${isActive ? 'text-accent-bright' : ''}`} />
                          </span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
        <PastilleCompte />
```

- [ ] **Step 3: Ajouter `Fragment` à l'import de React**

Ligne 1 : `import { Fragment, useEffect, useRef } from 'react';`

- [ ] **Step 4: Retirer `mt-auto` de la pastille**

Dans `src/renderer/src/components/PastilleCompte.tsx`, la poussée vers le bas appartient désormais au bloc de nav. Remplacer `relative mt-auto mb-6 flex` par `relative mb-6 flex` dans le `className`, et corriger le commentaire juste au-dessus, qui dit encore « `mt-auto` colle la pastille en bas quelle que soit la hauteur » :

```tsx
    // `relative` pour passer devant RailFlare, qui est en `absolute` et
    // vient après dans le DOM — même raison que le bloc des liens de nav.
    // Plus de `mt-auto` ici : c'est le bloc de nav qui porte `flex-1`, donc
    // la poussée vers le bas, depuis que Réglages s'ancre en bas de ce bloc.
```

- [ ] **Step 5: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 208 tests (inchangé : aucun test ne monte de composant).

Run: `npm run typecheck`
Expected: propre. En particulier, retirer une clé de `ICONES` doit faire échouer cette commande — c'est la garantie d'exhaustivité annoncée.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/AppShell.tsx src/renderer/src/components/PastilleCompte.tsx
git commit -m "fix: reorder and group the nav rail, recenter the active bar"
```

---

### Task 4 : La préférence d'épinglage

**Files:**
- Create: `src/renderer/src/lib/preferencesAffichage.ts`
- Create: `src/renderer/src/lib/preferencesAffichage.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `const CLE_RAIL_EPINGLE: string` ; `interface StockageLike { getItem(cle: string): string | null; setItem(cle: string, valeur: string): void }` ; `lireRailEpingle(stockage?: StockageLike | null): boolean` ; `ecrireRailEpingle(epingle: boolean, stockage?: StockageLike | null): void`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/renderer/src/lib/preferencesAffichage.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  CLE_RAIL_EPINGLE,
  ecrireRailEpingle,
  lireRailEpingle,
  type StockageLike,
} from './preferencesAffichage';

function stockageFactice(initial: Record<string, string> = {}): StockageLike & { donnees: Record<string, string> } {
  const donnees = { ...initial };
  return {
    donnees,
    getItem: (cle) => donnees[cle] ?? null,
    setItem: (cle, valeur) => {
      donnees[cle] = valeur;
    },
  };
}

const stockageQuiLeve: StockageLike = {
  getItem() {
    throw new DOMException('refusé');
  },
  setItem() {
    throw new DOMException('refusé');
  },
};

describe('lireRailEpingle', () => {
  it('lit un rail épinglé', () => {
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: 'true' }))).toBe(true);
  });

  it('rend « replié » quand la clé est absente', () => {
    // Le défaut compte : c'est l'état au tout premier lancement.
    expect(lireRailEpingle(stockageFactice())).toBe(false);
  });

  it('rend « replié » sur une valeur corrompue', () => {
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: 'oui' }))).toBe(false);
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: '' }))).toBe(false);
  });

  it('rend « replié » quand le stockage lève', () => {
    // Un rail qui refuserait de se peindre parce qu'une lecture a levé
    // serait un échec absurde.
    expect(lireRailEpingle(stockageQuiLeve)).toBe(false);
  });

  it('rend « replié » sans stockage du tout', () => {
    expect(lireRailEpingle(null)).toBe(false);
  });
});

describe('ecrireRailEpingle', () => {
  it('écrit les deux états', () => {
    const s = stockageFactice();
    ecrireRailEpingle(true, s);
    expect(s.donnees[CLE_RAIL_EPINGLE]).toBe('true');
    ecrireRailEpingle(false, s);
    expect(s.donnees[CLE_RAIL_EPINGLE]).toBe('false');
  });

  it('n’explose pas quand le stockage lève', () => {
    // Perdre une préférence d'affichage ne mérite pas de faire tomber
    // l'écran qui la porte.
    expect(() => ecrireRailEpingle(true, stockageQuiLeve)).not.toThrow();
  });

  it('n’explose pas sans stockage du tout', () => {
    expect(() => ecrireRailEpingle(true, null)).not.toThrow();
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/renderer/src/lib/preferencesAffichage.test.ts`
Expected: FAIL — `Failed to resolve import "./preferencesAffichage"`.

- [ ] **Step 3: Écrire le module**

Créer `src/renderer/src/lib/preferencesAffichage.ts` :

```ts
// Premier usage de `localStorage` dans le renderer : isolé ici avec ses
// tests pour que le deuxième ne le recopie pas mal.
//
// Ce n'est délibérément PAS une colonne de `settings`. C'est une préférence
// d'affichage propre à la machine, pas au compte ; et une colonne coûterait
// une migration manuelle en tombant sous la règle « jamais de nouvelle
// colonne dans l'INSERT des réglages par défaut », dont l'échec rendrait
// tout l'écran Réglages inaccessible pour toujours.
//
// Toute lecture et toute écriture sont gardées : l'accès au stockage peut
// lever (stockage désactivé, quota, contexte sans origine), et jusqu'à
// l'accès à la propriété elle-même.

export const CLE_RAIL_EPINGLE = 'saint-daily.rail-epingle';

/** Le sous-ensemble de `Storage` réellement utilisé. Le déclarer permet
 *  d'injecter un double dans les tests, qui tournent sans jsdom — il n'y a
 *  donc aucun `localStorage` global à y fabriquer. */
export interface StockageLike {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

function stockageParDefaut(): StockageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** `false` — replié — est le défaut, et le repli de tous les cas dégradés :
 *  clé absente, valeur corrompue, stockage refusé. La comparaison stricte à
 *  `'true'` suffit à couvrir les trois. */
export function lireRailEpingle(stockage: StockageLike | null = stockageParDefaut()): boolean {
  try {
    return stockage?.getItem(CLE_RAIL_EPINGLE) === 'true';
  } catch {
    return false;
  }
}

export function ecrireRailEpingle(
  epingle: boolean,
  stockage: StockageLike | null = stockageParDefaut()
): void {
  try {
    stockage?.setItem(CLE_RAIL_EPINGLE, String(epingle));
  } catch {
    // Sans persistance, le rail garde simplement son état pour la session
    // en cours. Rien à remonter à l'utilisateur.
  }
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run src/renderer/src/lib/preferencesAffichage.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Vérifier la suite entière**

Run: `npm test`
Expected: PASS — 208 + 8 = **216 tests**, 16 fichiers.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/preferencesAffichage.ts src/renderer/src/lib/preferencesAffichage.test.ts
git commit -m "feat: persist the nav rail pin preference"
```

---

### Task 5 : Les deux largeurs et le bouton d'épinglage

**Files:**
- Modify: `src/renderer/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `lireRailEpingle`, `ecrireRailEpingle` de `lib/preferencesAffichage.ts` ; `ChevronsIcon` de `components/icons.tsx` ; `GROUPES_NAV` (déjà en place).
- Produces: les constantes locales `RAIL_REPLIE = 72` et `RAIL_DEPLIE = 200`, et l'état booléen `epingle` que la tâche 6 reçoit en prop.

- [ ] **Step 1: Ajouter les constantes et l'état**

En tête de `AppShell.tsx`, après `ICONES` :

```tsx
// Constantes de MISE EN PAGE, pas crans d'espacement — le 72 d'origine ne
// l'a jamais été non plus. 200 se calcule : 16 de marge + 40 d'icône + 12
// d'écart + 96 de colonne de libellé + 16 de marge = 180, arrondis à 200
// pour que « Calendrier » en 13 px ne soit pas serré contre le bord.
const RAIL_REPLIE = 72;
const RAIL_DEPLIE = 200;
```

Dans le corps du composant, après `hasSyncedRecurrenceRef` :

```tsx
  // Initialisation paresseuse : la lecture du stockage ne doit avoir lieu
  // qu'une fois, pas à chaque rendu du shell.
  const [epingle, setEpingle] = useState(() => lireRailEpingle());

  function basculerEpinglage() {
    setEpingle((actuel) => {
      const suivant = !actuel;
      ecrireRailEpingle(suivant);
      return suivant;
    });
  }
```

Imports à compléter :

```tsx
import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronsIcon, /* …les autres icônes… */ } from './icons';
import { ecrireRailEpingle, lireRailEpingle } from '../lib/preferencesAffichage';
```

- [ ] **Step 2: Passer le `<nav>` en largeur animée**

Remplacer l'élément `<nav …>` (sa balise ouvrante seule) par un `motion.nav` :

```tsx
      <motion.nav
        // Tween et non ressort : un ressort dépasse sa cible, et chaque
        // image de dépassement force un recalcul de mise en page de tout
        // <main>. 0,16/1/0,3/1 est la courbe déjà employée par
        // logo-ray-reveal et l'en-tête d'Accueil.
        animate={{ width: epingle ? RAIL_DEPLIE : RAIL_REPLIE }}
        initial={false}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex shrink-0 flex-col items-center gap-10 overflow-hidden border-r border-ink-700 pt-6"
        style={{
          background: `linear-gradient(180deg, ${colors.ink[900]} 0%, #054838 55%, ${colors.ink[950]} 100%)`,
        }}
      >
```

`initial={false}` évite que le rail s'anime depuis 0 au tout premier rendu. `w-[72px] min-w-[72px]` disparaît du `className` — la largeur est désormais pilotée par motion — et `shrink-0` le remplace pour que `<main>` ne comprime pas le rail.

Fermer par `</motion.nav>` au lieu de `</nav>`.

- [ ] **Step 3: Afficher le libellé dans chaque lien**

Dans le `NavLink`, juste après le `<span>` qui contient l'icône, ajouter :

```tsx
                          {/* Monté dans les deux états, jamais démonté :
                              le démonter couperait la transition en deux
                              et ferait apparaître le texte d'un bloc à la
                              fin. `aria-hidden` dans les deux états aussi,
                              parce que l'`aria-label` du lien est déjà le
                              nom accessible — sans quoi il serait annoncé
                              deux fois une fois le rail déplié. */}
                          <span
                            aria-hidden="true"
                            className={`ml-3 truncate text-secondaire transition-opacity duration-200 ${
                              epingle ? 'opacity-100' : 'pointer-events-none opacity-0'
                            } ${isActive ? 'text-accent-bright' : ''}`}
                          >
                            {libelle}
                          </span>
```

et remplacer `title={libelle}` par `title={epingle ? undefined : libelle}` : déplié, le libellé est lu à l'écran et l'infobulle n'ajoute rien.

- [ ] **Step 4: Ajouter le bouton d'épinglage**

Juste après `<PastilleCompte />` et avant `<RailFlare />` :

```tsx
        <button
          type="button"
          onClick={basculerEpinglage}
          aria-pressed={epingle}
          aria-label={epingle ? 'Replier le rail de navigation' : 'Déplier le rail de navigation'}
          title={epingle ? 'Replier le rail' : 'Déplier le rail'}
          className="relative mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
        >
          <ChevronsIcon direction={epingle ? 'gauche' : 'droite'} />
        </button>
```

Et retirer `mb-6` du `className` de `PastilleCompte` (tâche 3, étape 4) : c'est le bouton qui ferme désormais le bas du rail. La pastille garde `relative` et sa marge devient `mb-2`, l'écart interne d'un groupe — compte et bouton d'épinglage forment un groupe.

Note pour qui lit les tâches dans l'ordre : `PastilleCompte.tsx` est remplacé par `LigneCompte.tsx` à la tâche 6. Cette retouche de marge n'est donc pas perdue — elle est reprise telle quelle (`mb-2`) dans le composant qui lui succède.

- [ ] **Step 5: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 216 tests.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/AppShell.tsx src/renderer/src/components/PastilleCompte.tsx
git commit -m "feat: make the nav rail pinnable with a labelled expanded state"
```

---

### Task 6 : La pastille devient une ligne cliquable

**Files:**
- Create: `src/renderer/src/components/LigneCompte.tsx`
- Delete: `src/renderer/src/components/PastilleCompte.tsx`
- Modify: `src/renderer/src/components/AppShell.tsx` (import et usage)

**Interfaces:**
- Consumes: `initiale`, `pseudonyme` de `lib/identite.ts` ; `useAuth` de `lib/auth` ; l'état `epingle` d'`AppShell`.
- Produces: `LigneCompte({ deplie }: { deplie: boolean })`.

- [ ] **Step 1: Créer `LigneCompte.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { initiale, pseudonyme } from '../lib/identite';
import { useAuth } from '../lib/auth';

// Le compte en bas du rail. Replié, c'est l'initiale seule — la pastille
// d'origine, inchangée, y compris ses contrastes déjà vérifiés. Déplié, le
// pseudonyme entier s'affiche à côté.
//
// Contrastes sur le bas du rail, où le dégradé finit sur ink-950 :
// `border-ink-700` seul n'y donne que 2.50:1, sous le seuil de 3:1 des
// éléments non textuels — d'où le fond plein plutôt qu'une simple bordure.
// Sur ce fond ink-800, la lettre en `muted` est à 4.57:1, au-dessus du
// seuil de 4.5:1 des textes (valeur documentée dans theme/colors.ts).
// `accent-bright` est volontairement évité : il signale l'élément de nav
// actif juste au-dessus, et une pastille dorée lui disputerait ce rôle.
//
// C'est désormais un lien : il mène à la section Compte, placée en tête de
// Réglages. Pas d'ancre dans l'URL — l'application est en HashRouter, où
// le fragment porte déjà la route ; un second `#` n'y a aucun sens.
export default function LigneCompte({ deplie }: { deplie: boolean }) {
  const { session } = useAuth();
  const pseudo = pseudonyme(session?.user);
  if (!pseudo) return null;

  const libelle = `Connecté en tant que ${pseudo}`;

  return (
    // `relative` pour passer devant RailFlare, qui est en `absolute` et
    // vient après dans le DOM — même raison que le bloc des liens de nav.
    // `px-4` autour d'une case de 40 donne exactement les 72 px repliés,
    // comme les liens de nav : les deux colonnes d'icônes s'alignent.
    <Link
      to="/reglages"
      aria-label={libelle}
      title={deplie ? undefined : libelle}
      className="relative mb-2 flex h-10 w-full shrink-0 items-center rounded-[10px] px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
    >
      {/* Pas de `tracking` sur l'initiale : sur une seule lettre,
          l'interlettrage n'ajoute qu'une chasse à droite et décentre le
          glyphe. */}
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-ink-700 bg-ink-800 font-data text-corps text-muted"
      >
        {initiale(pseudo)}
      </span>
      {/* Monté dans les deux états et seulement estompé — même raison que
          les libellés de nav. `aria-hidden` parce que l'`aria-label` du
          lien porte déjà le nom accessible complet. */}
      <span
        aria-hidden="true"
        className={`ml-3 truncate text-secondaire text-muted transition-opacity duration-200 ${
          deplie ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {pseudo}
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Brancher dans `AppShell` et supprimer l'ancien composant**

Dans `AppShell.tsx` : remplacer `import PastilleCompte from './PastilleCompte';` par `import LigneCompte from './LigneCompte';`, et `<PastilleCompte />` par `<LigneCompte deplie={epingle} />`.

```bash
git rm src/renderer/src/components/PastilleCompte.tsx
```

- [ ] **Step 3: Vérifier qu'aucune référence ne survit**

Run: `grep -rn "PastilleCompte" src/`
Expected: aucune ligne. Le total se **lit**, il ne se croit pas.

- [ ] **Step 4: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 216 tests.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 5: Commit**

```bash
git add -A src/renderer/src/components
git commit -m "feat: turn the rail account badge into a link to account settings"
```

---

### Task 7 : La section Compte dans Réglages

**Files:**
- Modify: `src/renderer/src/screens/Reglages.tsx:17` (le `useAuth`), `:172` (insertion de la section), `:430-432` (retrait du bouton orphelin)

**Interfaces:**
- Consumes: `pseudonyme` de `lib/identite.ts` ; `session` et `signOut` de `useAuth`.
- Produces: la destination de tous les liens de compte créés aux tâches 6 et 8.

- [ ] **Step 1: Récupérer la session et le pseudonyme**

Ligne 17, remplacer `const { signOut } = useAuth();` par :

```tsx
  const { session, signOut } = useAuth();
```

et ajouter l'import `import { pseudonyme } from '../lib/identite';`.

Dans le corps, juste avant le `return`, après les gardes `loading` / `!settings` :

```tsx
  // Aucune requête : tout vient de la session, donc cette section reste
  // correcte même base injoignable — c'est précisément le moment où savoir
  // sur quel compte on est compte le plus.
  const pseudo = pseudonyme(session?.user);
  const email = session?.user?.email ?? null;
```

- [ ] **Step 2: Insérer la section Compte en tête**

Juste après la fermeture de `</motion.h1>` (ligne 171) et **avant** la section « Rappels », insérer :

```tsx
      {/* En tête de l'écran, et sans ancre dans l'URL : c'est ce qui permet
          aux liens du rail et du héros d'Accueil de viser simplement
          « /reglages » et d'y atterrir au bon endroit. L'application est en
          HashRouter — le fragment porte déjà la route, un second « # » n'y
          aurait aucun sens. */}
      <section className="flex flex-col gap-0">
        <h2 className="mb-1 font-data text-libelle uppercase tracking-[0.1em] text-muted">Compte</h2>
        <div className="flex items-center justify-between border-b border-ink-700 py-4">
          <div>
            <p className="text-corps text-champagne">{pseudo ?? 'Compte'}</p>
            {email && <p className="mt-1 text-secondaire text-muted">{email}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => signOut()}>
            Se déconnecter
          </Button>
        </div>
      </section>
```

- [ ] **Step 3: Retirer le bouton de déconnexion orphelin**

En fin de fichier, supprimer les trois lignes :

```tsx
      <Button variant="secondary" size="sm" className="w-fit" onClick={() => signOut()}>
        Se déconnecter
      </Button>
```

Il était hors de toute section ; il a désormais un toit.

- [ ] **Step 4: Vérifier qu'il ne reste qu'une déconnexion**

Run: `grep -c "Se déconnecter" src/renderer/src/screens/Reglages.tsx`
Expected: `1`.

- [ ] **Step 5: Vérifier tests et typage**

Run: `npm test` puis `npm run typecheck`
Expected: PASS — 216 tests ; typage propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Reglages.tsx
git commit -m "feat: add an account section at the top of settings"
```

---

### Task 8 : Le salut dans le héros d'Accueil

**Files:**
- Modify: `src/renderer/src/lib/identite.ts`
- Modify: `src/renderer/src/lib/identite.test.ts`
- Modify: `src/renderer/src/screens/Accueil.tsx:305`

**Interfaces:**
- Consumes: `pseudonyme` (déjà dans `identite.ts`) ; `useAuth`.
- Produces: `salutation(utilisateur): { avant: string; pseudo: string | null; apres: string }`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à la fin de `src/renderer/src/lib/identite.test.ts`, et compléter l'import de la première ligne en `import { initiale, pseudonyme, salutation } from './identite';` :

```ts
describe('salutation', () => {
  it('insère le pseudonyme entre les deux morceaux', () => {
    const s = salutation({ user_metadata: { username: 'Jason' } });
    expect(s).toEqual({ avant: 'Bon retour ', pseudo: 'Jason', apres: '.' });
    expect(s.avant + s.pseudo + s.apres).toBe('Bon retour Jason.');
  });

  it('rend exactement « Bon retour. » quand il n’y a rien d’affichable', () => {
    const s = salutation(null);
    expect(s.pseudo).toBeNull();
    expect(s.avant + s.apres).toBe('Bon retour.');
  });

  it('ne laisse jamais d’espace orphelin sans pseudonyme', () => {
    // Le piège que ce test garde : un `avant` resté à « Bon retour » (sans
    // point) laisserait la phrase inachevée, et « Bon retour » suivi d'une
    // espace laisserait un blanc avant le point.
    const s = salutation({});
    expect(s.avant.endsWith(' ')).toBe(false);
    expect(s.apres).toBe('');
  });

  it('retombe sur la partie locale de l’e-mail', () => {
    expect(salutation({ email: 'jason@example.com' }).pseudo).toBe('jason');
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/renderer/src/lib/identite.test.ts`
Expected: FAIL — `salutation is not a function`.

- [ ] **Step 3: Écrire `salutation()`**

Ajouter à la fin de `src/renderer/src/lib/identite.ts` :

```ts
/**
 * Les trois morceaux du salut d'accueil, le pseudonyme isolé parce qu'il
 * est le seul à être cliquable.
 *
 * Le cas sans pseudonyme n'est pas un état dégradé à rattraper dans le
 * balisage : la phrase doit alors valoir exactement « Bon retour. ». C'est
 * pour cela que `avant` porte déjà son propre point dans ce cas, plutôt que
 * de laisser l'appelant recoller une ponctuation — ce qui produirait soit
 * une phrase sans point, soit une espace orpheline devant lui.
 */
export function salutation(utilisateur: UtilisateurLike | null | undefined): {
  avant: string;
  pseudo: string | null;
  apres: string;
} {
  const pseudo = pseudonyme(utilisateur);
  if (!pseudo) return { avant: 'Bon retour.', pseudo: null, apres: '' };
  return { avant: 'Bon retour ', pseudo, apres: '.' };
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run src/renderer/src/lib/identite.test.ts`
Expected: PASS — les tests existants plus 4.

- [ ] **Step 5: Câbler le héros d'Accueil**

Dans `src/renderer/src/screens/Accueil.tsx`, ajouter les imports :

```tsx
import { useAuth } from '../lib/auth';
import { salutation } from '../lib/identite';
```

Dans le corps du composant, avec les autres hooks :

```tsx
  const { session } = useAuth();
  const salut = salutation(session?.user);
```

Puis remplacer la ligne 305 :

```tsx
        <h1 className="font-serif text-heros text-champagne">
          {salut.avant}
          {salut.pseudo && (
            // Pas de couleur d'accent : à 40 px, le pseudonyme deviendrait
            // l'élément le plus criard de l'écran au détriment du contenu.
            // Le soulignement décalé ne se montre qu'au survol et au focus.
            <Link
              to="/reglages"
              className={`underline-offset-4 hover:underline focus-visible:underline ${FOCUS_RING}`}
            >
              {salut.pseudo}
            </Link>
          )}
          {salut.apres}
        </h1>
```

`Link` et `FOCUS_RING` sont déjà présents dans ce fichier — ne pas les réimporter.

- [ ] **Step 6: Vérifier tests et typage**

Run: `npm test`
Expected: PASS — 216 + 4 = **220 tests**.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/identite.ts src/renderer/src/lib/identite.test.ts src/renderer/src/screens/Accueil.tsx
git commit -m "feat: greet the user by name on the home screen"
```

---

### Task 9 : Le logo agrandi et sa boucle

**Files:**
- Modify: `src/renderer/src/index.css`
- Modify: `src/renderer/src/components/LogoMark.tsx`
- Modify: `src/renderer/src/components/AppShell.tsx`, `src/renderer/src/components/UpdateBanner.tsx:60`, `src/renderer/src/screens/Login.tsx:56`, `src/renderer/src/screens/Introuvable.tsx:14`

**Interfaces:**
- Consumes: `LOGO_RAYS`, `LOGO_VIEWBOX` (inchangés).
- Produces: `LogoMark({ size, width, height, className, animation })` où `animation?: 'revelation' | 'boucle'`. La prop booléenne `animated` **disparaît** — tous les sites d'appel doivent être mis à jour dans cette même tâche.

- [ ] **Step 1: Porter la keyframe dans `index.css`**

Ajouter après le bloc `logo-ray-reveal` existant :

```css
/* Boucle du logo du rail (voir LogoMark.tsx, prop `animation="boucle"`).
   Portée telle quelle depuis Saint Gym (gym/app/globals.css, keyframe
   logo-ray-grow), y compris le rejet du décalage par trait : la variante
   décalée y a été testée puis écartée au profit du simultané. Ne pas
   réinterpréter ces valeurs — elles ont déjà été arbitrées.
   `--len` et `--o` sont posés par LogoMark, avec stroke-dasharray, pour
   rester auprès de la donnée qui les calcule. */
@keyframes logo-ray-grow {
  0%,
  100% {
    stroke-dashoffset: var(--len);
    opacity: calc(var(--o) * 0.2);
  }
  65% {
    stroke-dashoffset: 0;
    opacity: var(--o);
  }
}

.logo-ray-grow {
  animation: logo-ray-grow 4.5s cubic-bezier(0.33, 0, 0.2, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .logo-ray-grow {
    animation: none;
    stroke-dashoffset: 0;
    opacity: var(--o);
  }
}
```

- [ ] **Step 2: Passer `LogoMark` à l'union de props**

Dans `src/renderer/src/components/LogoMark.tsx`, remplacer la signature et le corps du `<g>` :

```tsx
export default function LogoMark({
  size = 30,
  width,
  height,
  className,
  animation,
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  /** `'revelation'` — geste d'ouverture ponctuel : chaque trait se dessine
   *  du centre vers sa longueur réelle, décalé par sa distance à l'axe,
   *  puis reste à son opacité cible. Écrans de connexion, d'erreur et
   *  bannière de mise à jour.
   *
   *  `'boucle'` — le rail, en vue permanente : tous les traits poussent
   *  ensemble puis se rétractent, sans fin. Portée de Saint Gym.
   *
   *  Une union plutôt que deux booléens : deux drapeaux qui s'excluent
   *  seraient un état illégal représentable.
   *
   *  `strokeLinecap` rond dans les deux cas : un trait qui grandit a besoin
   *  d'un bout doux, sinon il paraît tronqué en cours de dessin. */
  animation?: 'revelation' | 'boucle';
}) {
  const vb = `${LOGO_VIEWBOX.minX} ${LOGO_VIEWBOX.minY} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
  return (
    <svg width={width ?? size} height={height ?? size} viewBox={vb} className={className} aria-hidden="true">
      <g
        stroke={colors.accent.bright}
        strokeWidth="2.4"
        strokeLinecap={animation ? 'round' : 'butt'}
      >
        {LOGO_RAYS.map((r, i) => {
          if (!animation) {
            return <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeOpacity={r.o} />;
          }
          const longueur = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
          return (
            <line
              key={i}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              className={animation === 'boucle' ? 'logo-ray-grow' : 'logo-ray-reveal'}
              style={
                {
                  strokeDasharray: longueur,
                  '--len': longueur,
                  '--o': r.o,
                  // Le décalage par trait n'existe que pour la révélation :
                  // la boucle est simultanée par choix, arbitré côté Saint
                  // Gym où la variante décalée a été testée puis écartée.
                  ...(animation === 'revelation'
                    ? { '--delay': `${Math.abs(i - CENTER_INDEX) * 0.05}s` }
                    : {}),
                } as CSSProperties
              }
            />
          );
        })}
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: Mettre à jour les cinq sites d'appel**

Run: `grep -rn "<LogoMark" src/`
Expected: 5 lignes. Les traiter **toutes**, l'énumération étant la vérification :

| Fichier | Avant | Après |
|---|---|---|
| `components/AppShell.tsx` | `<LogoMark width={30} height={20} animated className="relative" />` | `<LogoMark width={48} height={32} animation="boucle" className="relative" />` |
| `components/UpdateBanner.tsx:60` | `<LogoMark width={92} height={61} animated />` | `<LogoMark width={92} height={61} animation="revelation" />` |
| `screens/Login.tsx:56` | `<LogoMark width={92} height={61} animated />` | `<LogoMark width={92} height={61} animation="revelation" />` |
| `screens/Introuvable.tsx:14` | `<LogoMark size={80} className="opacity-30" animated />` | `<LogoMark size={80} className="opacity-30" animation="revelation" />` |
| `components/EmptyState.tsx:16` | `<LogoMark size={26} className="opacity-50" />` | inchangé — aucune animation |

48 × 85 / 128 = 31,9, d'où 32 : le ratio du viewBox est respecté à l'entier près, et 48 + 12 + 12 fait exactement les 72 px du rail replié. **Même taille dans les deux états** : un logo qui grandirait avec le rail ajouterait un troisième mouvement au même endroit, en plus de la boucle et du halo qui respire.

- [ ] **Step 4: Vérifier qu'aucun `animated` ne survit**

Run: `grep -rn "animated" src/renderer/src/`
Expected: aucune occurrence sur `LogoMark`. Les totaux se lisent, ils ne se croient pas.

- [ ] **Step 5: Vérifier tests et typage**

Run: `npm test` puis `npm run typecheck`
Expected: PASS — 220 tests ; typage propre. Un site d'appel oublié **doit** faire échouer le typecheck, `animated` n'existant plus : c'est ce qui rend l'énumération fiable.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/index.css src/renderer/src/components/LogoMark.tsx src/renderer/src/components/AppShell.tsx src/renderer/src/components/UpdateBanner.tsx src/renderer/src/screens/Login.tsx src/renderer/src/screens/Introuvable.tsx
git commit -m "feat: enlarge the rail logo and give it the looping ray animation"
```

---

### Task 10 : Vérification finale

**Files:** aucun, sauf correctifs issus des constats.

- [ ] **Step 1: Énumérer les classes introduites par le diff**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9.\[\]]+" | sort -u`

Puis **vérifier que cet ensemble est inclus** dans les six rôles de texte et les sept crans d'espacement. Lister ce qui existe, puis contrôler l'inclusion — **jamais l'inverse** : un contrôle qui cherche les valeurs qu'il redoute ne trouve pas celles qu'il n'a pas imaginées. Exceptions admises et attendues dans cette liste : `px-4`, `ml-3`, `mb-2`, `mb-6`, `gap-2`, `gap-3`, `gap-10` (exception déjà déclarée du rail), `pt-6`.

- [ ] **Step 2: Suite complète et typage**

Run: `npm test`
Expected: **220 tests, 16 fichiers** — 14 existants, plus `navigation.test.ts` et `preferencesAffichage.test.ts` ; `identite.test.ts` est modifié, pas créé. Un total de 440 signifie seulement qu'un worktree traîne.

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Merge local dans master avant la vérification live**

`preview_start` lit le `launch.json` du dépôt racine et sert **toujours** `master`, jamais le worktree, silencieusement. La vérification live n'a donc de sens qu'après le merge local — et le push n'a lieu qu'après elle.

```bash
git checkout master
git merge --no-ff <branche-du-chantier>
```

- [ ] **Step 4: Vérification live**

Lancer `preview_start`, puis contrôler, dans cet ordre :

1. **Les deux largeurs** — le rail bascule de 72 à 200 px au clic sur le chevron, `<main>` est poussé et non recouvert, la transition ne tressaute pas.
2. **La persistance** — recharger la fenêtre : le rail revient dans l'état épinglé.
3. **La barre active sur les sept entrées** — reprendre la mesure de la tâche 2 sur chacune : `ecart` doit valoir 0 aux deux largeurs.
4. **L'anneau de focus** — parcourir le rail au clavier. Le `<nav>` est en `overflow-hidden` : vérifier que le `ring-offset-2` n'est pas rogné au bord gauche, notamment sur la ligne de compte et le bouton d'épinglage, qui sont nouveaux.
5. **Le salut** — « Bon retour \<Pseudo\>. » sur l'Accueil, le pseudonyme mène à Réglages et la section Compte est la première à l'écran.
6. **La déconnexion** — présente une seule fois, dans la section Compte.
7. **Le logo** — 48×32, boucle de 4,5 s.

- [ ] **Step 5: Soumettre la boucle du logo au jugement de l'utilisateur**

La réserve est consignée dans la spec (§5) et doit être reposée **après** qu'il l'a vue : une boucle en vue permanente n'a pas le même effet qu'une boucle sur un écran de maintenance, et le halo du rail respire déjà sur 6 s juste derrière — deux cycles désynchronisés dans les mêmes 72 px. Replis disponibles, par ordre de préférence : ralentir le cycle, ou ne déclencher l'animation qu'au changement de route. **La décision lui appartient.**

- [ ] **Step 6: Push, seulement si tout est passé**

```bash
git push origin master
```

Ne pas enchaîner en proposant une release : la PR de `release-please` peut rester ouverte des semaines sans que ce soit un problème.

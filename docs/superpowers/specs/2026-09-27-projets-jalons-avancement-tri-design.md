# Projets : jalons, avancement et tri — conception

## Contexte

B3 a donné au projet son temps cumulé, sa dormance et son objectif de rythme. Un chantier sait désormais **combien on y a investi** et **quand on y a touché**. Il ne sait toujours pas **où il en est** : rien ne dit si « construire une maison » en est aux fondations ou à la peinture.

Cette spec couvre les tranches **B2** et **B4** du chantier B, prises ensemble :

| | Tranche | Nature | État |
|---|---|---|---|
| B1 | Le projet devient modifiable — renommer, tags, notes, archiver, échéance | attributs, aucun calcul | à faire |
| B2 | **L'avancement** — jalons sur le projet, part franchie | *cette spec* | — |
| B3 | Temps, dormance et objectif | livré le 27 septembre 2026 | fait |
| B4 | **La liste enfin utile** — avancement, temps, dormance, et tri | *cette spec* | — |

**Elles vont ensemble parce que B4 affiche ce que B2 calcule.** La spec de B3 l'avait écrit en écartant le tri de son propre périmètre : « il appartient à B4, qui aura aussi l'avancement à trier ; trier sur deux critères maintenant et tout reprendre ensuite serait du travail jeté ». Livrer B4 sans B2 referait exactement cette erreur, un cran plus loin.

**Ce qui rend B2 beaucoup moins cher qu'il n'en a l'air.** Les jalons existent déjà, et la table les porte au bon endroit :

| Ce qu'il faudrait | Ce qui existe déjà |
|---|---|
| Une table de jalons liée au projet | `engagement_milestone`, clé sur `engagement_id` — et **un projet est un engagement** |
| Un hook | `useMilestones(engagementId)` : `{ milestones, loading, error, refresh, addMilestone, toggleMilestone }` |
| Une liste cochable | `components/MilestoneChecklist.tsx`, plus une seconde implémentation inline dans `DetailSkill` |
| Un rail de proportion | `BarreProgression`, déjà partagé par trois appelants |

**Aucune migration.** C'est la même bonne surprise que B3 : les trois champs d'objectif étaient déjà sur tout engagement ; ici c'est la table de jalons qui l'est.

Ne manquent que deux calculs — la part franchie et le tri — et une lecture groupée des jalons pour la liste.

## Ce que cette spec ne couvre pas

- **B1**, ni les chantiers C, D et E.
- **La recherche et le filtre par tag** sur la liste des projets. `ListeSkills` les porte parce qu'un utilisateur a des dizaines de skills ; une liste de projets est courte, et chercher dans cinq lignes ne sert à rien. Décision explicite, pas un oubli.
- **La persistance du tri choisi.** Voir §4 : le défaut est déjà le tri utile.
- **L'ordre des jalons.** `useMilestones` trie sur `position` et `addMilestone` pose `position: milestones.length`. Réordonner à la souris est un chantier en soi, et personne ne l'a demandé.
- **Une échéance par jalon.** `due_at` existe sur `engagement` depuis la 0016 mais pas sur `engagement_milestone`, et l'ajouter coûterait une migration pour une fonctionnalité que B1 n'a même pas encore posée sur le projet lui-même.
- **L'avancement d'un sous-projet remontant vers son parent.** Chantier E, avec sa protection contre les cycles.

## Contraintes globales

- **Aucune migration de base, aucune colonne nouvelle.**
- **Toute la logique dérivée vit dans `lib/projets.ts`, en fonctions pures.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où ce calcul peut être vérifié. Un tri fait dans un écran est un tri invérifiable.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`, qui dessine un filet.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 244 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## 1. Ce que l'avancement compte

**Les jalons du projet lui-même, et eux seuls.**

Un projet et un skill portent tous deux des jalons, mais ils ne parlent pas de la même chose. Les jalons d'un chantier sont ses livrables — « fondations », « murs », « toit ». Ceux d'un skill membre sont des étapes d'apprentissage — « maîtriser l'assemblage à queue d'aronde ». Les additionner donnerait un pourcentage qui ne veut rien dire : un skill détaillé en quinze étapes noierait les quatre livrables du chantier, et cocher une étape de menuiserie ferait « avancer la maison ».

**C'est une asymétrie assumée avec le temps cumulé, qui lui agrège les membres.** Les deux règles ont l'air incohérentes côte à côte, et elles ne le sont pas : le temps passé sur la menuiserie *est* du temps passé sur la maison, alors qu'une étape d'apprentissage de la menuiserie n'est *pas* un livrable de la maison. La spec l'écrit ici pour qu'une relecture future ne « corrige » pas l'asymétrie en croyant réparer un oubli.

```ts
avancementProjet(jalons: { completedAt: string | null }[]): { franchis: number; total: number; ratio: number }
```

Un projet **sans aucun jalon** rend `{ franchis: 0, total: 0, ratio: 0 }`. C'est à l'appelant de ne rien afficher dans ce cas plutôt qu'une barre vide à 0 % : « 0 sur 0 » dirait faussement qu'un chantier sans jalon n'a pas avancé, alors qu'il n'a rien à mesurer. Le `total: 0` est le signal, et il est explicite pour que l'écran puisse le distinguer sans deviner.

## 2. La consolidation des deux listes de jalons

L'application porte **deux implémentations divergentes** de la même liste, sur la même table et le même hook :

| | `components/MilestoneChecklist.tsx` | inline dans `DetailSkill.tsx:386-444` |
|---|---|---|
| Titre | « Sous-tâches » | « Jalons » |
| Appelants | `TaskPopover`, `Focus` | `DetailSkill` |
| Célébration au cochage | non | oui — `motion.span`, plus un état, un timeout et son nettoyage au démontage |
| Formulaire d'ajout | `NewMilestoneForm` local | un second `NewMilestoneForm`, local aussi |

Un troisième usage arrive. `BarreProgression` porte déjà en commentaire la règle que le dépôt s'est donnée dans exactement cette situation : « extrait parce que l'app en avait trois versions divergentes […] et qu'un quatrième usage aurait inventé une quatrième variante ».

**On consolide sur un seul composant**, prenant son titre en propriété, et **on lui confie la célébration**. Le composant sait de lui-même à quel instant une case passe à cochée ; la lui donner **supprime** de `DetailSkill` — un fichier de 682 lignes — l'état `celebratingMilestoneId`, son timeout et son `useEffect` de nettoyage, et efface le `NewMilestoneForm` dupliqué.

Le coût est réel et assumé : `TaskPopover` et `Focus` gagnent la pulsation en cochant une sous-tâche, et trois écrans hors périmètre sont modifiés. C'est le marché qu'on a déjà passé en extrayant `GoalSetter` pendant B3, et il s'est révélé bon — la revue finale a vérifié l'extraction ligne à ligne et n'a rien trouvé.

La pulsation sur une sous-tâche n'est pas une régression : c'est le même retour visuel pour le même geste, sur un objet qui est déjà la même ligne dans la même table.

## 3. L'écran du projet

Une section « Jalons » sous l'objectif, reprenant le motif de section déjà posé sur cet écran — `<section>` nu, `h2` en `font-sans text-corps font-semibold text-champagne`, comme « Composition » et « Objectif ».

Sous la liste, quand le projet a au moins un jalon : une `BarreProgression` et son libellé, « 3 jalons sur 7 ». C'est la forme de `GoalProgress` juste au-dessus — un libellé à gauche, la mesure à droite, le rail dessous — pour que les deux proportions de l'écran se lisent de la même façon. Quand `total` vaut zéro, ni barre ni libellé : la liste vide et son champ d'ajout suffisent à dire qu'il n'y a rien à mesurer.

## 4. La liste

Chaque ligne gagne l'avancement, à la suite de ce que B3 y a mis : « 2h 15 · Aujourd'hui · 3/7 ». Le point médian sépare déjà les deux premières ; la troisième prend le même rang. Un projet sans jalon n'affiche que les deux premières — pas de « 0/0 ».

Un sélecteur de tri rejoint l'en-tête, à côté de « + Nouveau projet », sur le motif des `select` de l'écran d'un projet.

```ts
type CritereTri = 'dormance' | 'temps' | 'avancement' | 'nom';

interface LigneProjet {
  id: string;
  nom: string;
  minutes: number;
  jours: number | null;
  avancement: number | null;
}

trierProjets(lignes: LigneProjet[], critere: CritereTri): LigneProjet[]
```

Le tri reçoit des valeurs **déjà dérivées**, jamais des engagements : c'est ce qui le rend testable sans réseau, et c'est la raison d'être de `LigneProjet`.

`avancement` est un `number | null` là où `avancementProjet` rend un objet : c'est l'écran qui traduit, `total === 0 ? null : ratio`. La fonction de tri n'a pas à connaître la différence entre « zéro jalon » et « zéro jalon franchi » — elle a juste besoin de savoir qu'il n'y a rien à comparer.

**Chaque critère a un sens unique, et il n'y a pas d'inversion.** Un sélecteur de sens doublerait les combinaisons pour n'en rendre utile aucune de plus :

| Critère | Sens | Ce qu'on cherche |
|---|---|---|
| `dormance` | `jours` décroissant | le chantier qu'on a laissé tomber |
| `temps` | `minutes` décroissant | celui où est passée la vie |
| `avancement` | `ratio` croissant | ce qu'il reste à finir |
| `nom` | alphabétique croissant | retrouver un chantier qu'on nomme |

**Le défaut est « le plus dormant en haut ».** La spec de B3 justifiait sa propre priorité ainsi : « savoir qu'un chantier n'a pas bougé depuis trois semaines est la seule information qui donne une raison d'ouvrir l'écran ». Un tri par défaut qui met cette information sous les yeux vaut mieux qu'un tri qui attend qu'on la cherche.

**Les valeurs absentes vont en bas, pour tous les critères.** `jours === null` veut dire « jamais aucune activité » et `avancement === null` « aucun jalon ». Un chantier jamais commencé n'est pas le plus négligé — il n'a pas commencé — et le placer en tête enterrerait sous lui le chantier réellement abandonné, c'est-à-dire le signal que tout ce tri existe pour montrer.

**Le tri ne persiste pas.** Il vit en état local et repart au défaut à chaque visite. Persister coûterait une colonne dans `app_settings`, donc une migration à appliquer à la main, pour épargner un clic sur un écran dont le défaut est déjà le tri utile.

La liste a besoin des jalons de **tous** les projets. `useMilestones` n'en prend qu'un : il faut un **`useAllMilestones(engagementIds)`** calqué sur `useAllPracticeEntries`, rendant un `Record<string, EngagementMilestone[]>` en une requête paginée. Mêmes règles que son modèle : identifiants **triés et dédoublonnés** par l'appelant, erreur remontée à l'écran, et le **verrou de génération** de §5.

## 5. La course que cette tranche ne doit pas rouvrir

Le 27 septembre, la vérification live de B3 a trouvé que `useAllPracticeEntries` laissait une réponse périmée écraser une réponse plus récente : `DetailProjet` interroge d'abord le seul id du projet, puis l'ensemble avec ses membres, et la première requête, en se résolvant en dernier, effaçait le résultat complet — définitivement, sans qu'aucun rendu ultérieur ne corrige. Corrigé par un verrou de génération dans les trois hooks de `usePracticeEntries.ts`.

**`useMilestones` porte le même défaut et n'a pas été corrigé** : son `refresh` ferme sur `engagementId`, qui change quand on navigue d'une fiche de skill à une autre sans démonter le composant. Cette tranche en fait un consommateur de plus et lui ajoute un frère groupé ; les deux doivent porter le verrou.

Le critère d'application est « la valeur fermée peut-elle changer pendant qu'une requête est en vol », pas « le hook prend-il des arguments ».

## 6. Ce qui se teste, et ce qui ne peut pas l'être

Les deux fonctions pures, entièrement :

| Cas | Pourquoi il compte |
|---|---|
| `avancementProjet` sur une liste vide | `total: 0`, et surtout pas une division par zéro |
| Aucun jalon franchi, puis tous | Les deux bornes du ratio |
| Un jalon franchi sur trois | Le ratio n'est pas arrondi à l'affichage par la fonction ; elle rend la fraction brute |
| `trierProjets` sur chacun des quatre critères | Un critère oublié est un `select` qui ne fait rien, et chacun a son sens propre |
| **`jours === null` et `avancement === null`** | **La règle du §4, celle qui décide si le tri montre le signal ou l'enterre** |
| Égalité sur le critère | Le tri doit rester stable, sinon deux rendus successifs échangent deux lignes sans raison |
| Liste vide | Ne doit pas jeter |

**Ce qui se vérifie à l'œil** : les jalons et leur barre sur l'écran du projet, les trois informations et le sélecteur sur la liste, la célébration sur les trois écrans qui la gagnent ou la gardent, et la liste des sous-tâches de `TaskPopover` et `Focus` inchangée par ailleurs.

Selon le cycle du dépôt — commit dans le worktree, merge local dans `master`, vérification live, push seulement si elle passe. `preview_start` sert le dépôt racine et jamais le worktree, silencieusement. Et, leçon de B3 : après une mesure qui ressemble à un aléa, **répéter** — six chargements à froid, pas un, et redémarrer le serveur de dev avant de compter.

## 7. Découpage

Cinq chantiers. Chacun laisse l'application fonctionnelle.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Le calcul** | `avancementProjet` et `trierProjets` dans `lib/projets.ts`, avec leurs tests. Aucun écran modifié. | — |
| 2 | **La liste de jalons unifiée** | Consolidation du §2 : un composant, un titre en propriété, la célébration à l'intérieur. Touche `DetailSkill`, `TaskPopover`, `Focus`. Aucun comportement nouveau. | — |
| 3 | **Les jalons du projet** | Section « Jalons » et barre d'avancement sur `DetailProjet`. Le verrou de génération sur `useMilestones`. | 1, 2 |
| 4 | **La liste** | `useAllMilestones` — avec son verrou de génération dès l'écriture, pas ajouté après — l'avancement par ligne et le sélecteur de tri sur `ListeProjets`. | 1, 3 |
| 5 | **Vérification** | Énumération des classes, suite complète, typecheck, merge local, vérification live. | 1-4 |

Le chantier 2 passe avant le 3 pour que l'écran du projet consomme d'emblée le composant consolidé, plutôt que de brancher la version courte puis de la remplacer.

**Vérification finale attendue** : les tests verts avec les ajouts, le typecheck propre, l'énumération des classes du diff incluse dans les échelles autorisées, et une vérification live portant sur un projet avec des jalons partiellement franchis, un projet sans aucun jalon, les quatre critères de tri, la place des projets sans activité et sans jalon, la célébration sur les trois écrans, et les sous-tâches d'une tâche inchangées.

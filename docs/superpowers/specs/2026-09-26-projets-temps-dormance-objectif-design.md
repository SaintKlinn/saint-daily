# Projets : temps, dormance et objectif — conception

## Contexte

Le chantier A a donné aux projets un modèle — un skill peut appartenir à plusieurs chantiers — et une composition modifiable. Il n'a rien changé au symptôme d'origine : **l'utilisateur n'ouvre pas la section Projets.** Un projet sait désormais de quoi il est fait, mais toujours pas où il en est.

Cette spec est la tranche **B3** du chantier B (« la maîtrise d'œuvre »), décomposé en quatre :

| | Tranche | Nature | Dépend de |
|---|---|---|---|
| B1 | Le projet devient modifiable — renommer, tags, notes, archiver, échéance | attributs, aucun calcul | — |
| B2 | L'avancement — jalons sur le projet, part franchie | un composant existant, une fonction pure | — |
| **B3** | **Temps, dormance et objectif** — agrégés sur les membres. *Cette spec.* | que du calcul | A |
| B4 | La liste enfin utile — avancement, temps, dormance, et tri | affichage de ce que B2 et B3 calculent | B2, B3 |

La ligne de découpe : **B1 et B2 portent ce qu'un projet *est*, B3 et B4 ce qu'il *montre*.** Le premier groupe est du CRUD sur des attributs, le second du calcul dérivé des membres.

B3 passe en premier parce que c'est la seule tranche qui répond au symptôme : **savoir qu'un chantier n'a pas bougé depuis trois semaines est la seule information qui donne une raison d'ouvrir l'écran.** B1 rend la section moins exaspérante une fois ouverte ; elle ne la fait pas ouvrir.

**La mesure du dépôt rend cette tranche beaucoup plus petite qu'elle n'en a l'air.** Les trois calculs demandés existent déjà, et aucun ne se soucie de savoir à qui appartiennent les entrées qu'on lui passe :

| Besoin | Fonction existante | Signature |
|---|---|---|
| Temps cumulé | `formatMinutes` | `(totalMinutes: number) => string` |
| Dormance | `daysSinceLastPractice` | `(entries: PracticeEntryLike[], now?) => number \| null` |
| Objectif | `computeGoalProgress` | `(entries: MotivationEntryLike[], period, metric, target, now?) => GoalProgress` |

`PracticeEntryLike` vaut `{ practicedAt }` et `MotivationEntryLike` vaut `{ practicedAt, durationMinutes }` — deux types structurels que `PracticeEntry` satisfait déjà. Et `useAllPracticeEntries(engagementIds)` ramène en **une requête paginée** un `Record<string, PracticeEntry[]>` indexé par engagement.

Il ne manque donc qu'une chose : **rassembler les entrées d'un projet**. Tout le reste est du câblage de code déjà écrit et déjà testé.

Les trois champs d'objectif — `goalPeriod`, `goalMetric`, `goalTarget` — existent sur **tout** engagement depuis la migration 0012 et ne sont simplement jamais exposés côté projet. L'objection qui avait écarté les objectifs des tâches récurrentes (« 56 occurrences porteraient 56 objectifs absurdes ») ne s'applique pas : un projet est une ligne unique.

## Ce que cette spec ne couvre pas

- **Les tranches B1, B2 et B4**, ni les chantiers C, D et E.
- **Le tri de la liste des projets.** Il appartient à B4, qui aura aussi l'avancement à trier ; trier sur deux critères maintenant et tout reprendre ensuite serait du travail jeté.
- **Un seuil de dormance.** Décision explicite, voir §3 : on affiche la date, jamais un jugement.
- **Le temps des sous-projets.** Un projet peut déjà appartenir à un projet — le modèle de A l'autorise — mais la remontée du temps d'un sous-projet vers son parent appartient au chantier E, avec sa protection contre les cycles.
- **Tout graphique.** Le Bilan existe pour ça. Un projet n'a pas besoin d'un tableau de bord pour dire s'il avance.
- **Toute migration.** Rien ici ne touche au schéma : les trois champs d'objectif sont déjà là, et le reste est dérivé.

## Contraintes globales

- **Aucune migration de base, aucune colonne nouvelle.**
- **Toute la logique dérivée vit dans `lib/projets.ts`, en fonctions pures.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où ce calcul peut être vérifié. Un calcul fait dans un écran est un calcul invérifiable.
- **Les six rôles de texte et les sept crans d'espacement** sont les seuls autorisés. Aucune valeur arbitraire.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 232 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## 1. Ce qu'on calcule

Trois fonctions neuves dans `src/renderer/src/lib/projets.ts`, à côté des quatre règles de résolution que A y a posées.

**`entreesDuProjet(entreesParEngagement, membres, projetId)`** rend les entrées de pratique d'un projet. Générique sur le type d'entrée, pour rendre à l'appelant le type concret qu'il a fourni.

**Les entrées du projet lui-même comptent, pas seulement celles de ses membres.** Un projet est un engagement, et le chantier D permettra d'y enregistrer du temps directement — une « session de chantier ». Ne compter que les membres rendrait ce temps-là invisible dans le total de son propre projet. La règle vit **dans la fonction** et non chez l'appelant, précisément pour qu'un test puisse la contredire.

**`tempsCumuleMinutes(entrees)`** somme les `durationMinutes`. Trivial, et nommé justement pour ça : noyé dans un `reduce` d'écran il serait invérifiable, alors qu'il porte la seule unité de toute la tranche.

## 2. L'écran du projet

Trois informations sous l'en-tête de `DetailProjet` : **temps cumulé**, **dernière activité**, et l'objectif quand il est posé.

L'écran compose : les membres viennent de `membresDuProjet` (chantier A), leurs identifiants plus celui du projet vont à `useAllPracticeEntries`, et le `Record` obtenu passe à `entreesDuProjet`.

**Les identifiants passés au hook doivent être triés.** `useAllPracticeEntries` mémorise sur `engagementIds.join(',')` : deux tableaux de même contenu dans un ordre différent produisent deux clés différentes et déclenchent une requête inutile à chaque rendu où l'ordre change. Le tri rend la clé stable.

## 3. La dormance

On affiche **la date de dernière activité, jamais un jugement**. « il y a 3 jours », « il y a 3 semaines », et « aucune activité » quand il n'y en a aucune.

**Ce format demande une troisième fonction pure, `formatDormance(jours: number | null): string`**, parce qu'il n'existe pas. L'application rend aujourd'hui les jours bruts — `pas pratiqué depuis ${daysSince} jours` dans les notifications de l'Accueil — ce qui convient à un skill quotidien, dont les écarts se comptent en jours. Un chantier est l'inverse : ses écarts se comptent en semaines, et « il y a 47 jours » est moins lisible que « il y a 7 semaines ». La fonction rend les jours jusqu'à 13, les semaines jusqu'à 8, puis les mois ; `null` donne « aucune activité », et zéro donne « aujourd'hui ». Elle vit dans `lib/projets.ts` avec les deux autres, et se teste aux bornes.

Pas de seuil : trois semaines sans toucher à un chantier peuvent être normales ou alarmantes selon le chantier et la saison, et l'application n'a pas les moyens de le savoir. Réutiliser le `reminderThresholdDays` des skills a été envisagé et écarté — un projet n'est pas une habitude quotidienne, et le seuil qui convient à « pratiquer la menuiserie » ne veut rien dire pour « construire une maison ». Un seuil propre aux projets a été écarté aussi : il coûterait une colonne, donc une migration manuelle, pour un réglage de plus à comprendre.

C'est l'information brute qui donne une raison d'ouvrir l'écran, pas une alerte de plus à ignorer.

## 4. La liste

Chaque ligne de `ListeProjets` gagne le temps cumulé et la dernière activité, sous le nom.

Sans cela, B3 ne livrerait rien sur l'écran que l'utilisateur n'ouvre pas — or c'est précisément la raison pour laquelle cette tranche passe en premier. Le tri reste à B4.

La liste a besoin des entrées de **tous** les projets à la fois. Elle calcule donc l'ensemble des identifiants concernés — les membres de chaque projet, plus les projets eux-mêmes — le trie, le dédoublonne, et le passe en un seul appel à `useAllPracticeEntries`, qui pagine. Une requête pour l'écran entier, pas une par projet.

## 5. L'objectif de rythme

Les trois champs existent ; `DetailSkill` a déjà son bouton « Définir l'objectif » et son formulaire. On reprend le motif tel quel plutôt que d'en inventer un second.

`computeGoalProgress` filtre déjà les entrées sur la semaine ou le mois selon `goalPeriod`, et rend `{ current, target, ratio, label }` — le `label` étant déjà rédigé en français et le `ratio` déjà plafonné à 1.

**Le total reste le chiffre principal, l'objectif apporte la fenêtre.** Les deux répondent à des questions différentes — « combien ai-je investi » et « est-ce que je tiens mon rythme » — donc aucune redondance, et aucune fenêtre à inventer pour le total.

## 6. Ce qui se teste, et ce qui ne peut pas l'être

Les trois fonctions neuves, entièrement :

| Cas | Pourquoi il compte |
|---|---|
| Projet sans membre | Ne doit pas rendre les entrées de tout le monde |
| Membres sans entrée | Zéro, pas une erreur |
| Entrées du projet lui-même | La règle du §1, celle qu'on croit évidente |
| **Un skill dans deux projets** | Son temps doit compter dans **les deux**. Conséquence directe du chantier A, et le cas qui justifie tout ce modèle |
| Un engagement absent du `Record` | Le hook n'indexe que ce qui a des entrées ; l'absence est la normale, pas une anomalie |
| `tempsCumuleMinutes` sur une liste vide | Zéro |
| `formatDormance` aux bornes | 0, 1, 13, 14, 55, 56 — les deux bascules jours/semaines/mois, plus `null` |

**Ce qui se vérifie à l'œil** : les trois informations sur l'écran du projet, les deux dans la liste, et le formulaire d'objectif. Selon le cycle du dépôt — commit dans le worktree, merge local dans `master`, vérification live, push seulement si elle passe ; `preview_start` sert le dépôt racine et jamais le worktree, silencieusement.

## 7. Découpage

Trois chantiers. Chacun laisse l'application fonctionnelle.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Le calcul** | `entreesDuProjet`, `tempsCumuleMinutes` et `formatDormance` dans `lib/projets.ts`, avec leurs tests. Aucun écran modifié. | — |
| 2 | **L'écran du projet** | Temps, dormance et objectif sur `DetailProjet`, formulaire d'objectif repris de `DetailSkill`. | 1 |
| 3 | **La liste** | Temps et dormance par ligne dans `ListeProjets`, en une requête pour l'écran. | 1 |

Les chantiers 2 et 3 sont indépendants l'un de l'autre et pourraient se faire dans l'ordre inverse ; celui-ci met d'abord l'écran où la donnée est la plus dense, ce qui fait apparaître plus tôt une éventuelle erreur de calcul.

**Vérification finale attendue** : les tests verts avec les ajouts, le typecheck propre, l'énumération des classes du diff incluse dans les échelles autorisées, et une vérification live portant sur un projet avec plusieurs membres, un skill partagé entre deux projets dont le temps apparaît des deux côtés, un projet sans aucune activité, et un objectif posé puis atteint.

# Le projet devient modifiable — conception

## Contexte

Le chantier B a donné au projet un modèle (A), son temps et sa dormance (B3), ses jalons et son avancement (B2), et une liste triable (B4). Il manque la chose la plus banale : **on ne peut rien y changer.** Un projet mal nommé le reste, ses tags sont ceux qu'on a tapés le premier jour, et un chantier terminé encombre la liste pour toujours.

Cette spec est la tranche **B1**, la dernière du chantier B.

| | Tranche | État |
|---|---|---|
| **B1** | **Renommer, tags, notes, archiver** — *cette spec* | — |
| B2 | Jalons et avancement | livré le 27 septembre 2026 |
| B3 | Temps, dormance et objectif | livré le 27 septembre 2026 |
| B4 | Liste triable | livré le 27 septembre 2026 |

**B1 passe en dernier parce qu'elle ne répondait pas au symptôme.** L'utilisateur n'ouvrait pas la section Projets ; B3 et B4 lui ont donné une raison de l'ouvrir, B2 de quoi y avancer. B1 rend la section moins exaspérante une fois ouverte, ce qui ne vaut que maintenant qu'on l'ouvre.

**Ce que la mesure du dépôt change au périmètre annoncé.** Les cinq items de B1 ne coûtent pas du tout la même chose :

| Item | Ce qui existe déjà | Ce qu'il reste |
|---|---|---|
| Notes | `NotesSection`, `DetailSkill.tsx:412` — sauvegarde au blur, bouton, confirmation, deux refs contre la double écriture | l'extraire, la brancher |
| Archiver | `setArchived(id, archived)`, `useEngagements.ts:281`, valable pour tout engagement ; le bouton existe à `DetailSkill.tsx:274` | le même bouton, plus le trou du §4 |
| Renommer, tags | rien | `updateEngagement` accepte déjà `name` et `tags` ; il manque l'interface |
| **Échéance** | la colonne `due_at` en base (migration 0016) | **tout le reste** — voir ci-dessous |

**L'échéance sort de B1 et part au chantier C.** `due_at` n'existe nulle part côté code : ni dans le type `Engagement`, ni dans le row, ni dans `fromRow`, ni dans le patch d'`updateEngagement`. L'exposer bout en bout serait faisable sans migration, mais une date que seul son propre champ affiche ne vaut pas la peine d'être saisie. Elle a besoin d'un calendrier pour s'afficher et d'une place dans les rappels, c'est-à-dire du chantier C.

**Aucune migration, et aucun changement de modèle.** `updateEngagement` accepte déjà `name`, `notes` et `tags` ; `setArchived` existe. Tout B1 est de l'interface et une fonction pure.

## Ce que cette spec ne couvre pas

- **L'échéance**, partie au chantier C avec sa raison ci-dessus.
- **Renommer un skill ou une tâche.** B1 parle des projets. `DetailSkill` n'est touché que parce qu'il héberge le composant qu'on extrait ; son en-tête ne gagne pas l'édition. Rien n'empêchera une tranche ultérieure de la lui donner — c'est précisément à ça que sert l'extraction.
- **Réordonner les tags**, ou un sélecteur de tags existants. La saisie reste une ligne séparée par des virgules, comme à la création.
- **Une corbeille pour les projets archivés.** Archiver et supprimer sont deux gestes distincts, et `BoutonSuppression` couvre déjà le second.
- **Les chantiers C, D et E.**

## Contraintes globales

- **Aucune migration de base, aucune colonne nouvelle.**
- **Toute la logique dérivée vit en fonctions pures dans `lib/`.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où un calcul peut être vérifié.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 257 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## 1. La seule chose qui se calcule

La découpe d'une saisie de tags est recopiée **quatre fois, à l'identique**, dans `NouveauProjet.tsx:25`, `NouveauSkill.tsx:30`, `NouvelleEntree.tsx:49` et `NouvelleTache.tsx:77` :

```ts
tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
```

B1 en serait la cinquième. Une seule fonction pure, dans `src/renderer/src/lib/tags.ts` :

```ts
analyserTags(saisie: string): string[]
```

Elle découpe sur la virgule, taille les blancs, jette les vides, et **dédoublonne sans tenir compte de la casse en gardant la première orthographe rencontrée**.

**Le dédoublonnage est la raison d'être de cette fonction, pas un bonus.** Les quatre copies servent des formulaires de création, remplis une fois : y saisir deux fois le même tag est rare et sans lendemain. Un champ qu'on rouvre et réenregistre est l'inverse — c'est exactement là que les doublons s'accumulent.

**Et il ignore la casse parce que le reste de l'application l'ignore déjà.** `filterByTag` (`lib/streaks.ts:112`) compare en minuscules : « Maison » et « maison » sélectionnent les mêmes éléments. Mais la liste de tags de l'écran Skills les compte séparément — `new Set(skills.flatMap((s) => s.tags))`, sensible à la casse — donc les deux apparaîtraient comme deux filtres distincts menant au même résultat. Dédoublonner à la saisie empêche cette paire de naître, sans toucher à ce qui est déjà stocké.

`filterByTag` reste où elle est. La déplacer serait du remaniement sans rapport avec ce qu'on construit.

## 2. L'édition en place

`NotesSection` est le seul idiome d'édition d'un engagement existant que l'application possède, et il est bien fait : état local, sauvegarde au blur, bouton explicite, confirmation « Notes enregistrées », et **deux refs** — `persistedRef` et `inFlightRef` — qui rendent le second appel inoffensif lorsque le clic sur « Enregistrer » déclenche d'abord le blur du champ. Ce détail-là est le genre de chose qu'une réécriture perd.

On l'extrait dans `components/ChampSauvegarde.tsx`, qui rend un `input` ou un `textarea` selon une propriété, et que `DetailSkill` comme `DetailProjet` consomment. C'est la quatrième extraction de ce genre après `GoalProgress`, `GoalSetter` et `MilestoneChecklist` ; même marché, même bénéfice, et cette fois le fichier de départ est encore celui de 494 lignes.

**Le nom est traité à part.** Le rendre champ en permanence remplacerait un `h1` en serif 28 px par une boîte bordée, sur un écran qu'on regarde bien plus souvent qu'on ne le modifie. Il reste donc du texte, et un clic le bascule en champ le temps de l'éditer, puis le blur le rend au texte. C'est un mode — mais d'un seul champ, pas de l'en-tête entier, donc il n'y a pas deux rendus d'en-tête à tenir en phase, qui était le coût du mode global.

Concrètement, le nom **utilise le même `ChampSauvegarde`** que les tags : c'est l'écran qui tient un booléen « en train d'éditer le nom », rend le `h1` quand il est faux et le `ChampSauvegarde` quand il est vrai, et le repasse à faux quand le champ perd le focus. Le composant ne connaît pas ce mode ; il ne sait que sauvegarder ce qu'on lui donne. C'est ce qui permet au nom de partager les deux refs anti-double-écriture sans que `ChampSauvegarde` gagne une variante.

Les tags et les notes sont des champs en permanence : ils ressemblent déjà à des champs, et aucune typographie n'est à protéger.

**Un nom vide n'est pas enregistré.** `name` est obligatoire à la création (`FormField required`) ; le rendre effaçable après coup produirait un projet sans nom dans toutes les listes. Le champ revient à la valeur précédente.

## 3. L'archivage du projet

Le même bouton que `DetailSkill.tsx:274` — « Archiver » / « Désarchiver » selon `archivedAt` —, appelant le `setArchived` qui existe.

**Archiver un projet n'archive pas ses membres.** Un skill appartient à plusieurs chantiers depuis le chantier A ; mettre « construire une maison » en pause ne doit pas suspendre la menuiserie qu'on pratique aussi pour l'atelier. C'est la conséquence directe du modèle, et elle mérite d'être écrite parce que la suppression, elle, fait l'inverse : elle envoie à la corbeille les engagements dont le projet est le projet principal, et l'écran le dit déjà.

## 4. La liste, et le trou qu'elle a déjà

`ListeProjets` filtre `engagements.filter((e) => e.isProject)` et rien d'autre. `useEngagements` ne filtre pas les archivés à la lecture. **Un projet archivé reste donc dans la liste, indiscernable d'un projet actif** — c'est vrai aujourd'hui, avant B1, mais personne ne pouvait archiver un projet, donc personne ne l'a vu. B1 rend l'archivage possible et doit donc fermer le trou dans le même mouvement.

La liste reprend la bascule de `ListeSkills.tsx:56` : `<Toggle bordered={false} checked={...} label="Voir les projets en pause" />`, repliée par défaut. Même composant, même place dans l'en-tête, à côté du sélecteur de tri que B4 y a mis.

Le filtrage se fait **en amont du tri**, sur la liste des projets, pas sur les lignes déjà dérivées : un projet archivé ne doit pas seulement disparaître de l'affichage, il ne doit pas non plus peser sur l'ensemble d'identifiants envoyé aux deux requêtes groupées — celle des entrées de pratique et celle des jalons.

## 5. Ce qui se teste, et ce qui ne peut pas l'être

`analyserTags`, entièrement :

| Cas | Pourquoi il compte |
|---|---|
| Saisie vide | Tableau vide, pas `['']` |
| Espaces autour des virgules | Le cas normal de la frappe |
| Virgules en trop, en tête, en fin, doublées | `,a,,b,` ne doit pas produire de tags vides |
| Deux fois le même tag | Dédoublonné |
| **« Maison » et « maison »** | **Dédoublonnés aussi, et c'est la première orthographe qui reste** — la règle du §1 |
| Saisie qui n'est que des virgules et des blancs | Tableau vide |

**Ce qui se vérifie à l'œil** : renommer un projet et voir le nom suivre dans la liste, corriger des tags et les voir dédoublonnés, écrire des notes et les retrouver après rechargement, archiver un projet et le voir quitter la liste puis revenir avec la bascule, vérifier que ses skills membres restent actifs, et vérifier que les notes d'un skill fonctionnent exactement comme avant l'extraction.

Selon le cycle du dépôt — commit dans le worktree, merge local dans `master`, vérification live, push seulement si elle passe. `preview_start` sert le dépôt racine et jamais le worktree, silencieusement. Et, leçon de B3 : après une mesure qui ressemble à un aléa, **répéter**, et redémarrer le serveur de dev avant de compter.

## 6. Découpage

Cinq chantiers. Chacun laisse l'application fonctionnelle.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Les tags** | `analyserTags` dans `lib/tags.ts` avec ses tests, et les quatre sites de création rebranchés dessus. | — |
| 2 | **Le champ sauvegardé** | `ChampSauvegarde` extrait de `NotesSection` ; `DetailSkill` le consomme. Aucun comportement nouveau. | — |
| 3 | **L'écran du projet** | Nom cliquable, tags, notes, bouton d'archivage sur `DetailProjet`. | 1, 2 |
| 4 | **La liste** | Bascule « Voir les projets en pause » et exclusion des archivés. | — |
| 5 | **Vérification** | Énumération des classes, suite, typecheck, merge local, vérification live. | 1-4 |

Le chantier 1 passe en premier parce qu'il touche quatre écrans hors périmètre et qu'un défaut y serait large ; le sortir tôt le fait relire seul, sans le bruit du reste.

**Vérification finale attendue** : les tests verts avec les ajouts, le typecheck propre, l'énumération des classes du diff incluse dans les échelles autorisées, et une vérification live couvrant les six points du §5.

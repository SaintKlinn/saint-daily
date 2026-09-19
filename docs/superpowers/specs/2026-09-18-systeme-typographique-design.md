# Système typographique et d'espacement — conception

## Contexte

L'utilisateur rapporte deux symptômes, sur tous les écrans : **« ça manque d'air »** et **« la hiérarchie est floue »**. Ni la taille du texte ni son contraste ne sont en cause — ils ont été écartés explicitement.

La mesure du dépôt explique les deux par une seule cause.

**L'app n'a pas d'échelle typographique, elle a un nuage de valeurs.** Entre 9 et 15 px, les écrans et composants utilisent **sept tailles distinctes** — 9, 10, 11, 12, 13, 14, 15 — qui portent **259 des 292 usages de texte, soit 89 %**. Sept paliers dans une bande de six pixels sont perceptuellement indistinguables : rien ne ressort, donc rien ne hiérarchise.

**Un seul des trois leviers de hiérarchie est utilisé.** `font-semibold` apparaît 33 fois et c'est la **seule** graisse déclarée de toute l'application ; tout le reste est en 400. La taille et la couleur font donc tout le travail, dans une bande de 6 px et avec deux teintes (`champagne`, `muted`).

**L'interlignage n'est jamais posé.** Les tailles sont écrites en valeurs arbitraires (`text-[13px]`), qui ne fixent que la taille — contrairement aux jetons Tailwind (`text-sm`), qui fixent taille *et* hauteur de ligne. `index.css` ne pose aucune base non plus. La quasi-totalité du texte hérite donc de `line-height: normal`, soit environ 1,2.

**Les espacements ont la même maladie, avec une conséquence plus grave.** Dix-sept valeurs distinctes (0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36 px), dont quatre demi-crans et des valeurs arbitraires (`py-[18px]`, `px-[22px]`). Surtout : les écarts dominants sont `gap-1.5` (6 px, 30 usages) et `gap-2` (8 px, 44 usages), et ils servent **aussi bien à l'intérieur d'un groupe qu'entre deux groupes**.

C'est là le cœur du problème. Quand l'écart entre un libellé et sa valeur vaut l'écart entre deux cartes, l'œil ne peut plus former de groupes : tout flotte à distance égale. Le groupement étant la forme la plus silencieuse de hiérarchie, la même cause produit les deux symptômes.

Le remède n'est donc pas « tout plus grand », ce qui donnerait une application étalée sans rien clarifier. C'est **poser deux échelles et creuser l'écart entre l'intérieur et l'extérieur des groupes**.

## Ce que cette spec ne couvre pas

- **La densité d'information elle-même** — ce qui est affiché, ce qui pourrait être replié ou retiré. Proposé à l'utilisateur, écarté au profit de la refonte du système seul. Cette spec ne change pas *ce qui* est à l'écran, seulement sa mise en forme.
- **Les couleurs.** `theme/colors.ts` reste tel quel. Les contrastes y sont documentés et vérifiés ; y toucher rouvrirait un sujet clos.
- **La taille et le contraste du texte comme sujets en soi.** Écartés par l'utilisateur. Le corps passe de 14 à 15 px, mais comme conséquence du regroupement des trois tailles courantes, pas comme objectif.
- **Le rail de navigation** (largeur 72 px, icônes sans texte) et la **grille horaire du calendrier**, dont les dimensions sont pilotées par leur logique propre (`calendarLayout.ts`) et non par l'échelle d'espacement.
- **Les écrans hors fenêtre principale** — `PomodoroOverlay` et `AgendaWidget` — traités en exception documentée (voir plus bas).

## Contraintes globales

- **Aucune valeur arbitraire de texte ou d'espacement ne doit subsister** dans `src/renderer/src/screens/` et `src/renderer/src/components/`, hors exceptions listées. C'est la condition qui rend la refonte vérifiable : après migration, `grep -rn "text-\[" screens components` doit ne renvoyer que les exceptions.
- **L'échelle est une source unique**, déclarée dans `tailwind.config.ts` sur le modèle déjà en place pour `theme/colors.ts`.
- **Les noms sont des rôles, pas des tailles.** Un composant déclare `text-corps`, jamais `text-[15px]`. C'est ce qui empêche la dérive de revenir : la question « quelle taille ? » devient « quel rôle ? », qui a une bonne réponse.
- **Chaque palier de texte porte son interlignage.** Aucun `text-*` ne doit laisser la hauteur de ligne à `normal`.
- **Le français reste la langue de l'interface**, des commentaires et des noms de rôle. Les messages de commit restent en anglais.
- **Aucune migration de base**, aucun changement de données : cette spec est entièrement côté rendu.

## 1. L'échelle typographique

Six paliers, rapport voisin de 1,3, avec un cran secondaire volontairement resserré.

| Rôle | Taille | Interlignage | Graisse | Famille | Emploi |
|---|---|---|---|---|---|
| `libelle` | 11 px | 1,45 | 600 | mono | libellés de section, puces, badges, valeurs chiffrées — toujours en capitales, avec `tracking` |
| `secondaire` | 13 px | 1,55 | 400 | sans | texte d'appoint : descriptions, légendes, compléments |
| `corps` | 15 px | 1,6 | 400 | sans | le texte courant de l'application |
| `titre` | 20 px | 1,35 | 500 | serif | titres d'élément de liste |
| `titre-ecran` | 28 px | 1,2 | 500 | serif | en-tête d'écran, et chiffre de mise en avant dans une carte |
| `heros` | 40 px | 1,15 | 400 | serif | les moments d'affichage : salutation d'accueil, nom en mode focus, minuteur Pomodoro |

**Pourquoi 15 px pour le corps.** Les trois tailles de texte courant d'aujourd'hui — 13 px (49 usages), 14 px (81) et 15 px (39), soit 169 au total — se replient sur une seule. 15 px est la plus haute des trois : le regroupement se fait donc vers le haut, ce qui améliore la lisibilité sans que ce soit l'objectif affiché.

**Pourquoi 13 px survit.** C'est le seul cran délibérément proche de son voisin (15 px). Il ne se justifie que parce qu'il porte un rôle réellement distinct — le texte d'appoint — renforcé par la couleur (`muted`) et non par les deux pixels d'écart. Toute autre proximité de cette sorte est un défaut.

**Pourquoi le saut de 15 à 20.** C'est lui qui recrée la hiérarchie. Aujourd'hui un titre d'élément à 19 px face à du corps à 15 px n'a que 4 px d'écart et se noie. 20 contre 15, avec le changement de famille (serif) et de graisse (500), donne trois signaux concordants au lieu d'un signal faible.

### Les graisses

L'application n'en utilise qu'une seule au-delà du 400 par défaut. On en utilise trois — 500 existe déjà dans Tailwind (`font-medium`), rien à déclarer, seulement à s'en servir.

| Graisse | Emploi |
|---|---|
| 400 | `corps`, `secondaire`, `heros` — à 40 px la graisse n'ajoute rien et alourdit |
| **500** | `titre` et `titre-ecran`, et la mise en valeur dans un texte courant — **nouveau** |
| 600 | `libelle` — les capitales mono à 11 px ont besoin de corps pour ne pas s'effacer — et `corps` employé en titre de section de carte |

L'ajout du 500 est ce qui permet de distinguer deux textes **de même taille** sans les éloigner d'un pixel. C'est le levier qui manquait.

**Le cas qui montre pourquoi.** Les titres de section de carte — « Objectif », « Records », « Jalons », les titres des cartes du Bilan — sont aujourd'hui à 14 px sans, en 600. Ils deviennent **`corps` en 600** : même taille que le texte qu'ils coiffent, distingués par la seule graisse. Les monter à `titre` (20 px serif) les ferait concurrencer les titres d'élément de liste, qui sont d'un rang supérieur. C'est exactement l'usage pour lequel on introduit la graisse plutôt qu'un huitième palier de taille.

## 2. L'échelle d'espacement

Sept crans, tous multiples de 4, aucun demi-cran, aucune valeur arbitraire.

| Valeur | Classe Tailwind | Rôle |
|---|---|---|
| 4 px | `1` | serré : un libellé et sa valeur, des éléments d'une même ligne |
| 8 px | `2` | interne : entre les éléments d'une carte |
| 12 px | `3` | interne large : listes, champs de formulaire |
| 16 px | `4` | rembourrage intérieur standard d'une carte |
| **24 px** | `6` | **entre groupes** : d'une carte à l'autre |
| 32 px | `8` | entre sections d'un écran |
| 48 px | `12` | page : autour de l'en-tête d'écran |

**Le saut décisif est 8 → 24.** L'écart entre groupes doit valoir trois fois l'écart interne. Aujourd'hui c'est 8 contre 8, d'où l'absence de groupement. C'est la règle la plus importante de cette spec, et celle qu'une relecture doit vérifier en premier.

**Disparaissent :** 2, 6, 10, 14, 18, 20, 22, 28, 36 px — c'est-à-dire tous les demi-crans (`0.5`, `1.5`, `2.5`, `3.5`) et toutes les valeurs arbitraires (`py-[18px]`, `px-[18px]`, `px-[22px]`).

**Reste autorisé hors échelle :** `gap-px` (5 usages), qui ne sert pas d'espacement mais à dessiner les filets de séparation des listes par la couleur de fond du conteneur (`Journal`, `Corbeille`). Ce n'est pas un espacement, c'est un trait.

## 3. Table de correspondance

Chaque valeur actuelle et sa destination. C'est la partie exécutable de la spec : une migration ne doit jamais avoir à deviner.

### Texte

| Aujourd'hui | Usages | Devient | Note |
|---|---|---|---|
| `text-[9px]` | 1 | `text-libelle` | heatmap — impose d'agrandir les cases, voir §5 |
| `text-[10px]` | 9 | `text-libelle` | puces et micro-libellés |
| `text-[11px]` | 37 | `text-libelle` | taille inchangée, gagne son interlignage |
| `text-xs` (12 px) | 43 | `text-secondaire`, **ou** `text-libelle` si le texte est en capitales | seul cas demandant un arbitrage par usage |
| `text-[13px]` | 49 | `text-secondaire` | |
| `text-sm` (14 px) | 81 | `text-corps` | les occurrences portant déjà `font-semibold` sont les titres de section de carte : elles gardent leur 600 (voir §1) |
| `text-[15px]` | 39 | `text-corps` | |
| `text-lg` (18 px) | 4 | `text-titre` | |
| `text-[19px]` | 4 | `text-titre` | titres d'élément de liste |
| `text-xl` (20 px) | 3 | `text-titre` | |
| `text-2xl` (24 px) | 6 | `text-titre-ecran` | en-têtes d'écrans de formulaire, mot-marque du login |
| `text-[26px]` | 1 | `text-titre-ecran` | chiffre de mise en avant, `SemaineVsSemaine` |
| `text-[30px]` | 9 | `text-titre-ecran` | en-têtes d'écran |
| `text-[32px]` | 1 | `text-titre-ecran` | `Introuvable` |
| `text-[34px]` | 1 | `text-heros` | salutation d'accueil |
| `text-[36px]` | 1 | `text-heros` | nom du skill, `DetailSkill` |
| `text-[38px]` | 2 | `text-heros` | nom en mode focus |
| `text-[44px]` | 1 | `text-heros` | minuteur Pomodoro |

**La règle d'arbitrage pour `text-xs`** : si la classe voisine comporte `uppercase`, c'est un libellé → `text-libelle` (11 px) ; sinon c'est du texte d'appoint → `text-secondaire` (13 px). Les deux occurrences de `Pomodoro.tsx` en `font-data text-xs uppercase tracking-[0.1em]` relèvent du premier cas.

### Espacement

| Aujourd'hui | Devient | Raison |
|---|---|---|
| `0.5` (2 px) | `1` (4 px) | demi-cran |
| `1` (4 px) | `1` | inchangé |
| `1.5` (6 px) | `2` (8 px) | demi-cran — le plus fréquent, 30 usages de `gap-1.5` |
| `2` (8 px) | `2` | inchangé |
| `2.5` (10 px) | `3` (12 px) | demi-cran |
| `3` (12 px) | `3` | inchangé |
| `3.5` (14 px) | `4` (16 px) | demi-cran |
| `4` (16 px) | `4` | inchangé |
| `5` (20 px) | `6` (24 px) | hors échelle |
| `[18px]` | `4` (16 px) | arbitraire |
| `[22px]` | `6` (24 px) | arbitraire |
| `6` (24 px) | `6` | inchangé |
| `7` (28 px) | `8` (32 px) | hors échelle |
| `8` (32 px) | `8` | inchangé |
| `9` (36 px) | `8` (32 px) | hors échelle |

**Cette table ne suffit pas à elle seule.** Une substitution mécanique conserverait l'erreur de fond, qui est que le même écart sert dedans et dehors. Chaque écran doit être repris avec la question : *cet écart sépare-t-il deux choses d'un même groupe (→ 8) ou deux groupes (→ 24) ?* Une migration qui se contente de la table produira une app aux valeurs propres et à la hiérarchie toujours floue.

## 4. Mise en œuvre

**Source unique.** Un fichier `src/renderer/src/theme/typographie.ts` exporte l'échelle, sur le modèle exact de `theme/colors.ts` : déclaré une fois, consommé par `tailwind.config.ts`. Les deux échelles y vivent — texte et espacement — parce qu'elles forment un seul système et dérivent ensemble si elles sont séparées.

**Déclaration Tailwind.** L'échelle de texte remplace `theme.fontSize` (et non `theme.extend.fontSize`) : remplacer plutôt qu'étendre supprime `text-xs`, `text-sm`, `text-base` et consorts, de sorte qu'un usage résiduel devient une classe inexistante — visible immédiatement plutôt que silencieusement rendu. Chaque entrée est un couple `[taille, { lineHeight, fontWeight? }]`.

L'échelle d'espacement, elle, **étend** plutôt qu'elle ne remplace : `theme.spacing` pilote aussi `w-`, `h-`, `inset-` et une dizaine d'autres familles dont les besoins sont géométriques et non rythmiques (la grille du calendrier, les 72 px du rail, les cases de la heatmap). Remplacer casserait ces dimensions sans rapport avec le sujet. La discipline sur les espacements est donc tenue par la relecture et par le `grep` de vérification, pas par le compilateur.

**Vérification.** Après migration, ces commandes doivent être vides hors exceptions documentées :

```
grep -rn "text-\[" src/renderer/src/screens src/renderer/src/components
grep -rn "\b\(gap\|p\|px\|py\|m\|mt\|mb\|ml\|mr\)-[0-9]*\.5\b" src/renderer/src/screens src/renderer/src/components
grep -rn "\b\(gap\|p\|px\|py\)-\[" src/renderer/src/screens src/renderer/src/components
```

**Tests.** L'échelle est une donnée, pas un comportement : elle se teste par un test de non-régression sur `typographie.ts` (les six paliers existent, chacun porte un interlignage, les valeurs sont celles de cette spec) plutôt que par des tests de rendu. Les 195 tests existants doivent rester verts — aucun ne dépend de classes de mise en forme.

## 5. Exceptions

Trois, toutes documentées dans le code à leur emplacement.

**La heatmap du Bilan.** Ses libellés de jour sont à 9 px parce que ses lignes font 11 px de haut. Sous la nouvelle échelle, 9 px n'existe plus. **Les cases passent de 11 à 13 px** et les libellés à `text-libelle` : la heatmap y gagne en lisibilité, ce qui sert le sujet. Conséquence à vérifier : la grille fait 53 colonnes, sa largeur passe d'environ 740 à 870 px — elle défile déjà dans son propre conteneur (`overflow-x-auto`), ce comportement doit être confirmé et non supposé.

**`PomodoroOverlay` et `AgendaWidget`.** Ce sont des fenêtres distinctes, minuscules, sans le contexte de la fenêtre principale. Leur échelle propre est légitime : une fenêtre de 300 px n'obéit pas au rythme d'une fenêtre de 1280. Elles adoptent l'échelle de texte, mais **conservent leurs espacements actuels**, et ce choix est écrit dans chacun des deux fichiers.

**`gap-px`.** Déjà motivé au §2 : c'est un filet, pas un espacement.

## 6. Découpage

Quatre chantiers, dans cet ordre. Chacun laisse l'application fonctionnelle et vérifiable.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Les fondations** | `theme/typographie.ts`, câblage dans `tailwind.config.ts`, son test. Aucun écran modifié — l'app compile et tourne à l'identique, les anciennes classes ayant disparu du thème, cette étape *casse* volontairement le rendu des écrans non migrés. À mener d'un trait avec le chantier 2. | — |
| 2 | **Migration mécanique du texte** | Les 292 usages de texte ramenés sur les six rôles, selon la table du §3. Y compris l'arbitrage `text-xs`. Purement substitutif. | 1 |
| 3 | **Les espacements** | Les ~200 usages, table du §3 **plus** la question dedans/dehors posée écran par écran. C'est le chantier qui produit réellement « l'air », et le seul qui demande du jugement. | 2 |
| 4 | **Les graisses et les exceptions** | Introduction du 500 là où deux textes de même taille doivent se distinguer ; heatmap agrandie ; mentions d'exception dans `PomodoroOverlay` et `AgendaWidget` ; passage des trois `grep` de vérification. | 3 |

Les chantiers 1 et 2 sont indissociables : entre les deux, l'application ne s'affiche pas correctement. Ils sont séparés pour la relecture, pas pour la livraison.

**Vérification finale attendue** : les trois `grep` du §4 vides hors exceptions, les 195 tests verts, le typecheck propre, et une vérification live des écrans nommés par l'utilisateur — Accueil, Calendrier, Bilan, Journal — sur lesquels la mesure des styles calculés doit confirmer que l'écart entre groupes vaut bien trois fois l'écart interne.

# Rail de navigation, compte et logo — conception

## Contexte

Trois griefs de l'utilisateur, tous sur le rail de gauche, tous restés hors du chantier précédent : le système typographique excluait explicitement « le rail de navigation (largeur 72 px, icônes sans texte) », dont les dimensions suivaient leur logique propre. Cette spec ouvre cette boîte.

**Les icônes ne se comprennent pas.** Le rail porte **sept destinations en icônes sans libellé**, choix de la maquette V2. La mesure désigne une coupable précise plutôt qu'un défaut général : `ListIcon`, qui sert Skills, est faite de **trois traits horizontaux** — et sa voisine `NotebookIcon`, qui sert Journal, porte elle aussi trois traits sur sa reliure. Les quatre autres (`CalendarIcon` grille datée, `FolderIcon`, `ChartIcon` barres, `HomeIcon`) sont chacune distincte. Mais aucune convention graphique ne porte « Skills » ni « Bilan » : même parfaitement dessinées, ces deux-là resteraient à deviner.

**L'ordre ne suit pas l'usage.** Aujourd'hui `Accueil · Skills · Calendrier · Projets · Bilan · Journal · Réglages` (`AppShell.tsx:16`). Skills précède Calendrier, alors qu'une journée commence par ce qu'il y a à faire aujourd'hui. Bilan précède Journal, alors qu'on consigne avant de relire. Et Réglages est dans la même colonne que le travail quotidien, sans rien qui le détache.

**La barre jaune de l'élément actif paraît légèrement trop basse.** Constat non mesuré. Une cause plausible est identifiée dans le code et devra être confirmée avant correction : la barre porte à la fois la classe Tailwind `-translate-y-1/2` et un `layoutId` motion (`AppShell.tsx:111`). Motion pilote `transform` en propre pendant une animation de layout, ce qui écrase la transform posée par la classe ; la barre retomberait alors avec son bord haut à 50 % au lieu de son milieu, soit **10 px trop bas** pour une hauteur de 20 px. La pastille voisine échappe au problème : elle est en `inset-0`, sans transform.

**La pastille de compte n'est pas au bon endroit.** L'initiale seule, en bas du rail, n'identifie le compte qu'au survol. L'utilisateur propose « Bon retour \<Pseudo\> », pseudo cliquable vers les paramètres du compte. Deux obstacles, tous deux dirimants pour la forme naïve :

1. **L'Accueil affiche déjà « Bon retour. »** en rôle `heros` (`Accueil.tsx:305`). La même phrase dans le rail la ferait lire deux fois sur le même écran.
2. **Il n'existe aucune section « Compte » dans Réglages.** Les sections sont Rappels, Pomodoro, Données, Modèles de note, À propos — et un bouton de déconnexion isolé en bas d'écran, hors de toute section (`Reglages.tsx:430`). Le lien demandé n'a pas de destination : il faut la créer.

**Le logo est trop discret.** `30×20` dans le rail, contre `92×61` dans la bannière de mise à jour et l'écran de connexion. L'utilisateur veut l'agrandir et lui donner « la même animation que le mode Maintenance de SaintGym », en boucle.

Cette animation a été retrouvée dans le dépôt voisin `gym-tracker` : keyframe **`logo-ray-grow`** (`gym/app/globals.css:126`), **4,5 s en boucle infinie**, courbe `cubic-bezier(0.33, 0, 0.2, 1)`, **tous les traits simultanés** — la variante décalée par trait a été testée puis écartée là-bas —, `stroke-dashoffset` de `--len` à 0 à **65 %** du cycle puis retour, opacité de `0.2 × o` vers `o`. Saint Daily possède déjà l'autre moitié du dispositif : `logo-ray-reveal` est la même technique, en 1 s non bouclée avec décalage par trait, et `LogoMark` pose déjà `--len`, `--o` et `strokeDasharray`. Le portage est une variante, pas une nouveauté.

**Deux contraintes du dépôt, relevées à la mesure, qui façonnent la conception :**

- **`localStorage` n'est utilisé nulle part dans le renderer.** Aucun précédent.
- **Il n'existe aucun test de composant.** Les 14 fichiers de test vivent tous dans `lib/` et `theme/`, et `package.json` ne déclare ni `jsdom`, ni `happy-dom`, ni `@testing-library/react` — seulement `vitest`. Les 202 tests sont de la logique pure. Monter le rail dans un test est hors de portée en l'état.

## Ce que cette spec ne couvre pas

- **Le socle de test de composants.** Installer `jsdom` et `@testing-library/react` est un chantier à part entière, avec sa configuration, ses conventions et sa dette. Ne pas l'entreprendre en passant est un choix délibéré ; la conséquence est assumée au §6.
- **Les cinq autres icônes de nav.** `HomeIcon`, `CalendarIcon`, `FolderIcon`, `ChartIcon`, `NotebookIcon` sont distinctes les unes des autres et les libellés règlent le reste. Les redessiner serait du travail sans symptôme.
- **Le calendrier** — vues hebdomadaire et journalière. Demande ouverte de l'utilisateur, qui mérite son propre brainstorming.
- **Les couleurs.** `theme/colors.ts` reste tel quel, contrastes documentés compris.
- **Le Pomodoro et le lien tâche ↔ skill**, également en attente, sans rapport avec le rail.
- **Toute migration de base.** Rien ici ne touche au schéma ni aux données.

## Contraintes globales

- **Conformité au système typographique.** Six rôles de texte, sept crans d'espacement, aucune valeur arbitraire. Toute classe introduite par ce chantier doit appartenir à l'ensemble permis.
- **72 px et 200 px sont des constantes de mise en page, pas des crans d'espacement.** Le 72 actuel ne l'a jamais été non plus. Elles sont déclarées explicitement, au même endroit, avec leur motif.
- **Le rail doit s'afficher même si `localStorage` est vide, refusé ou corrompu.** Un accès au stockage peut lever ; un rail qui refuserait de se peindre pour cette raison serait un échec absurde. Toute lecture et toute écriture passent par un `try/catch`, et la valeur par défaut est « replié ».
- **`prefers-reduced-motion` est honoré** pour la boucle du logo comme pour la transition de largeur. Les deux dépôts le font déjà.
- **Aucune migration, aucun appel réseau nouveau.** Le pseudonyme vient de `user_metadata.username` que la session porte déjà ; c'est ce qui le rend disponible base injoignable, propriété à préserver.
- **Le français reste la langue de l'interface et des commentaires.** Les messages de commit restent en anglais.
- **La vérification se fait par énumération, jamais par traque.** On liste ce que le diff introduit, puis on vérifie que cet ensemble est inclus dans ce qui est permis.

## 1. Le rail rétractable

Deux largeurs, un état explicite.

| État | Largeur | Contenu |
|---|---|---|
| Replié (défaut) | **72 px** | Icônes 40×40 seules, initiale du compte seule |
| Déplié | **200 px** | Icône + libellé par ligne, initiale + pseudonyme |

**200 px se calcule** : 16 px de marge, 40 px d'icône, 12 px d'écart, une colonne de libellé de 96 px suffisante pour « Calendrier » en 13 px, 16 px de marge — soit 180 px, arrondis à 200 pour laisser respirer le plus long libellé sans le serrer.

**L'épinglage est explicite, jamais le survol.** Un bouton 40×40 en `rounded-[10px]` — la grammaire des boutons de nav — sous la ligne de compte, en bas du rail. Chevron vers la droite replié, vers la gauche déplié. Le survol a été écarté : une nav qu'on vise à l'aveugle plusieurs fois par jour ne doit pas changer de largeur parce que la souris a traversé le bord gauche de l'écran.

**Le contenu est poussé, pas recouvert.** `<main>` reprend la largeur restante. C'est ce qui rend l'état lisible sans le regarder : la page entière dit dans quel mode on est.

**La transition est un tween de 0,22 s en `cubic-bezier(0.16, 1, 0.3, 1)`** — la courbe déjà employée par `logo-ray-reveal` et par l'en-tête d'Accueil. Explicitement **pas un ressort** : un ressort sur une largeur dépasse sa cible, et chaque image de dépassement force un recalcul de mise en page de tout `<main>`.

**La persistance vit dans un nouveau `src/renderer/src/lib/preferencesAffichage.ts`**, qui encapsule `localStorage` derrière deux fonctions, le stockage étant injectable pour les tests. C'est le premier usage du stockage dans le renderer ; l'isoler dans un module avec ses tests évite que le second usage le recopie mal. L'alternative — une colonne dans `settings` — a été écartée : elle coûte une migration manuelle et tombe exactement sous la règle « jamais de nouvelle colonne dans l'`INSERT` des réglages par défaut », pour une préférence qui est propre à la machine et non au compte.

**Les libellés et l'accessibilité.** Le libellé reste **monté dans les deux états** et ne change que d'opacité : le démonter couperait la transition en deux et ferait apparaître le texte d'un coup à la fin. Replié, il est donc en `opacity-0` et `pointer-events-none`.

Il est `aria-hidden` dans les deux états, et l'`aria-label` du lien reste la source unique du nom accessible — sans cela, déplié, le nom serait annoncé deux fois. Le `title` d'infobulle ne subsiste que replié, où il est la seule façon de lire la destination à la souris.

## 2. Les entrées : ordre, groupes, icône Skills

```
Accueil · Calendrier · Skills · Projets
──────────────── filet ────────────────
Journal · Bilan

Réglages                    (mt-auto, détaché en bas)
```

**La logique est l'horizon de temps.** Aujourd'hui d'abord (Accueil, Calendrier), puis ce qui revient (Skills), puis le long terme (Projets). Le second groupe est le regard en arrière : on consigne (Journal) avant de relire (Bilan). Réglages n'appartient à aucun des deux et se détache en bas.

**Espacement** : 8 px à l'intérieur d'un groupe, 24 px entre les deux, avec un **filet de 1 px centré dans cet écart**. Conforme à la règle du système, et `gap-px` y est déjà déclaré comme « filet, pas espacement ».

**La liste sort du JSX** pour devenir une donnée dans `src/renderer/src/lib/navigation.ts` : groupes, entrées, route, libellé, icône. C'est ce qui rend l'ordre testable au lieu de se relire.

**`ListIcon` est remplacée par un `SkillIcon` dédié**, une flèche circulaire. Motif : un skill est, depuis la migration 0004, un engagement sans `scheduled_at` — c'est-à-dire **ce qui revient**. « Ce qui revient » a un pictogramme conventionnel ; « skill » n'en a pas. `ListIcon` n'est pas supprimée si elle sert ailleurs.

## 3. La barre de l'élément actif

**La mesure précède la correction.** L'hypothèse du §Contexte est confirmée ou infirmée dans l'application réelle, sur les styles calculés, avant toute modification. Si la mesure désigne une autre cause, elle est rapportée avant qu'une ligne soit touchée.

**Si l'hypothèse tient**, le correctif retire la transform de la classe et centre sans elle : `top-0 bottom-0 my-auto h-5`. Motion garde alors `transform` pour lui seul, ce qui est la cause même du décalage. Un commentaire consigne le piège à l'endroit exact, car la classe a l'air inoffensive.

**La barre déménage du bouton vers la ligne.** Ancrée à gauche du rail plutôt qu'à gauche de l'icône, elle garde le **même x replié et déplié** : l'animation `layoutId` entre deux routes reste un glissement purement vertical dans les deux états. La pastille en dégradé radial s'étend à la ligne entière lorsque le rail est déplié, pour que l'état actif couvre icône *et* libellé.

## 4. Le compte

**Le salut vit dans le héros d'Accueil.** `Accueil.tsx:305` devient « Bon retour \<Pseudo\>. », toujours en rôle `heros`, le pseudonyme seul étant cliquable. C'est la lecture naturelle : un salut se lit à l'ouverture de l'app, pas dans une colonne de navigation.

**Le repli est obligatoire.** Quand `pseudonyme()` rend `null` — compte sans `username` *et* sans e-mail, cas déjà prévu par `identite.ts` —, la phrase redevient exactement « Bon retour. », sans espace orphelin ni lien vide. La composition est une **fonction pure ajoutée à `identite.ts`**, donc couverte par `identite.test.ts` qui existe déjà.

**Le pseudonyme cliquable reste en `champagne`**, avec un soulignement décalé qui n'apparaît qu'au survol et au focus. Le teindre en `accent-bright` à 40 px ferait du salut l'élément le plus criard de l'écran, au détriment du contenu.

**La destination est `/reglages`, sans ancre.** Compte devient la **première** section de l'écran, donc on y atterrit sans machinerie de défilement — que React Router ne fournit pas pour les fragments d'URL de toute façon.

**La section Compte** porte le pseudonyme, l'e-mail, et le bouton de déconnexion. Tout vient de la session : **aucune requête, aucune migration**.

**Élargissement assumé, validé par l'utilisateur** : le bouton de déconnexion est aujourd'hui orphelin en bas de Réglages, hors de toute section. Il est déplacé dans la section Compte, où il appartient. C'est le genre d'amélioration qu'on fait dans le code qu'on ouvre — pas un refactor opportuniste, puisque la section n'existe que pour lui donner un toit.

**`PastilleCompte` devient une ligne.** Replié : l'initiale 40×40 d'aujourd'hui, inchangée, contrastes documentés compris. Déplié : initiale + pseudonyme en rôle `secondaire`. L'ensemble devient un lien vers `/reglages` — donc reçoit l'anneau de focus des liens de nav, qu'il n'a pas aujourd'hui faute d'être interactif.

## 5. Le logo

**Taille : 30×20 → 48×32.** Tient dans les 72 px repliés avec 12 px de part et d'autre, et respecte le ratio 128:85 à l'entier près (48 × 85 / 128 = 31,9). **Même taille dans les deux états** : un logo qui grandirait avec le rail ajouterait un troisième mouvement au même endroit, en plus de la boucle et du halo.

**L'animation est portée telle quelle depuis SaintGym** : `logo-ray-grow`, 4,5 s, infinie, simultanée, pleine longueur à 65 % puis rétraction. Les valeurs ne sont pas réinterprétées — elles ont été arbitrées là-bas, y compris le rejet du décalage par trait.

**La prop de `LogoMark` passe d'un booléen à une union** : `animation?: 'revelation' | 'boucle'`. Deux booléens qui s'excluent seraient un état illégal représentable. **Cinq sites d'appel** sont concernés — `AppShell`, `UpdateBanner`, `Login`, `Introuvable`, `EmptyState` — et **seul le rail prend `'boucle'`** ; les autres conservent la révélation ponctuelle actuelle.

**Réserve consignée, et construite quand même comme demandé.** Une boucle de 4,5 s en vue permanente pendant le travail n'a pas le même effet qu'une boucle sur un écran de maintenance, où rien d'autre ne se passe. Et le halo du rail respire déjà sur un cycle de 6 s juste derrière : ce sont **deux boucles désynchronisées dans les mêmes 72 px**. Si la vérification live confirme la gêne, les replis, par ordre de préférence : ralentir le cycle, ou ne déclencher l'animation qu'au changement de route. La décision appartient à l'utilisateur, après l'avoir vue.

## 6. Ce qui se teste, et ce qui ne peut pas l'être

Faute de socle de test de composants (§Ce que cette spec ne couvre pas), la conception **pousse délibérément les décisions dans du pur**, là où les tests existent :

| Module | Ce qui est couvert |
|---|---|
| `lib/navigation.ts` | Ordre des entrées, composition des groupes, unicité des routes, et **couverture** : toute route de nav apparaît une fois et une seule |
| `lib/preferencesAffichage.ts` | Lecture, écriture, stockage absent, stockage qui lève, valeur corrompue, défaut « replié » |
| `lib/identite.ts` | Composition du salut et ses replis, dans `identite.test.ts` qui existe déjà |

**Ce qui ne se teste pas ici et se vérifie à l'œil dans l'application réelle** : l'alignement de la barre active (jsdom n'a pas de moteur de mise en page, et c'est précisément une question de mise en page), les deux largeurs, la transition, la lisibilité des libellés, la boucle du logo.

**Le cycle de vérification** est celui du dépôt : commit dans le worktree → merge local dans `master` → vérification live → push seulement si elle passe. `preview_start` sert le dépôt racine et jamais le worktree, silencieusement.

**Le contrôle typographique se fait par énumération** : lister toute classe de texte et d'espacement introduite par le diff, puis vérifier que cet ensemble est inclus dans ce qui est permis. Pas de `grep` des valeurs suspectes — c'est exactement ce qui avait laissé passer un `text-3xl` au chantier précédent.

## 7. Découpage

Quatre chantiers, dans cet ordre. Chacun laisse l'application fonctionnelle et vérifiable.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Les données de nav** | `lib/navigation.ts` et ses tests, `SkillIcon`, nouvel ordre et groupes câblés dans `AppShell` à largeur constante de 72 px. Le rail change d'ordre et gagne son filet, rien d'autre ne bouge. | — |
| 2 | **La barre active** | Mesure d'abord, correction ensuite. Déménagement de la barre vers la ligne. Indépendant du reste, et le seul chantier qui commence par une observation. | 1 |
| 3 | **Le rail rétractable** | `lib/preferencesAffichage.ts` et ses tests, bouton d'épinglage, deux largeurs, transition, libellés et leur accessibilité, pastille de compte devenue ligne. | 1, 2 |
| 4 | **Le compte et le logo** | Section Compte en tête de Réglages avec la déconnexion déplacée, salut dans le héros d'Accueil et sa fonction pure testée, `LogoMark` passé à l'union de props sur ses cinq sites, `logo-ray-grow` porté, logo à 48×32. | 3 |

Les chantiers 2 et 3 sont séquentiels pour une raison précise : corriger l'alignement sur un rail à largeur fixe est mesurable, le corriger pendant qu'on introduit une seconde largeur ne l'est plus.

**Vérification finale attendue** : les tests verts avec les nouveaux fichiers comptés — **202 plus les ajouts**, en se rappelant qu'un total doublé signifie seulement qu'un worktree traîne —, le typecheck propre, l'énumération des classes du diff incluse dans l'ensemble permis, et une vérification live portant sur les deux états du rail, l'alignement de la barre sur chacune des sept entrées, le salut avec pseudonyme et sans, et la boucle du logo soumise au jugement de l'utilisateur.

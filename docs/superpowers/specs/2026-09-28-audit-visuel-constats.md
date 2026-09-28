# Audit visuel — constats (2026-09-28)

Source : captures des 17 écrans de l'app principale et de l'écran de connexion,
prises dans Chromium avec un Supabase simulé :
- **compte rempli** : 5 skills, 2 projets avec jalons, 4 tâches planifiées, un an
  de séances, réflexions du soir, une entrée en corbeille ;
- **compte vide** : premier lancement, rien en base.

Les captures du compte rempli sont faites à 1280 px et à 960 px (largeur
minimale de la fenêtre), celles du compte vide à 1280 px seulement. Chaque
constat a été recoupé dans le code avant d'être noté ; ceux qui venaient des
données de test ont été écartés. Aucune erreur JavaScript pendant les 49
captures.

Les quatre constats de sévérité haute sont corrigés (voir la dernière
section). Les constats moyens et bas restent à arbitrer.

Sévérités :
- **haute** : casse la mise en page ou mène à une impasse ;
- **moyenne** : incohérence visible d'un écran à l'autre ;
- **basse** : finition.

---

## Haute (4)

- **Fiche d'une compétence — panneau latéral perdu au milieu de la page.** La
  colonne de gauche (courbe cumulée, heures, série) s'étire sur toute la
  hauteur du journal, et son contenu y est centré verticalement
  (`DetailSkill.tsx:280`, `justify-center`). Avec un an de séances, le journal
  dépasse 4 000 px et le panneau apparaît vide en haut d'écran. Correctif :
  `self-start` et `sticky top-0` sur la colonne, contenu aligné en haut.
- **Fiche d'une compétence — journal sans limite ; écran Journal plafonné.**
  - **Fiche d'une compétence :** toutes les séances étaient listées d'un bloc
    (une centaine ici), sans pagination ni regroupement.
  - **Écran Journal :** le rendu s'arrêtait à 200 lignes (et non « sans
    limite », comme l'indiquait une première version de ce rapport), mais la
    suite n'était accessible que par la recherche. Les lignes s'enchaînaient au
    même niveau visuel, chacune répétant sa date complète.
- **Impasses au premier lancement.** Sans aucun skill :
  - **Pomodoro** affiche « Aucun skill ne correspond. » et un bouton Démarrer
    grisé, sans chemin pour créer un skill ;
  - **Nouvelle entrée** propose un menu « Choisir… » vide.
- **Écran introuvable — message faux pour une adresse inconnue.** Toute route
  inconnue affiche « Ce skill n'existe plus, ou a été supprimé »
  (`Introuvable.tsx:17`), même quand l'adresse ne concerne aucun skill. Le
  texte vouvoie (« qui vous a mené ici ») alors que toute l'app tutoie.

## Moyenne (8)

- **En-têtes qui s'écrasent à 960 px.** Sur **Skills** et **Projets**, la ligne
  titre + interrupteur + tri/recherche + bouton ne passe jamais à la ligne
  (`ListeSkills.tsx:52`, `ListeProjets.tsx:111`, sans `flex-wrap`) : « Projets »
  touche « Voir les projets en pause ». L'Accueil, lui, replie déjà ses actions
  sous le titre.
- **Deux styles d'état vide.** Accueil, Journal, Bilan et Corbeille utilisent le
  cadre pointillé transparent d'`EmptyState`. Skills et Projets posent le même
  composant dans leur conteneur de liste à fond plein (`bg-ink-700`), ce qui
  donne un bloc vert clair plein.
- **Message trompeur sur Skills vide.** « Aucun skill ne correspond. » laisse
  croire qu'un filtre cache des résultats, alors qu'il n'y a aucun skill.
- **Vocabulaire mélangé.**
  - « Streak » (fiche d'une compétence : « Meilleur streak », « Streak actuel »,
    « Streak : 1 j ») côtoie « série » (Skills, Accueil, Bilan, paliers).
  - « Jalons » (fiche d'une compétence, projet) désigne la même liste que
    « Sous-tâches » (mode focus).
  - « Engagement » (titre de Nouveau projet, placeholder du Journal, Corbeille)
    est un terme interne qui n'apparaît nulle part ailleurs à l'écran.
- **Fiche projet — structure différente de la fiche compétence.**
  - Le titre est seul dans un grand cadre, sans actions.
  - Archiver et Supprimer sont au milieu de la page, avant la composition.
  - Tags et Notes ont chacun leur bouton Enregistrer.
  - La fiche compétence regroupe ses actions en haut à droite.
- **Actions de l'Accueil de trois tailles différentes.** « Reprendre Lecture »
  (petit, secondaire), « Démarrer un pomodoro » (moyen, secondaire) et
  « Nouvelle entrée » (moyen, primaire) n'ont ni la même hauteur ni la même
  taille de texte.
- **Boutons « + » incohérents.**
  - « + Nouveau skill » et « + Nouveau projet » écrivent le signe en texte.
  - « Nouvelle entrée » utilise l'icône `PlusIcon`.
  - « + Nouvelle tâche » est un lien souligné.
- **Calendrier — la grille ne montre pas l'heure qui compte.** La vue s'ouvre
  sur 07:00–15:00 dans une grille de hauteur fixe. Les tâches de 17 h et 20 h du
  jour ne sont visibles qu'en faisant défiler la grille, et la page garde un
  grand vide sous elle quand la fenêtre est haute.

## Basse (8)

- **Titres de tâche décalés.** Sur l'Accueil, une tâche sans priorité n'a pas de
  pastille : son titre commence 15 px plus à gauche que celui des autres.
- **« série de 0 j »** sur Skills : la ligne reste affichée alors qu'il n'y a pas
  de série ; « aucune série » ou rien serait plus juste.
- **Formats de durée différents.**
  - Objectif de la fiche compétence : « 0.0 h sur 3 h » (point décimal, espace
    avant « h »).
  - Ailleurs : « 20h 05 ».
- **Liste de projets peu lisible.**
  - Ligne de métadonnées : « 51h 40 · Il y a 2 jours · 2/3 » ; « 2/3 » ne dit pas
    qu'il s'agit de jalons, et « Il » garde une majuscule en milieu de ligne.
  - Aucun indicateur d'avancement, alors que chaque skill a son anneau.
- **Jalons qui débordent de la colonne.** La case à cocher est volontairement
  posée sur le filet vertical (`MilestoneChecklist.tsx:25`, marge négative). Sur
  la fiche projet et en mode focus, elle dépasse de 8 px le bord gauche du
  contenu.
- **Objectif de la fiche projet — champs mal alignés.** L'étiquette « CIBLE » et
  son champ ne sont pas sur la même ligne de base que les deux menus voisins
  (4 px d'écart), et les hauteurs diffèrent.
- **Nouvelle tâche — choix qui passent à la ligne seuls.** Dans la colonne de
  384 px, « 90 min » et « Tous les N jours » tombent seuls sur une seconde ligne.
- **Recherche du Journal tronquée.** Le placeholder « Rechercher une note, un
  tag, un engagem… » est coupé.

## Hors périmètre, à vérifier sous Windows

- **Format de date.** Le champ date-heure de Nouvelle tâche affiche le format de
  la langue du navigateur (« mm/dd/yyyy » dans la capture, faite en anglais).
  Sous un Windows en français, il devrait s'afficher en « jj/mm/aaaa ».

---

## Corrigé

- **États vides** (commit « feat: guide first steps with warmer empty states ») :
  - les impasses du premier lancement (Pomodoro, Nouvelle entrée) ;
  - le message trompeur et le style incohérent de Skills et Projets vides ;
  - les états vides sans action de l'Accueil, du Journal et du Bilan.
- **Les trois autres constats hauts** (commit « fix: resolve the high-severity
  visual audit findings ») :
  - le panneau latéral de la fiche d'une compétence, désormais en haut et
    collant ;
  - le journal de la fiche, affiché par pages de 20 ;
  - l'écran Journal, regroupé par jour avec le total de chaque journée, l'heure
    de chaque séance, et « Afficher plus » par pages de 50 ;
  - l'écran introuvable : un message par cas (adresse inconnue, élément
    supprimé définitivement, élément encore dans la corbeille, avec un lien
    vers celle-ci), au tutoiement.

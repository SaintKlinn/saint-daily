# Saint Daily — Reste du backlog "Daily Tool"

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-12

## Contexte

Le brainstorm du 6 septembre ("De traqueur de pratique à Daily Tool") a
produit 15 groupes d'idées. Le sous-projet 3 (mécaniques de tâches
avancées : priorité, report rapide, récurrence, sous-tâches, regroupement
par projet) est intégralement livré et mergé. Ce document couvre **tout
le reste du backlog**, rebrainstormé groupe par groupe le 12 septembre.

Comme pour le sous-projet 3, une seule spec couvre plusieurs chantiers
indépendants. Chaque chantier reste implémentable et livrable séparément ;
les dépendances entre eux sont explicitées en fin de document.

### Ce que cette spec ne couvre pas

Écarté délibérément pendant le brainstorm, à ne pas implémenter ici :

- **Hors-ligne & synchronisation** — un vrai mode offline-first demande un
  cache local, la réécriture de toute la couche données (`useEngagements`,
  `usePracticeEntries`, `useMilestones`, `useSettings`), une détection
  réseau fiable et une stratégie de résolution de conflit. C'est un
  chantier d'architecture à part entière : sa propre spec, précédée d'un
  spike de faisabilité.
- **Temps d'écran** (suivi passif de la fenêtre active) — abandonné.
- **Sécurité & vie privée** (verrouillage de l'app avant ouverture) — le
  groupe entier est retiré du périmètre. Windows Hello n'a de toute façon
  aucune API Electron de première partie et aurait demandé un module natif
  ou un pont WinRT ; le verrouillage par code PIN, lui, avait été conçu
  pendant le brainstorm puis écarté. L'ensemble retourne au backlog.
- **Intégration au panneau Widgets natif de Windows 11** — API Microsoft
  distincte, packaging probablement différent (MSIX), faisabilité
  incertaine pour une app Electron. Remplacé ici par une mini-fenêtre
  épinglée au bureau, construite avec la technique déjà éprouvée de
  l'overlay Pomodoro.
- **Force d'engagement** (moyenne pondérée en complément du streak brut) et
  **Wrapped annuel** — arbitrés hors périmètre du premier écran Bilan,
  restent au backlog.

---

## Contraintes globales

Ces contraintes s'appliquent à **tous** les chantiers ci-dessous.

- **Langue** : toute copie visible par l'utilisateur est en français.
- **Palette** : uniquement les jetons existants de `src/renderer/src/theme/colors.ts`
  (`ink-950/900/800/700`, `champagne`, `muted`, `accent-bright/hover/mid/deep`,
  `danger`). Aucune nouvelle couleur inventée.
- **Aucune librairie de graphiques** : le projet n'en a aucune et n'en
  ajoute pas. Toute visualisation est du SVG ou du CSS écrit à la main,
  dans l'esprit de `LogoMark`, `ProgressRing`, `RailFlare`.
- **Aucune nouvelle dépendance npm** : tout ce qui est décrit ici est
  faisable avec la stack actuelle et les API intégrées d'Electron
  (`Notification`, `globalShortcut`, `Tray`, `BrowserWindow`).
- **Base de données** : schéma `saint_daily`, accès via le client Supabase
  du renderer. Les requêtes s'appuient sur RLS pour le filtrage par
  utilisateur, comme le fait déjà `useEngagements` (pas de `.eq('user_id',…)`
  ajouté là où le code existant n'en met pas). Les migrations sont
  numérotées séquentiellement à partir de **0009** (0008 = regroupement par
  projet, déjà appliquée).
- **Logique pure dans `src/renderer/src/lib/*.ts`**, testée unitairement
  avec Vitest, sur le modèle de `streaks.ts`, `recurrence.ts`,
  `scheduling.ts`, `calendarLayout.ts`. **Pas de test de composant React** :
  la codebase n'en a aucun, ce n'est pas le moment d'en introduire.
- **Aucune écriture silencieuse** : toute erreur d'écriture est remontée à
  l'écran (`role="alert"`, texte `text-danger`), jamais avalée. Tout écran
  qui charge affiche un état de chargement explicite et un état vide
  explicite.
- **Accessibilité** : `aria-pressed` sur les boutons à bascule,
  `aria-label` sur tout contrôle icône seule, anneau de focus visible
  (`focus-visible:ring-2 ring-accent-bright`), contraste ≥ 4.5:1 pour le
  texte et ≥ 3:1 pour les indicateurs non textuels sur fond ink-800/900 —
  les règles issues de l'audit ui-ux-pro-max déjà appliquées partout
  ailleurs.
- **Modèle unifié** : une entrée de pratique à durée 0 créée en cochant une
  tâche est une entrée comme une autre. Tout calcul qui compte des
  "séances" les compte, comme le fait déjà `calculateStreak`.

---

## Migrations

Vue d'ensemble de tous les changements de schéma. Chaque chantier porte sa
propre migration ; les numéros définitifs seront attribués au moment de
l'implémentation selon l'ordre réellement exécuté.

| Chantier | Table | Changement |
|---|---|---|
| Bilan | — | aucune (agrégation en lecture seule) |
| Notifications | `app_settings` | `reminder_lead_minutes integer not null default 10` |
| Corbeille | `engagement` | `deleted_at timestamptz` |
| Données | `app_settings` | `weekly_review_dismissed_at timestamptz` |
| Pomodoro & focus | — | aucune |
| Friction réduite | — | aucune |
| Motivation | `engagement` | `goal_period text`, `goal_metric text`, `goal_target numeric` |
| Motivation | `practice_entry` | `mood text` |
| Journal | `practice_entry` | `tags text[] not null default '{}'` |
| Journal | *(nouvelle)* `note_template` | `id`, `user_id`, `text`, `position`, `created_at` |
| Rituels | `app_settings` | `morning_greeting_dismissed_date date` |
| Rituels | *(nouvelle)* `daily_reflection` | `user_id`, `date`, `text`, `created_at`, unique (user_id, date) |
| Gestes calendrier | `engagement` | `skipped_at timestamptz` |

Les deux nouvelles tables suivent les conventions des tables existantes :
RLS activée, politique par `user_id`, `created_at timestamptz not null default now()`.

---

## 1. Bilan (rétrospective & visualisation)

Nouvel écran de rétrospective, quatrième destination du rail de navigation.

### Portée

Retenu : heatmap calendrier, répartition par tag, comparaison semaine vs
semaine dernière, meilleure heure de productivité. Un cinquième widget,
**répartition par engagement**, y est rattaché depuis le groupe "Friction
réduite" (idée "comparaison de temps investi entre engagements") — même
composant que la répartition par tag, autre clé de regroupement.

Écartés : force d'engagement, Wrapped annuel.

### Données

Aucune migration. Tout dérive de `practice_entry` (qui porte déjà
`practiced_at` et `duration_minutes`) joint à `engagement` (pour `tags` et
`name`).

Nouveau hook `useAllPracticeEntriesForUser()` dans `usePracticeEntries.ts` :
récupère **toutes** les entrées de l'utilisateur en une requête, sans le
filtre `.in('engagement_id', …)` de `useAllPracticeEntries`, en s'appuyant
sur RLS comme le fait `useEngagements`. Une seule requête pour tout
l'écran.

Les entrées d'engagements archivés sont incluses : l'historique reste
l'historique même si le skill a été mis en pause depuis.

### Logique pure — `lib/retrospective.ts`

- `countEntriesByDay(entries)` → `Record<dayKey, number>`, pour la heatmap.
- `compareWeeks(entries, now)` → `{ thisWeek: { minutes, sessions }, lastWeek: { minutes, sessions } }`,
  fenêtres calculées avec le `startOfWeek` existant de `calendarLayout.ts`
  (semaine démarrant lundi, comme le Calendrier).
- `tagBreakdown(entries, engagementsById)` → liste `{ tag, minutes, sessions }`
  triée par minutes décroissantes. Une entrée dont l'engagement porte
  plusieurs tags compte **intégralement pour chacun** — c'est une
  classification multiple, pas une partition ; même sémantique que
  `filterByTag` qui correspond déjà sur "au moins un tag". Le total des
  barres peut donc dépasser le temps total pratiqué, c'est attendu.
- `engagementBreakdown(entries, engagementsById)` → même forme, clé =
  engagement.
- `timeOfDayBuckets(entries)` → quatre créneaux en heure **locale** :
  **Nuit** 0h–6h, **Matin** 6h–12h, **Après-midi** 12h–18h, **Soir**
  18h–24h. Chaque créneau porte son nombre de séances et la durée moyenne
  de ses entrées.

### Composants

Tous purs (props en entrée, aucun fetch propre) :

- `HeatmapCalendrier.tsx` — sélecteur d'engagement ("Tous les engagements"
  par défaut, puis les engagements actifs non-projet) et la grille : 53
  colonnes (semaines) × 7 lignes (jours, lundi en haut), fenêtre glissante
  des 12 derniers mois. L'intensité encode le **nombre d'entrées** du jour
  (pas les minutes), en 4 paliers — 0 / 1 / 2–3 / 4+ — du fond ink-800 vers
  `accent-bright`. Chaque case porte un `title` donnant la date et le
  compte exact : l'information ne repose jamais sur la seule couleur.
- `BarreRepartition.tsx` — liste de barres horizontales triée
  décroissante, réutilisée telle quelle par la répartition par tag **et**
  par la répartition par engagement.
- `SemaineVsSemaine.tsx` — deux blocs côte à côte façon cartes de
  l'Accueil : "Cette semaine" / "Semaine dernière", minutes totales et
  nombre de séances, tous engagements confondus.
- `MeilleureHeureProductivite.tsx` — quatre barres, hauteur proportionnelle
  au nombre de séances, durée moyenne en petit texte sous chaque barre.

Pas de sélecteur de période : tous les widgets portent sur l'historique
complet, sauf la comparaison hebdomadaire qui est par définition bornée.

### Écran et navigation

`Bilan.tsx`, route `/bilan`, entrée du rail entre Projets et Réglages,
nouvelle icône dans `icons.tsx` (glyphe type barres, même gabarit 24×24
`stroke-width` 1.6 que les icônes existantes).

Composition finale du rail une fois toute cette spec livrée : Accueil,
Skills, Calendrier, Projets, **Bilan**, **Journal** (chantier 8),
Réglages — sept entrées. C'est le plafond assumé : la Corbeille
(chantier 3) est pour cette raison accessible par un lien depuis Réglages
plutôt que par une huitième icône.

État vide explicite ("Pas encore assez d'historique") plutôt que des
graphiques vides et muets.

### Tests

Unitaires sur `retrospective.ts` : comptage par jour, frontières de
`compareWeeks` autour du lundi, ventilation multi-tags, bornes des
créneaux horaires, présence des entrées à durée 0 dans les comptages.

---

## 2. Notifications

Rappels programmés pour les engagements planifiés — brique distincte du
système actuel de "jours depuis la dernière pratique".

### Base technique déjà en place

Le renderer utilise déjà `Notification.requestPermission()` et
`new Notification(...)` pour les changements de phase Pomodoro
(`lib/pomodoro.tsx`), la fenêtre principale tourne avec
`backgroundThrottling: false`, et sa fermeture est interceptée en
`win.hide()` pour que l'app continue de tourner dans le tray. Une
vérification périodique côté renderer est donc fiable même fenêtre cachée :
**aucun nouveau mécanisme côté process principal n'est nécessaire**.

### Réglage

`app_settings` gagne `reminder_lead_minutes integer not null default 10`,
exposé comme `SkillAppSettings.reminderLeadMinutes` et câblé dans
`useSettings.ts` (`fromRow`, `toRow`, `DEFAULT_SETTINGS`). Champ numérique
dans `Reglages.tsx`, à côté de `reminderThresholdDays`.

Le réglage global existant `notificationsEnabled` gouverne ces rappels
comme il gouverne déjà ceux du Pomodoro — un seul interrupteur pour toutes
les notifications de l'app, pas de réglage par engagement.

### Logique pure — `lib/reminders.ts`

`dueReminders(engagements, entriesByEngagement, now, leadMinutes, fired)` →
`{ engagementId, kind: 'lead' | 'start', key }[]`

- **Éligibilité** : `scheduledAt` non nul, **aucune entrée de pratique
  encore associée**, non archivé, non supprimé. Le critère "aucune entrée"
  est exactement celui qu'utilise déjà `Accueil.tsx` pour sa liste "Tâches
  à faire" — une tâche déjà cochée ne déclenche plus rien.
- Deux déclencheurs par engagement éligible : *lead* à
  `scheduledAt - leadMinutes`, *start* à `scheduledAt`.
- Un déclencheur est **dû** si `now` l'a dépassé de moins de **2 minutes**.
  Au-delà, il est retourné comme dû mais marqué périmé : l'appelant le note
  comme vu sans rien afficher. C'est ainsi qu'un rappel manqué (machine en
  veille, app fermée) est **ignoré silencieusement** plutôt que déversé en
  retard.
- `fired` : clés déjà traitées, jamais renvoyées.

### Hook

`useEngagementReminders(engagements, entriesByEngagement, settings)`, monté
une seule fois dans `AppShell.tsx`, à côté de l'effet de synchronisation
des récurrences déjà présent :

- Intervalle de 20 secondes, actif seulement si `notificationsEnabled`.
- `useRef<Set<string>>` pour la déduplication ; toute clé due y est ajoutée,
  qu'elle ait été affichée ou ignorée comme périmée.
- Texte : `Rappel — {nom} dans {N} min` pour *lead*,
  `{nom} commence maintenant` pour *start*.
- Un clic sur la notification ramène la fenêtre principale au premier plan,
  même geste que le clic sur l'icône du tray.

### Tests

Unitaires sur `dueReminders` : fenêtre de tolérance, déduplication,
exclusion des tâches déjà faites, des engagements sans `scheduledAt`, des
archivés et des supprimés.

---

## 3. Corbeille (suppression définitive)

Aujourd'hui, rien n'est supprimable côté utilisateur : les skills
s'archivent (`setArchived`), les entrées et jalons ne se suppriment ni ne
s'archivent. `deleteEngagement`/`deleteEngagements` existent bien dans
`useEngagements.ts` depuis le chantier récurrence, mais uniquement pour un
usage interne (régénérer les occurrences d'une série) — aucune UI ne les
expose.

### Modèle

`engagement` gagne `deleted_at timestamptz`, dans la même famille
qu'`archived_at`. La suppression est **douce** : l'élément part à la
corbeille, d'où il peut être restauré ou purgé définitivement.

L'unité de suppression est **l'engagement**. Ses entrées de pratique et ses
jalons ne sont pas touchés : ils restent liés et réapparaissent
naturellement à la restauration, puisqu'ils ne sont visibles qu'à travers
leur engagement parent.

### Opérations — `useEngagements.ts`

- `softDelete(id)` — pose `deleted_at`. Si l'engagement est un projet,
  **cascade sur ses enfants** (`project_id = id`) avec **exactement le même
  horodatage**, calculé une seule fois côté client et réutilisé pour les
  deux écritures.
- `restore(id)` — remet `deleted_at` à null sur l'engagement, et sur les
  enfants **dont le `deleted_at` vaut précisément celui du parent**. C'est
  ce qui garantit qu'un enfant supprimé séparément *avant* le projet n'est
  pas ressuscité par erreur avec lui.
- `purge(ids)` — suppression réelle, réutilise
  `deleteEngagement`/`deleteEngagements` existants, enfin exposés à
  l'utilisateur.

Aucune purge automatique : rien ne disparaît sans un geste explicite.

### Balayage des filtres

Tous les endroits qui excluent déjà `archivedAt` doivent aussi exclure
`deleted_at` : `Accueil.tsx`, `DetailSkill.tsx`, `ListeSkills.tsx`,
`NouvelleEntree.tsx`, `Pomodoro.tsx`, `Calendrier.tsx`, `ListeProjets.tsx`,
`DetailProjet.tsx`. Même nature de balayage que la Task 2 du chantier
sous-tâches/projets — à re-grepper au moment de l'implémentation plutôt
qu'à recopier depuis cette liste, qui peut avoir vieilli.

Le balayage couvre aussi les filtres introduits par les chantiers déjà
livrés à ce moment-là, en particulier :

- l'éligibilité des rappels de `lib/reminders.ts` (chantier 2), qui doit
  cesser de notifier un engagement parti à la corbeille ;
- le paquet d'export de `lib/exportData.ts` (chantier 4), qui exclut la
  corbeille de l'archive.

Les descriptions de ces deux chantiers mentionnent déjà "non supprimé" /
"hors corbeille" : la clause ne devient effective qu'ici, quand la colonne
existe. Si l'un d'eux est livré **après** ce chantier, il l'applique
directement.

### Interface

- Bouton "Supprimer" **à deux temps** (un premier clic transforme le bouton
  en "Confirmer ?", un second confirme) dans `DetailSkill.tsx`,
  `DetailProjet.tsx` et `TaskPopover.tsx`. Pas de modale : l'app n'en a
  aucune aujourd'hui, et la corbeille rend le geste réversible.
- Nouvel écran `Corbeille.tsx`, route `/corbeille`, **accessible par un
  lien depuis Réglages** et non par une icône du rail — usage occasionnel,
  le rail est déjà chargé. Liste triée par date de suppression
  décroissante, badge Tâche / Skill / Projet par ligne, boutons
  "Restaurer" et "Supprimer définitivement" (à deux temps) par ligne, et
  "Vider la corbeille" en tête de liste.

---

## 4. Données (export et revue hebdomadaire)

### Export

Nouveau module `lib/exportData.ts`. Le paquet exporté rassemble les
engagements (y compris archivés, **hors corbeille**), les entrées de
pratique et les jalons.

- **JSON** — un seul fichier, structure imbriquée fidèle aux relations
  (chaque engagement porte ses entrées et ses jalons). C'est le format
  d'archive complet.
- **CSV** — un seul fichier à plat des entrées de pratique : date,
  engagement, tags, durée, note. C'est la vue tabulaire utile en tableur ;
  les métadonnées d'engagements et les jalons restent réservés au JSON
  plutôt que de multiplier les fichiers.

Nouvelle section "Exporter mes données" dans `Reglages.tsx`, deux boutons.
Le contenu est construit côté renderer et téléchargé via un lien
`<a download>` classique — il atterrit dans le dossier Téléchargements, ce
que l'écran indique explicitement après l'export. Aucun code côté process
principal, aucun nouveau canal IPC.

### Revue hebdomadaire

`app_settings` gagne `weekly_review_dismissed_at timestamptz`.

Bandeau sur l'Accueil, visible si ce champ est vide **ou** antérieur au
début de la semaine courante (`startOfWeek` existant) : "Ta semaine est
prête" et un lien vers `/bilan`. Cliquer le lien ou fermer le bandeau met
le champ à `now()` — il ne réapparaît qu'à la semaine suivante.

Ce n'est délibérément pas un nouvel écran : la revue hebdomadaire réutilise
le Bilan du chantier 1.

### Tests

Unitaires sur `shouldShowWeeklyReview(dismissedAt, now)` et sur
l'assemblage du paquet d'export (présence des archivés, absence de la
corbeille, échappement CSV des notes contenant virgules et guillemets).

---

## 5. Pomodoro & mode focus

### Épinglage automatique

Un bouton "épingler" manuel existe déjà (`pomodoro:set-pinned`, montre ou
cache l'overlay). **Il reste** — la question laissée ouverte par le
brainstorm du 6 septembre est tranchée ainsi : l'automatique s'ajoute par
dessus, il ne le remplace pas.

Côté process principal (`pomodoroOverlay.ts`), deux drapeaux indépendants :
`manuallyPinned` et `autoShownByMinimize`. L'overlay est visible si **l'un
ou l'autre** est vrai. On écoute `minimize` et `restore` sur la fenêtre
principale : minimiser pendant une session active lève
`autoShownByMinimize`, restaurer le baisse — sans jamais toucher à
`manuallyPinned`, pour ne pas défaire un choix explicite de l'utilisateur.

Le process principal sait déjà si une session est active : il relaie déjà
`pomodoro:state-changed`, il lui suffit de lire cet état au passage. Aucun
nouveau canal IPC.

### Aperçu au survol du tray

Le process principal n'a pas d'accès à Supabase (le client vit dans le
renderer), donc l'information doit lui être poussée. Un hook renderer
calcule le prochain engagement planifié et envoie
`tray:set-next-engagement` (nom et heure) à chaque changement ; le process
principal met à jour `tray.setToolTip(...)`, aujourd'hui figé sur
"Saint Daily".

### Lancer un Pomodoro depuis l'agenda

`TaskPopover.tsx` gagne le même lien "Démarrer un pomodoro" que
`DetailSkill.tsx` possède déjà, avec le même mécanisme de pré-sélection de
l'engagement.

### Mode focus

Mode **indépendant du Pomodoro** : on peut s'y mettre sans lancer de
minuteur.

Nouvelle route `/focus/:engagementId`, écran pleine largeur **sans le rail
de navigation** (layout à part, pas une fenêtre Electron séparée) :
uniquement le nom de l'engagement, ses tags, ses jalons s'il en a, et la
possibilité de démarrer un Pomodoro depuis là. Une sortie explicite ramène
à l'écran précédent.

Accessible par un bouton "Focus" depuis `TaskPopover.tsx` et
`DetailSkill.tsx` — l'engagement est choisi explicitement, jamais deviné.

---

## 6. Friction réduite

### Raccourci clavier global

`globalShortcut.register` côté process principal, combinaison fixe pour ce
premier jet (`Ctrl+Alt+N`) : montre ou restaure la fenêtre principale, puis
un IPC demande au renderer de naviguer vers `/entrees/nouvelle`. Rendre la
combinaison configurable est une amélioration ultérieure, pas de ce
chantier.

### Reprendre où j'en étais

Bouton sur l'Accueil : trouve l'engagement dont la dernière entrée est la
plus récente et navigue vers le Pomodoro pré-sélectionné dessus. Réutilise
le mécanisme de pré-sélection du chantier 5.

### Enchaîner des Pomodoros sur des engagements différents

Aujourd'hui une session Pomodoro est liée à un seul engagement du début à
la fin. Un sélecteur d'engagement apparaît **entre deux phases** (à la fin
d'une phase, avant que la suivante démarre) dans l'écran Pomodoro : il
change la cible de la prochaine phase de travail sans interrompre le
minuteur. Le changement ne peut pas se produire en plein milieu d'une phase
de travail — le temps déjà couru resterait imputé à un engagement qu'on
vient de quitter.

### Comparaison de temps entre engagements

Rattachée au **Bilan** (chantier 1) sous forme d'un widget "Répartition par
engagement", réutilisant le composant `BarreRepartition.tsx`. Pas d'écran
séparé.

### Widget agenda sur le bureau

Nouvelle fenêtre Electron sans bordure, toujours au-dessus, dans un
nouveau fichier `src/main/agendaWidget.ts` bâti sur la même structure que
`pomodoroOverlay.ts` (fenêtre cachée créée au démarrage, `skipTaskbar`,
`setAlwaysOnTop`, fermeture interceptée en `hide()`). Elle affiche les
engagements planifiés du jour, alimentés par un IPC poussé depuis le
renderer sur le modèle de `pomodoro:state-changed`. Affichage et masquage
depuis le menu du tray.

---

## 7. Motivation

### Objectifs hebdomadaires et mensuels

`engagement` gagne `goal_period` (`hebdomadaire` | `mensuel` | null),
`goal_metric` (`heures` | `seances` | null) et `goal_target` (numérique,
null), avec contraintes `check` sur les deux champs texte, dans le style de
`priority` et `recurrence_type`.

S'applique aux skills **et aux tâches récurrentes**, soit
`!isProject && (recurrenceType !== 'aucune' || !scheduledAt)` — ni les
projets (qui ne se pratiquent pas) ni les tâches ponctuelles (dont la
planification tient déjà lieu d'engagement).

Nouveau composant `GoalProgress.tsx` : barre de progression comparant les
entrées de la période courante à la cible. La fenêtre hebdomadaire réutilise
`startOfWeek` ; une fonction `startOfMonth` est ajoutée à
`calendarLayout.ts` pour la fenêtre mensuelle. Configuration depuis
`DetailSkill.tsx`.

### Badges calculés

Les "jalons semi-automatiques" sont traités comme des **badges dérivés**,
sans aucune donnée stockée : tout est recalculable depuis l'historique
existant. Fonction pure `computeBadges(entries)` dans un nouveau
`lib/badges.ts`, seuils retenus :

- 7 jours d'affilée
- 30 jours d'affilée
- 10 heures cumulées
- 100 séances

Affichés en petits badges sur `DetailSkill.tsx`. Ils ne se mélangent pas
aux jalons manuels de `engagement_milestone`, qui restent une checklist
rédigée par l'utilisateur.

### Meilleur streak jamais atteint

Nouvelle fonction pure `calculateBestStreak(entries)` dans `streaks.ts` :
parcourt tout l'historique pour trouver la plus longue suite de jours
consécutifs, pas seulement celle qui se termine aujourd'hui. Aucune donnée
stockée. Affiché à côté du streak courant.

### Humeur par entrée

`practice_entry` gagne `mood text` avec
`check (mood in ('difficile','moyen','correct','bien','excellent'))`,
nullable — l'humeur reste optionnelle.

Sélecteur dans `NouvelleEntree.tsx` uniquement. Le "Marquer comme faite"
d'une tâche depuis le popover ne le propose pas : ce geste doit rester
instantané.

### Tests

Unitaires sur `calculateBestStreak` (historique vide, une seule journée,
suite passée plus longue que la suite courante), `computeBadges` (chaque
seuil, juste en dessous et juste au dessus) et le calcul des fenêtres
hebdomadaire et mensuelle de `GoalProgress`.

---

## 8. Journal

### Écran

Nouvel écran `Journal.tsx`, route `/journal`, **avec sa propre icône dans
le rail** (glyphe type carnet, même gabarit que les icônes existantes).

Liste chronologique décroissante de toutes les entrées, barre de recherche
en tête. Chaque ligne montre l'engagement, la date, la note et les tags de
l'entrée.

### Recherche plein texte

Réutilise `useAllPracticeEntriesForUser()` du chantier 1 et filtre **côté
client** par sous-chaîne insensible à la casse sur la note — le volume de
données d'une app personnelle ne justifie pas une recherche plein texte
côté Postgres.

### Tags sur les entrées

`practice_entry` gagne `tags text[] not null default '{}'` : des tags
propres à la séance, indépendants de ceux de l'engagement. La fonction
générique `filterByTag` de `streaks.ts` s'y applique telle quelle, sans
modification.

Champ tags ajouté dans `NouvelleEntree.tsx`, à côté de la note.

### Modèles de note

Nouvelle table `note_template(id, user_id, text, position, created_at)` —
une liste de textes fréquents, gérée depuis une section "Modèles de note"
dans `Reglages.tsx` (ajout, suppression, réordonnancement par `position`,
comme les jalons).

Dans `NouvelleEntree.tsx`, les modèles s'affichent en chips cliquables
au-dessus du champ note ; cliquer un chip **remplace** le contenu du champ,
que l'utilisateur peut ensuite ajuster.

### Réflexions du soir

Le Journal affiche également les réflexions quotidiennes du chantier 9,
interclassées dans la même liste chronologique et distinguées par un badge
— un seul endroit pour tout ce qui a été écrit, plutôt que deux journaux
parallèles.

---

## 9. Rituels quotidiens

Deux bandeaux sur l'Accueil, sur la même mécanique que la revue
hebdomadaire du chantier 4 mais à la granularité du jour.

### Geste du matin

`app_settings` gagne `morning_greeting_dismissed_date date`.

Bandeau visible **avant 12h en heure locale** si ce champ n'est pas la date
du jour : "Bonjour — voici ta journée", suivi d'un résumé chiffré (nombre
de tâches planifiées aujourd'hui, nombre de rappels dus). Le fermer inscrit
la date du jour dans le champ.

### Mini-bilan du soir

Nouvelle table `daily_reflection(user_id, date, text, created_at)`, unique
sur `(user_id, date)` — une ligne par jour, pas davantage.

Bandeau visible **après 18h en heure locale** si aucune ligne n'existe pour
aujourd'hui : un champ texte d'une ligne directement dans le bandeau et un
bouton pour l'enregistrer. Une fois enregistré, le bandeau disparaît pour
la journée. Volontairement une ligne, pas un journal complet.

Ces réflexions apparaissent ensuite dans le Journal (chantier 8).

### Tests

Unitaires sur `shouldShowMorningGreeting(dismissedDate, now)` et
`shouldShowEveningPrompt(reflectionExists, now)` — bornes horaires,
changement de jour, fuseau local.

---

## 10. Gestes du calendrier

Les deux idées restées isolées dans des groupes par ailleurs livrés.

### Glisser-déposer pour reprogrammer

Drag and drop **HTML5 natif** (attribut `draggable`, événements
`dragstart` / `dragover` / `drop`) sur les blocs déjà rendus par
`Calendrier.tsx` — aucune librairie.

- Le dépôt se cale sur la **même grille horaire** que les créneaux de
  création existants.
- La **durée est préservée** : seul l'horaire de début change, comme pour le
  report rapide.
- Glisser une occurrence d'une série récurrente ne déplace **que cette
  occurrence**, jamais la série — même principe que "Reporter".
- Un dépôt qui chevauche une autre tâche n'est **pas bloqué** : il déclenche
  le même message d'avertissement que celui déjà utilisé pour les conflits
  de récurrence. Cohérent avec `detectConflicts`, qui avertit sans jamais
  interdire.

### Sauter une occurrence sans casser le streak

`engagement` gagne `skipped_at timestamptz`, posé sur la ligne de
l'occurrence concernée — chaque occurrence récurrente possède déjà sa
propre ligne depuis le chantier récurrence.

**Sémantique du streak** : un jour sauté devient *transparent*. Il n'est ni
compté comme une pratique (ce qui gonflerait artificiellement les
statistiques), ni traité comme une rupture. `calculateStreak` gagne un
paramètre optionnel `excusedDays: Set<dayKey>` : en remontant les jours,
un jour sans entrée mais excusé est **traversé** sans incrémenter le
compteur ni arrêter la boucle ; un jour sans entrée et non excusé arrête le
comptage, comme aujourd'hui.

Bouton "Passer cette occurrence" dans `TaskPopover.tsx`, à côté de "Marquer
comme faite", visible uniquement pour un engagement appartenant à une série
récurrente (`recurrenceSeriesId` non nul) et pas encore fait.

Une occurrence sautée disparaît des listes "à faire" au même titre qu'une
occurrence faite : ce chantier balaie donc les mêmes filtres que la
corbeille, `skipped_at` s'ajoutant à `archived_at` et `deleted_at` — liste
des points d'appel à re-grepper au moment de l'implémentation. Elle cesse
également de déclencher des rappels (`lib/reminders.ts`, chantier 2).

### Tests

Unitaires sur `calculateStreak` avec jours excusés : excusé au milieu d'une
suite, excusé en bordure, excusé aujourd'hui, plusieurs excusés
consécutifs. Les tests existants de `calculateStreak` doivent continuer de
passer sans modification — le paramètre est optionnel.

---

## Découpage en chantiers et dépendances

Dix chantiers, chacun livrable indépendamment. Les numéros sont ceux des
sections ci-dessus, et l'ordre du tableau est un ordre d'exécution valide
(chaque chantier n'a que des dépendances déjà livrées avant lui) :

| # | Chantier | Dépend de |
|---|---|---|
| 1 | Bilan | — |
| 2 | Notifications | — |
| 3 | Corbeille | — |
| 4 | Données (export + revue hebdo) | 1 (le bandeau pointe vers `/bilan`), 3 (exclusion de la corbeille à l'export) |
| 5 | Pomodoro & mode focus | — |
| 6 | Friction réduite | 1 (widget de répartition), 5 (pré-sélection Pomodoro) |
| 7 | Motivation | — |
| 8 | Journal | 1 (`useAllPracticeEntriesForUser`) |
| 9 | Rituels quotidiens | 8 (les réflexions s'affichent dans le Journal) |
| 10 | Gestes du calendrier | — |

Les chantiers 1, 2, 3, 5, 7 et 10 n'ont aucune dépendance : leur ordre
relatif est libre. Les dépendances listées sont réelles (code partagé), pas
thématiques.

Deux chantiers touchent le process principal (5 et 6) et méritent une
vérification manuelle en application packagée en plus des tests unitaires,
puisque les chemins de ressources et le comportement du tray diffèrent
entre dev et app installée — le commentaire de `src/main/tray.ts` en garde
la trace.

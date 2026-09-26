# Projets : liaison multiple et composition — conception

## Contexte

L'utilisateur n'ouvre pas la section Projets. Le symptôme n'est pas un défaut d'écran mais un défaut de rôle, et la mesure du dépôt le confirme.

**Aujourd'hui, un projet n'est qu'une étiquette avec un écran.** `ListeProjets` fait 45 lignes et affiche un nom et des tags, rien d'autre. `DetailProjet` en fait 106 : un en-tête en lecture seule, un bouton de suppression, et la liste des engagements rattachés. Il n'existe **aucun moyen de modifier un projet** — ni le renommer, ni corriger ses tags ou ses notes, ni l'archiver. Une faute de frappe dans un nom est définitive, sauf à supprimer le projet, ce qui envoie ses engagements liés à la corbeille.

L'asymétrie avec les skills est frappante, et elle n'a jamais été décidée : elle s'est installée.

| | Skills | Projets |
|---|---|---|
| Liste | filtres, tri, archivés, anneau de progression, streak | nom et tags |
| Détail | édition, archivage, jalons, objectifs, entrées | lecture seule et suppression |
| Jalons | `MilestoneChecklist` branchée | absente, alors que le modèle est partagé |
| Archivage | oui | non |

Les tags existent déjà sur les engagements et s'affichent déjà dans les listes. **Une étiquette avec un écran en plus vaut moins qu'une étiquette tout court** : elle demande un entretien sans rien rendre. C'est la raison pour laquelle la section n'est pas ouverte.

**Le rôle retenu**, formulé par l'utilisateur : un projet est un chantier où l'on va passer la majorité de son temps, une ligne de conduite, **un regroupement de skills sous un même nom — et un skill peut appartenir à plusieurs projets**. Sa page doit devenir la maîtrise d'œuvre du chantier : y planifier, y voir les dates du calendrier qui s'y rapportent, y intégrer des skills, les travailler un par un ou en groupe, y lancer des Pomodoros. L'exemple qui a servi de fil : « construire une maison par soi-même ».

**Ce rôle est trop gros pour une seule spec.** Il se décompose en quatre chantiers, dont celui-ci est le premier :

| | Chantier | Dépend de |
|---|---|---|
| **A** | **Liaison multiple et composition** — le modèle plusieurs-à-plusieurs, et le roster qui l'exerce. *Cette spec.* | — |
| **B** | **La maîtrise d'œuvre** — avancement par jalons, temps cumulé, dormance, échéance, objectif de rythme, modification et archivage du projet, et la liste de projets enfin triable. Assez gros pour être redécoupé en ouvrant son propre brainstorming. | A |
| **B′** | **Le chantier courant sur l'Accueil** — un projet épinglé, **un seul**, avec son objectif de rythme | B |
| **C** | **La tranche calendrier** — voir les dates du projet là où elles tombent | A |
| **D** | **La session de chantier** — lancer un Pomodoro sur le projet lui-même, le temps s'y enregistrant | A |
| **E** | **Les sous-projets** — un projet dans un projet, avec sa règle de remontée et sa protection contre les cycles | B |

**Écarté en explorant, à ne pas reproposer sans lire pourquoi.** Deux autres formes de « travailler les skills en groupe » ont été examinées et retenues contre la session de chantier. La **file d'attente** — les cycles enchaînent plusieurs skills — demanderait que `PomodoroSession.skillId` devienne une liste avec un index, touchant `startSession`, `nextPhase`, `completePhase`, `advancePhase` et leurs 19 tests : c'est la pièce la plus délicate de l'application, et elle mérite son propre chantier plutôt qu'un morceau de celui-là. La **session partagée** — répartir le temps entre plusieurs skills après coup — est moins chère mais moins fidèle au besoin exprimé. La session de chantier gagne parce qu'elle est presque gratuite : le sélecteur du Pomodoro exclut les projets par `!e.isProject`, et lever cette exclusion suffit, un projet étant un engagement qui peut déjà porter des entrées de pratique.

**Aucun de ces chantiers ne demande de migration au-delà de la 0016.** Vérifié en explorant : les jalons ont leur table, le temps cumulé et la dormance se dérivent de `PracticeEntry`, les objectifs réutilisent des champs existants, les sous-projets sortent de la table de liaison, l'ordre des membres a sa colonne `position`, et la session Pomodoro vit en mémoire — il n'existe aucune table pomodoro dans le schéma. C'est la raison d'être des deux colonnes que la 0016 pose sans les exposer : **une seule application manuelle de SQL pour toute la série.**

Le chantier A ne se voit presque pas, et c'est son danger : sans interface pour rattacher un skill à plusieurs projets, la table resterait vide et rien ne prouverait qu'elle fonctionne. Le roster est donc inclus ici, comme le minimum qui exerce le modèle et se juge à l'œil.

**L'état du modèle, mesuré.** `project_id uuid references saint_daily.engagement(id)` a été ajouté par la migration 0008, **sans `on delete`**. C'est ce manque qui rend aujourd'hui « vider la corbeille » impossible : une purge en lot devrait supprimer les enfants avant les parents. La dernière migration est la 0015. `useEngagements` charge tout par `.select('*')` et le contenu d'un projet se lit entièrement côté client — `engagements.filter(e => e.projectId === id)`. L'application n'a aucune requête par projet.

## Ce que cette spec ne couvre pas

- **Les chantiers B, C et D** ci-dessus. En particulier le Pomodoro **en groupe**, qui est une mécanique neuve : l'écran actuel prend un `?skillId=` unique et ne connaît qu'un skill à la fois.
- **La modification d'un projet** — renommer, tags, notes, archivage. C'est le manque le plus criant de la section, et il appartient au chantier B pour que celui-ci reste centré sur le modèle.
- **Le réordonnancement des membres d'un projet.** La colonne `position` est posée par la migration parce qu'une table de liaison est précisément ce qui peut la porter, mais **aucune interface ne l'expose** dans ce chantier.
- **L'échéance, les objectifs, les jalons, le temps cumulé, la dormance et les sous-projets.** Tous retenus pour la suite, tous du chantier B — sauf les colonnes `due_at` et `current_project_id`, posées par cette migration et expliquées au §1. Les objectifs ne demanderont aucune migration : `goalPeriod`, `goalMetric` et `goalTarget` existent déjà sur tout engagement et ne sont simplement jamais exposés côté projet. Le temps cumulé non plus : `PracticeEntry` porte `durationMinutes` et `engagementId`, et `useAllPracticeEntries` charge déjà tout.
- **Le chantier courant sur l'Accueil.** La colonne est posée ici, l'écran vient plus tard. Le constat qui le motive mérite d'être conservé : **l'Accueil est organisé par l'urgence, un projet par l'intention.** Ses deux sections affichent les skills dont le seuil de rappel est dépassé et les tâches planifiées du jour — il ne sait montrer que ce qui est en retard. Un chantier comme « construire une maison » n'est jamais dû, donc rien ne l'y fait apparaître. D'où les deux formes retenues : un chantier courant épinglé, **un seul**, sans quoi c'est un tableau de bord qui ne veut rien dire ; et un objectif de rythme, qui fait entrer l'intention dans l'axe de l'urgence par la bonne porte, puisqu'un objectif en retard l'est réellement.
- **La suppression de la colonne `project_id`.** Voir les contraintes globales : c'est un chantier d'après-release.
- **La multi-sélection de projets pour une tâche.** Le modèle la permettra ; le popover du calendrier gardera son choix unique.
- **Le socle de test de composants.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest. L'installer est un chantier à part entière, et la conception ci-dessous en tient compte plutôt que de le contourner.

## Contraintes globales

- **La migration 0016 s'applique à la main.** Le code doit rester fonctionnel **avant** qu'elle ne passe. Les quatre règles du dépôt s'appliquent, et la quatrième est celle qui compte ici : table entièrement absente, l'échec de *lecture* ne s'affiche nulle part, l'échec d'*écriture* s'affiche.
- **La migration ne supprime ni ne renomme `project_id`.** L'application installée la lit. C'est exactement le piège qui a mordu une fois : la 1.5.1 installée interrogeait `saint_daily.skill`, renommée par une migration non releasée, et l'application était structurellement cassée.
- **Créer une table dans `saint_daily` demande un `grant all … to anon, authenticated, service_role` explicite.** Sans lui, PostgREST refuse l'accès **avant** que la RLS n'entre en jeu, avec une erreur qui ne ressemble pas à un problème de droits. `public.profile` est restée dans `public` : la clé étrangère d'appartenance traverse les schémas.
- **Les six rôles de texte et les sept crans d'espacement** sont les seuls autorisés. Aucune valeur arbitraire.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 216 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.

## 1. Le schéma — migration 0016

Sur le motif exact de `note_template` (migration 0013), qui est la table la plus récemment créée dans ce schéma.

```sql
create table saint_daily.engagement_project (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(user_id) on delete cascade,
  engagement_id uuid not null references saint_daily.engagement(id) on delete cascade,
  project_id uuid not null references saint_daily.engagement(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (engagement_id, project_id),
  check (engagement_id <> project_id)
);

alter table saint_daily.engagement
  add column due_at timestamptz;

alter table saint_daily.app_settings
  add column current_project_id uuid references saint_daily.engagement(id) on delete set null;
```

Six points qui ne sont pas du remplissage :

**Les deux clés étrangères prennent `on delete cascade`**, que `project_id` n'a jamais eu. La nouvelle table n'hérite donc pas du défaut qui bloque « vider la corbeille ».

**`user_id` est porté par la table** plutôt que dérivé de l'engagement par sous-requête. C'est le motif de la maison, et il rend la politique RLS triviale : `auth.uid() = user_id`, comme les cinq autres tables du schéma. Une politique par sous-requête serait plus « juste » et nettement plus lente.

**`due_at` est posée maintenant et exposée plus tard.** L'échéance d'un chantier appartient au chantier B, mais une colonne coûte une ligne dans une migration qu'on écrit de toute façon, contre une migration 0017 entière à appliquer à la main si on attend. La tentation était de réutiliser le `scheduledAt` qui existe déjà sur tout engagement : elle est écartée. Le calendrier affiche `scheduledAt && scheduledEndsAt` et **ne filtre pas `isProject`** — un projet n'y surgirait pas tant que `scheduledEndsAt` reste nul, mais le couplage est fortuit, et surtout `scheduledAt` veut dire « quand c'est planifié », pas « quand c'est dû ». Aucune requête automatique ne nommera `due_at` avant que la migration ne passe.

**`check (engagement_id <> project_id)` interdit qu'un engagement s'appartienne.** Un projet étant un engagement, la liaison autorise déjà un projet dans un projet — les sous-projets sortent gratuitement de ce modèle, et c'est voulu. Mais elle autorise aussi, sans cette contrainte, un cycle : la maison dans la toiture dans la maison. La contrainte bloque le cas trivial ; les cycles plus longs restent possibles et devront être traités par le chantier qui exposera les sous-projets, en gardant toute traversée récursive protégée par un ensemble de visités. C'est noté ici parce que c'est le modèle qui l'ouvre, pas l'interface.

**`current_project_id` est posée maintenant, et porte un avertissement qui vaut plus que la colonne.** Elle désignera le chantier courant, celui que l'Accueil mettra en tête — un seul, singulier par construction puisqu'il y a une ligne de réglages par utilisateur. Le pointeur prend `on delete set null` : un projet purgé efface la désignation au lieu de bloquer sa suppression.

> **Ne jamais ajouter `currentProjectId` à `DEFAULT_SETTINGS` ni à `toRow` tant que la migration n'est pas appliquée.** `useSettings` crée la ligne par `.insert({ user_id, ...toRow(DEFAULT_SETTINGS) })` : une clé de plus nommerait une colonne inexistante, l'`INSERT` échouerait, `settings` resterait `null` pour toujours et **tout l'écran Réglages deviendrait inaccessible**. La lecture, elle, est sans risque : `select('*')` rend la colonne absente comme `undefined`, ce qui signifie simplement « aucun chantier courant » — exactement le bon défaut. L'écriture n'a lieu que sur une action explicite d'épinglage, dont l'échec doit se voir.

**Reprise des données existantes**, dans la même transaction :

```sql
insert into saint_daily.engagement_project (user_id, engagement_id, project_id)
select user_id, id, project_id
  from saint_daily.engagement
 where project_id is not null;
```

Plus l'index sur `user_id`, `enable row level security`, la politique `engagement_project_owner_all`, et le `grant all` avec son commentaire.

## 2. La fenêtre pré-migration

C'est la partie qui se conçoit au lieu de se subir. Tant que le SQL n'est pas collé, la table n'existe pas et toute requête vers elle échoue.

**Lecture** — l'échec est traité comme « liaison indisponible », distinct de « liaison vide ». On retombe alors sur `project_id`, et les rattachements actuels restent visibles. Rien ne s'affiche en erreur.

**Écriture** — l'échec s'affiche, avec un message qui dit quoi faire plutôt que ce qui a cassé : la migration 0016 n'est pas encore appliquée.

La distinction entre *indisponible* et *vide* est le cœur de ce chantier. Confondre les deux produirait l'un de deux défauts opposés : une liaison indisponible lue comme vide ferait disparaître tous les rattachements, une liaison vide lue comme indisponible ressusciterait des rattachements que l'utilisateur vient de retirer.

**La précédence est totale, jamais une fusion.** Dès que la liaison est disponible, elle est la seule source et `project_id` est ignoré, même s'il porte une valeur qui la contredit — ce qui arrivera pour tout engagement modifié par une version antérieure de l'application. Réunir les deux sources ressusciterait un rattachement retiré depuis, et la §5 garantit de toute façon que `project_id` suit la liaison et non l'inverse.

## 3. Où vit la logique, et pourquoi

Le dépôt n'ayant aucun socle de test de composants, la règle de résolution ne doit pas vivre dans du JSX. Elle va dans un **`src/renderer/src/lib/projets.ts`** en fonctions pures :

- `membresDuProjet(engagements, liaisons, projetId)` — les engagements composant un projet.
- `projetsDeLEngagement(engagements, liaisons, engagementId)` — l'inverse, dont le roster et le chantier B auront besoin.
- `projetPrincipal(liaisons, engagementId)` — le projet à recopier dans `project_id`, voir §5.

Chacune prend `liaisons: Liaison[] | null`, où **`null` signifie indisponible** et `[]` signifie vide. C'est cette signature qui rend la distinction du §2 impossible à perdre par accident, et elle est testable sans moteur de rendu.

Les cas à couvrir : liaison disponible et peuplée, liaison disponible mais vide pour ce projet, liaison indisponible avec repli sur `project_id`, et un engagement rattaché à plusieurs projets — le cas qui motive tout le chantier.

## 4. Le roster sur la page projet

Une section « Composition » sur `DetailProjet`, qui remplace l'actuelle « Engagements liés ».

Elle liste les membres, chacun étiqueté **Skill** ou **Tâche** comme le fait déjà l'écran, et lie vers la destination existante — `/skills/:id` pour un skill, `/calendrier` pour une tâche. Chaque ligne porte une action de détachement.

Un sélecteur permet de rattacher un **skill** existant, non archivé et pas déjà membre. Les tâches ne s'y rattachent pas : elles le font depuis le calendrier, où on les planifie. Ce n'est pas une limitation du modèle mais un choix d'interface, et la §5 explique pourquoi les deux mécanismes restent cohérents.

## 5. Compatibilité avec l'application installée

L'application installée lit `project_id`. Cesser de l'écrire figerait ses rattachements à leur dernière valeur, sans le dire.

**À chaque modification de la composition, on écrit la liaison puis on remet `project_id` à jour** avec le projet principal : la liaison de plus petite `position`, et à `position` égale la plus ancienne par `created_at`. Quand un engagement n'a plus aucune liaison, `project_id` passe à `null`.

Le tri est déterministe et explicite parce qu'un tri implicite serait la source d'un défaut impossible à reproduire : `project_id` changerait au gré de l'ordre de retour de PostgREST.

C'est une écriture de compatibilité, à retirer le jour où la colonne disparaît. Elle est marquée comme telle dans le code, à son emplacement.

Le popover du calendrier garde son choix unique : il écrit désormais une liaison, et choisir un projet remplace le précédent. Une interface simple sur un modèle multiple est légitime.

## 6. Ce qui se teste, et ce qui ne peut pas l'être

| Module | Couverture |
|---|---|
| `lib/projets.ts` | Les trois fonctions, sur les quatre cas du §3, plus le tri déterministe du projet principal |
| `hooks/useLiaisonsProjet.ts` | Non testable ici — il parle à Supabase, que le dépôt ne simule nulle part |

Le reste — le roster, le sélecteur, le popover — **se vérifie à l'œil dans l'application réelle**, selon le cycle du dépôt : commit dans le worktree, merge local dans `master`, vérification live, push seulement si elle passe. `preview_start` sert le dépôt racine et jamais le worktree, silencieusement.

**La vérification live devra couvrir les deux états du monde** : avant la migration, où le roster affiche les rattachements hérités de `project_id` et où une tentative de modification affiche un message actionnable ; après, où la composition est pleinement modifiable. C'est le seul chantier de cette série où l'état pré-migration est une fonctionnalité et non un accident.

## 7. Découpage

Trois chantiers, dans cet ordre. Chacun laisse l'application fonctionnelle.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 1 | **Le SQL et le pur** | La migration 0016 écrite mais **non appliquée**, et `lib/projets.ts` avec ses tests. Aucun écran modifié. | — |
| 2 | **La lecture** | `useLiaisonsProjet`, et `DetailProjet` qui affiche la composition par la règle de résolution. Fonctionne avant comme après la migration. | 1 |
| 3 | **L'écriture** | Rattacher, détacher, l'écriture de compatibilité sur `project_id`, et le popover du calendrier rebranché. | 2 |

**Vérification finale attendue** : les tests verts avec les ajouts de `projets.test.ts`, le typecheck propre, et une vérification live **dans les deux états de migration** — celui d'avant étant obtenu simplement en ne collant pas encore le SQL, ce qui est l'ordre naturel des choses.

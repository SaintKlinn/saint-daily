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
| **B** | **La maîtrise d'œuvre** — avancement, temps cumulé, jalons, modification et archivage du projet | A |
| **C** | **La tranche calendrier** — voir les dates du projet là où elles tombent | A |
| **D** | **Travailler depuis le projet** — Pomodoro sur un skill, puis en groupe sur plusieurs | A |

Le chantier A ne se voit presque pas, et c'est son danger : sans interface pour rattacher un skill à plusieurs projets, la table resterait vide et rien ne prouverait qu'elle fonctionne. Le roster est donc inclus ici, comme le minimum qui exerce le modèle et se juge à l'œil.

**L'état du modèle, mesuré.** `project_id uuid references saint_daily.engagement(id)` a été ajouté par la migration 0008, **sans `on delete`**. C'est ce manque qui rend aujourd'hui « vider la corbeille » impossible : une purge en lot devrait supprimer les enfants avant les parents. La dernière migration est la 0015. `useEngagements` charge tout par `.select('*')` et le contenu d'un projet se lit entièrement côté client — `engagements.filter(e => e.projectId === id)`. L'application n'a aucune requête par projet.

## Ce que cette spec ne couvre pas

- **Les chantiers B, C et D** ci-dessus. En particulier le Pomodoro **en groupe**, qui est une mécanique neuve : l'écran actuel prend un `?skillId=` unique et ne connaît qu'un skill à la fois.
- **La modification d'un projet** — renommer, tags, notes, archivage. C'est le manque le plus criant de la section, et il appartient au chantier B pour que celui-ci reste centré sur le modèle.
- **Le réordonnancement des membres d'un projet.** La colonne `position` est posée par la migration parce qu'une table de liaison est précisément ce qui peut la porter, mais **aucune interface ne l'expose** dans ce chantier.
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
  unique (engagement_id, project_id)
);
```

Trois points qui ne sont pas du remplissage :

**Les deux clés étrangères prennent `on delete cascade`**, que `project_id` n'a jamais eu. La nouvelle table n'hérite donc pas du défaut qui bloque « vider la corbeille ».

**`user_id` est porté par la table** plutôt que dérivé de l'engagement par sous-requête. C'est le motif de la maison, et il rend la politique RLS triviale : `auth.uid() = user_id`, comme les cinq autres tables du schéma. Une politique par sous-requête serait plus « juste » et nettement plus lente.

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

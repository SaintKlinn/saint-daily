# Saint Daily — modèle unifié "Engagement" (sous-projet 1 : la fondation)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-06

## Contexte

Ce chantier est le premier d'une suite décidée pendant un brainstorm plus
large sur l'évolution de Saint Daily en "Daily Tool" — un outil pour
s'organiser au quotidien, pas seulement suivre des compétences. La ligne
directrice retenue : skills et tâches ponctuelles ne sont plus deux
systèmes séparés, mais deux formes du même objet, un **engagement**.
Le reste de la vision (calendrier/agenda, mécaniques de tâches avancées,
notifications programmées, rétrospective, etc.) est découpé en
sous-projets ultérieurs, hors scope ici — voir "Hors scope" plus bas.

Ce document couvre uniquement la fondation : la structure de données
unifiée, le renommage de la couche de données partagée, et une première
façon minimale de créer et voir une tâche ponctuelle avant qu'un vrai
calendrier existe.

## Modèle de données

Migration du même type que la séparation de schéma déjà faite dans ce
projet (renommages + un ajout de colonne, opérations de métadonnées pur,
aucune réécriture de données) :

```sql
alter table saint_daily.skill rename to engagement;
alter table saint_daily.engagement add column scheduled_at timestamptz;

alter table saint_daily.skill_milestone rename to engagement_milestone;
alter table saint_daily.engagement_milestone rename column skill_id to engagement_id;

alter table saint_daily.practice_entry rename column skill_id to engagement_id;
```

Aucune nouvelle colonne de "type" ou de "récurrence" : la distinction
entre un skill classique et une tâche ponctuelle se fait uniquement par
la présence ou non de `scheduled_at`. Un skill classique n'en a jamais
(le rappel reste basé sur "jours depuis la dernière pratique", comme
aujourd'hui) ; une tâche ponctuelle en a un. Les motifs de récurrence
avancés (quotidien/hebdo/personnalisé pour une tâche) sont un sous-projet
séparé et futur — ne pas les anticiper ici.

Un renommage de table ou de colonne ne casse ni les contraintes de clé
étrangère (Postgres les retrouve par OID/attnum, pas par nom) ni les
`GRANT`s déjà en place sur le schéma `saint_daily` — mais les policies
RLS existantes doivent être relues avant d'écrire la migration, au cas où
l'une d'elles référence `skill_id` explicitement dans sa condition (à
vérifier contre l'état réel de la base, pas supposé).

## Portée du renommage dans le code

Décision explicite : on renomme maintenant, pas plus tard — mais borné à
ce qui sert vraiment à éviter du travail dans les sous-projets suivants.

**Se renomme** — la couche de données partagée, celle que le calendrier
et les mécaniques de tâches consommeront directement :
- `src/renderer/src/lib/types.ts` : `Skill` → `Engagement`,
  `SkillMilestone` → `EngagementMilestone`, tout champ `skillId` →
  `engagementId` (dans `Engagement`, `EngagementMilestone`, et
  `PracticeEntry`). `Engagement` gagne un champ `scheduledAt: string |
  null`.
- `src/renderer/src/hooks/useSkills.ts` → renommé
  `src/renderer/src/hooks/useEngagements.ts`, exporte `useEngagements()`
  au lieu de `useSkills()`. Signature et forme de retour inchangées à
  part le renommage des champs suivant `types.ts` — `createSkill` devient
  `createEngagement`, `setArchived` reste tel quel (le concept
  d'archivage ne change pas). Ne filtre rien par défaut : renvoie tous
  les engagements, skills et tâches confondus — c'est aux consommateurs
  de filtrer selon leur besoin (même convention déjà en place pour
  `activeSkills = skills.filter(s => !s.archivedAt)` dans `Accueil.tsx`).
- `src/renderer/src/hooks/useMilestones.ts` et
  `src/renderer/src/hooks/usePracticeEntries.ts` : paramètres et champs
  internes renommés en cohérence (`skillId` → `engagementId`), noms de
  fichiers inchangés (déjà assez génériques).

**Ne se renomme pas** — les écrans déjà dédiés aux skills
(`ListeSkills.tsx`, `DetailSkill.tsx`, `NouveauSkill.tsx`), leurs routes
(`/skills`, `/skills/nouveau`, `/skills/:id`), et le mot "Skill" affiché à
l'utilisateur. Ces écrans restent spécifiquement sur les skills — un
concept qui reste réel et à part entière, avec ses propres champs
(niveau générique, archivage) qui n'ont pas de sens pour une tâche
ponctuelle. Ils changent uniquement, en interne, pour consommer
`useEngagements()` filtré sur `!engagement.scheduledAt` au lieu de
`useSkills()`. Les renommer n'apporterait rien maintenant : ils ne
fusionnent pas avec les tâches dans ce sous-projet, ce sera le travail
des sous-projets suivants quand un écran réellement unifié existera.

## Créer et voir une tâche, avant le calendrier

**Nouvel écran** `src/renderer/src/screens/NouvelleTache.tsx`, route
`/taches/nouvelle` — formulaire minimal :
- Titre (obligatoire).
- Planification (optionnelle) — une tâche peut n'avoir aucune date, un
  "un jour peut-être" ; si renseignée, devient `scheduled_at`.
- Tags (optionnels) — même champ que les skills, sans coût supplémentaire
  puisque la colonne existe déjà sur `engagement`.

Pas de champ niveau générique ni d'archivage dans ce formulaire — sans
objet pour une tâche, et absents de l'écran plutôt que présents mais
inertes.

**Affichage** : une nouvelle section sur `Accueil.tsx`, intitulée
"Tâches à faire", distincte des "Rappels dus" (qui restent 100% skills)
— listant les engagements dont `scheduledAt` est renseigné et non
encore complétés (à venir ou en retard), triés par `scheduledAt`
croissant. Volontairement séparée plutôt
que fusionnée avec les rappels de skills : la vraie fusion visuelle en un
seul flux "Aujourd'hui" est le travail des sous-projets calendrier et
mécaniques de tâches, pas celui-ci.

**Cocher une tâche comme faite** : crée une entrée dans `practice_entry`
(`engagement_id` de la tâche, `duration_minutes` à 0, `note` vide/nulle)
— cocher *est* l'entrée pour une tâche ponctuelle, exactement comme
décidé pour le modèle conceptuel. Aucune nouvelle colonne "completed"
n'est nécessaire : l'existence d'au moins une entrée suffit à savoir
qu'une tâche ponctuelle a été faite.

## Hors scope (rappel)

- Calendrier/agenda (vues mois/semaine/jour) — sous-projet 2.
- Mécaniques de tâches avancées (priorité, sous-tâches, projets, snooze,
  motifs de récurrence personnalisés) — sous-projet 3.
- Notifications programmées à heure fixe pour les tâches planifiées —
  sous-projet séparé (brique technique différente du système actuel basé
  sur "jours depuis").
- Rétrospective/motivation généralisée aux engagements (heatmap, Wrapped,
  objectifs, jalons semi-automatiques) — sous-projet séparé, peut
  s'appuyer sur ce modèle une fois posé.
- Tout le reste du backlog "Daily Tool" (sécurité/verrouillage,
  hors-ligne, temps d'écran, suppression définitive/corbeille, widget
  Windows, etc.) — sous-projets indépendants, non affectés par celui-ci.
- Fusion visuelle skills/tâches dans un seul écran ou une seule création
  — décision explicite de garder les deux séparés à l'affichage pour ce
  sous-projet.

## Étape manuelle requise (Supabase)

Comme pour la précédente migration de schéma : l'utilisateur applique la
migration SQL ci-dessus directement dans l'éditeur SQL du dashboard
Supabase. Aucune nouvelle étape d'exposition de schéma n'est nécessaire
cette fois — `saint_daily` est déjà exposé, on renomme seulement des
objets à l'intérieur.

## Tests / vérification

- Aucune fonction pure nouvelle nécessaire pour la fondation elle-même
  (renommages de type/hook) — la suite Vitest existante
  (`streaks.test.ts`, `pomodoroLogic.test.ts`) reste la référence, sans
  régression attendue puisque leur logique ne dépend pas des noms de
  champs renommés.
- Vérification manuelle contre la base réelle (même méthode que la
  précédente migration) : appliquer le SQL, relancer l'app, confirmer que
  les écrans skills existants (liste, détail, Pomodoro, réglages)
  continuent de fonctionner à l'identique après être passés par
  `useEngagements()` filtré.
- Vérification manuelle du nouveau flux tâche : créer une tâche planifiée
  depuis `/taches/nouvelle`, confirmer qu'elle apparaît dans la nouvelle
  section "Tâches à faire" de l'Accueil (et jamais dans la liste des
  skills), la cocher, confirmer qu'une entrée est créée et qu'elle
  disparaît de la section.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Fusion technique | Une seule table fusionnée (`engagement`), pas de table d'extension séparée |
| Distinction skill/tâche | Présence ou non de `scheduled_at`, pas de colonne "type" |
| Portée du renommage | Couche de données partagée renommée maintenant ; écrans skills existants et mot "Skill" affiché inchangés |
| Périmètre de ce sous-projet | Modèle + création de tâche minimale + affichage séparé sur Accueil ; calendrier et mécaniques avancées restent des sous-projets futurs |
| Complétion d'une tâche | Cocher crée une entrée dans `practice_entry`, pas de nouvelle colonne "completed" |

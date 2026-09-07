# Saint Daily — Calendrier / agenda (sous-projet 2)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-07

## Contexte

Deuxième sous-projet de l'évolution "Daily Tool", directement à la suite
du modèle unifié Engagement (sous-projet 1, mergé sur `master`). Ce
sous-projet construit un vrai calendrier/agenda — vue semaine, créneaux
avec heure de début et de fin — pour visualiser et créer les tâches
planifiées, dans l'esprit "Google Calendar" évoqué pendant le brainstorm
initial, mais scopé à Saint Daily seul pour l'instant (décision déjà
actée : "pour le moment A, dans le futur B" — l'écosystème cross-app
"Saint" reste une ambition future, hors scope ici).

Ce document couvre : l'ajout d'une heure de fin au modèle Engagement, la
vue semaine, les interactions (créer via un créneau vide, voir/compléter
une tâche existante), et la mise à jour du formulaire de création de
tâche pour saisir une durée.

## Modèle de données

Migration additive, deux colonnes :

```sql
alter table saint_daily.engagement add column scheduled_ends_at timestamptz;
alter table saint_daily.engagement add constraint engagement_scheduled_ends_at_check
  check (scheduled_ends_at is null or (scheduled_at is not null and scheduled_ends_at > scheduled_at));

alter table saint_daily.app_settings add column show_practice_in_calendar boolean not null default false;
```

`scheduled_ends_at` est nullable : les tâches créées avant ce sous-projet
n'en ont pas, et continuent de s'afficher normalement dans "Tâches à
faire" sur l'Accueil (qui ne dépend que de `scheduled_at`) — elles
n'apparaissent simplement pas sur le calendrier tant qu'aucune heure de
fin n'est connue. Pour toute tâche créée **via le nouveau formulaire**
mis à jour par ce sous-projet, `scheduled_ends_at` est en revanche
toujours renseignée (voir "Mise à jour du formulaire" plus bas) — un
"vrai créneau" a un début et une fin.

`show_practice_in_calendar` rejoint les préférences déjà existantes sur
`app_settings` (`reminder_threshold_days`, `notifications_enabled`,
`auto_launch_enabled`, et les réglages Pomodoro) — synchronisée entre
appareils, pas de nouvel état local.

## Écran calendrier

Nouvel écran `src/renderer/src/screens/Calendrier.tsx`, route
`/calendrier` — nouvel item de la navigation principale, entre Skills et
Réglages.

**En-tête** : plage de dates de la semaine affichée ("1 – 7 sept.
2026"), boutons Précédent / Suivant / Aujourd'hui, et une case à cocher
"Inclure l'historique de pratique" (lit/écrit
`show_practice_in_calendar`).

**Grille** : sept colonnes (lundi → dimanche), 24 lignes (une par heure),
scrollée par défaut vers une plage raisonnable (autour de 7h-8h) plutôt
que de forcer un scroll depuis minuit. Chaque tâche planifiée
(`scheduled_at`/`scheduled_ends_at` tous deux renseignés) s'affiche comme
un bloc positionné selon son créneau, dans le style visuel déjà établi de
l'app (ink/gold/champagne, cohérent avec `RayCorner` et le reste des
composants) — aucune nouvelle palette, aucune librairie de calendrier
externe.

Quand "Inclure l'historique de pratique" est coché, les entrées de
`practice_entry` (skills uniquement, positionnées via `practiced_at` et
`duration_minutes`) s'affichent aussi sur la grille, dans un style
visuellement distinct et volontairement en retrait (plus discret,
non-cliquable — l'action "marquer comme faite" n'a pas de sens pour une
séance déjà loguée).

## Interactions

- **Clic sur un créneau vide de la grille** → redirige vers
  `/taches/nouvelle` avec l'heure cliquée pré-remplie dans le champ
  Planification (via query params dans l'URL, même mécanisme que
  `?skillId=` déjà utilisé pour pré-remplir des formulaires ailleurs dans
  l'app).
- **Clic sur une tâche existante** → ouvre un popover léger (titre, tags,
  créneau début-fin, bouton "Marquer comme faite"). Ce bouton réutilise
  telles quelles les fonctions déjà en place depuis le sous-projet 1
  (`logEntry` puis `setArchived`) — le clic retire immédiatement le bloc
  de la grille, exactement comme sur l'Accueil. Pas d'écran de détail
  dédié aux tâches dans ce sous-projet (contrairement aux skills, qui ont
  `DetailSkill.tsx`) : l'édition complète (renommer, déplacer, changer
  l'heure) est hors scope, réservée au sous-projet "mécaniques de tâches
  avancées".
- **Clic sur une entrée d'historique de pratique** (si la case est
  cochée) → aucune action, purement informatif.

## Mise à jour du formulaire de création de tâche

`src/renderer/src/screens/NouvelleTache.tsx` gagne un sélecteur de durée
à côté du champ Planification (déjà obligatoire depuis le sous-projet
1) : presets 15/30/45/60/90 min, 30 min par défaut — même principe que
les presets de durée déjà utilisés pour le Pomodoro
(`Pomodoro.tsx`). `scheduledEndsAt` est calculée à partir de l'heure de
début choisie et de la durée sélectionnée, et devient obligatoire (ne
peut plus être `null`) pour toute tâche créée via ce formulaire à partir
de ce sous-projet.

Quand le formulaire est atteint via un clic sur un créneau vide du
calendrier, l'heure de début est pré-remplie depuis l'URL ; la durée
reste au défaut (30 min), ajustable par l'utilisateur avant de créer.

## Hors scope (rappel)

- Vues jour/mois — uniquement la vue semaine dans ce sous-projet ; jour
  et mois pourront suivre plus tard si le besoin se confirme.
- Glisser-déposer pour déplacer ou redimensionner une tâche directement
  sur la grille.
- Éditer une tâche existante (renommer, changer l'heure, changer les
  tags) au-delà de "marquer comme faite" — sous-projet "mécaniques de
  tâches avancées".
- Récurrence (motifs quotidien/hebdo/personnalisé).
- Notifications programmées à l'heure du créneau — sous-projet séparé.
- Écosystème cross-app "Saint" — ce calendrier reste scopé à Saint Daily
  seul, décision déjà actée pendant le brainstorm initial.
- Tout le reste du backlog "Daily Tool" indépendant de ce chantier
  (sécurité/verrouillage, hors-ligne, temps d'écran, suppression
  définitive/corbeille, widget Windows, etc.).

## Étape manuelle requise (Supabase)

Même méthode que les migrations précédentes de ce projet : l'utilisateur
applique la migration SQL ci-dessus directement dans l'éditeur SQL du
dashboard Supabase, en une seule exécution (transaction explicite,
suivant la convention déjà adoptée pour la migration du sous-projet 1).

## Tests / vérification

- Aucune fonction pure nouvelle qui justifierait un test Vitest dédié
  pour la fondation elle-même (une migration additive et un nouveau champ
  de formulaire) — la logique de positionnement des blocs sur la grille
  (convertir un `scheduled_at`/`scheduled_ends_at` en position/hauteur
  dans la grille) est en revanche une fonction pure candidate pour un
  test unitaire, à trancher au moment du plan d'implémentation si elle
  est suffisamment isolée du JSX pour être testée seule.
- Vérification manuelle contre la base réelle une fois la migration
  appliquée : créer une tâche avec un créneau via le formulaire mis à
  jour, confirmer qu'elle apparaît au bon endroit sur la grille semaine ;
  cliquer un créneau vide et confirmer la pré-remplissage correct de
  l'heure ; cliquer une tâche existante, confirmer le popover, et que
  "Marquer comme faite" la retire de la grille ; cocher "Inclure
  l'historique de pratique" et confirmer que les séances de pratique
  s'affichent en lecture seule sans interférer avec les tâches.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Représentation d'une tâche sur le calendrier | Un vrai créneau (début + fin), pas un simple point dans le temps |
| Vue(s) à construire | Semaine uniquement pour ce sous-projet ; jour/mois restent hors scope |
| Historique de pratique sur le calendrier | Optionnel via une préférence (`show_practice_in_calendar`), désactivé par défaut |
| Création depuis le calendrier | Oui — clic sur un créneau vide redirige vers `/taches/nouvelle` pré-rempli |
| Voir une tâche existante | Popover léger (voir + marquer comme faite), pas d'écran de détail dédié |
| Édition complète d'une tâche | Hors scope, réservée au sous-projet "mécaniques de tâches avancées" |
| Emplacement dans la navigation | Nouvel item de nav principale, entre Skills et Réglages |

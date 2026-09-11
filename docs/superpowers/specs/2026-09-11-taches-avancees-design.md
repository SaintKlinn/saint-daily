# Saint Daily — Mécaniques de tâches avancées (sous-projet 3, suite)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-11

## Contexte

Sous-projet 3 ("mécaniques de tâches avancées"), issu de la décomposition
du brainstorm initial du 6 septembre. La pièce 1/5 (priorité) est livrée
et mergée. Les 4 pièces restantes du découpage initial — report rapide,
récurrence, sous-tâches, regroupement par projet — ont été rebrainstormées
et regroupées en 3 chantiers indépendants, puisque sous-tâches et
regroupement par projet s'avèrent être deux mécanismes distincts qui
gagnent à être conçus ensemble pour éviter qu'ils se chevauchent :

1. **Report rapide** ("Plus tard aujourd'hui" / "Demain")
2. **Récurrence sur les tâches**
3. **Sous-tâches et regroupement par projet**

Ce document couvre les trois. Chacun reste implémentable et livrable
indépendamment des deux autres — aucun des trois ne dépend du code des
deux autres, seul le champ `Engagement` de base est commun aux trois.

---

## 1. Report rapide

### Algorithme

Une fonction pure, `findNextFreeSlot(fromDate, durationMinutes, existingTasks, maxDaysAhead)` :

- Cherche, à partir de `fromDate`, un créneau libre d'au moins
  `durationMinutes` qui ne chevauche aucune tâche déjà planifiée
  (`existingTasks` = toutes les tâches actives avec `scheduledAt`/
  `scheduledEndsAt`, à l'exclusion de la tâche qu'on reporte elle-même).
  Les skills n'ont pas de créneau et n'entrent jamais dans ce calcul.
- Aucune contrainte de plage horaire : toute la journée (0h–24h) est
  éligible.
- Si aucun créneau n'est trouvé sur la journée testée, la recherche
  continue sur le jour suivant, jusqu'à `maxDaysAhead` (**30 jours**).
  Au-delà, retourne `null` — pas de créneau trouvable.
- La durée du nouveau créneau est toujours identique à la durée actuelle
  de la tâche (`scheduledEndsAt - scheduledAt`) — seul l'horaire de
  début change.

**"Plus tard aujourd'hui"** appelle `findNextFreeSlot` à partir de
*maintenant* (pas minuit — un créneau dans le passé n'a pas de sens).
**"Demain"** l'appelle à partir de minuit le lendemain.

### UI

Deux boutons dans `TaskPopover.tsx`, sous le sélecteur de priorité :
"Plus tard aujourd'hui" et "Demain". Au clic :
1. Calcule le nouveau créneau via `findNextFreeSlot`.
2. Si trouvé : écrit `scheduledAt`/`scheduledEndsAt` via
   `updateEngagement` (même pattern write-on-click que la priorité),
   ferme le popover, affiche un message de confirmation bref indiquant
   la nouvelle date/heure (ex. "Reporté au 18 sept., 14h00").
3. Si `null` (30 jours sans créneau libre) : message d'erreur, le
   popover reste ouvert, rien ne change.

Le popover se ferme après un report réussi car le nouveau créneau peut
tomber un tout autre jour, voire une autre semaine — le laisser ouvert
sur un horaire qui vient de changer sous les yeux de l'utilisateur
serait confus.

### Tests

`findNextFreeSlot` est une fonction pure, couverte par Vitest :
journée totalement libre (retourne le créneau demandé tel quel),
journée partiellement occupée (retourne le premier trou après/entre les
tâches existantes), journée pleine (cascade au jour suivant), plusieurs
jours pleins d'affilée (cascade sur plusieurs jours), 30 jours pleins
d'affilée (retourne `null`), tâche à exclure du calcul (ne se bloque pas
elle-même si elle a déjà un `scheduledAt` dans la fenêtre testée).

---

## 2. Récurrence sur les tâches

Il n'existe aujourd'hui aucun mécanisme de récurrence dans le code — le
"récurrent" des skills est purement implicite (seuil de rappel en jours
depuis la dernière pratique). Ceci est une mécanique entièrement
nouvelle, réservée aux tâches (les skills gardent leur système de
rappel actuel, inchangé).

### Modèle de données

Migration additive sur `engagement`, 4 colonnes :

```sql
alter table saint_daily.engagement
  add column recurrence_series_id uuid,
  add column recurrence_type text not null default 'aucune'
    check (recurrence_type in ('aucune', 'quotidien', 'hebdomadaire', 'tous_les_n_jours')),
  add column recurrence_interval integer,
  add column recurrence_weekdays integer[];
```

- `recurrence_series_id` : partagé par toutes les occurrences d'une même
  série (`null` pour une tâche non récurrente). Généré à la création de
  la première occurrence.
- `recurrence_type` : `aucune` (défaut, tâche ponctuelle ou dernière
  occurrence d'une série arrêtée), `quotidien`, `hebdomadaire`,
  `tous_les_n_jours`.
- `recurrence_interval` : le N de "tous les N jours" — `null` sauf pour
  ce type.
- `recurrence_weekdays` : tableau d'entiers 0-6 (dimanche=0) pour
  `hebdomadaire` — `null` pour les autres types.

Chaque occurrence reste un `engagement` normal et indépendant : marquer
une occurrence comme faite (historique, archivage) fonctionne exactement
comme aujourd'hui, sans aucune interaction avec les autres occurrences
de la série.

### Génération

Fenêtre glissante de **8 semaines** à l'avance. Il n'existe pas d'infra
serveur dans ce projet (client Electron + Supabase Postgres, pas de
fonction planifiée) : la génération est déclenchée **côté client**, au
chargement de l'app — pour chaque série active (dernière occurrence non
archivée avec `recurrence_type != 'aucune'`), complète la fenêtre
jusqu'à 8 semaines après aujourd'hui si elle a pris du retard.

L'algorithme de génération d'occurrences (`generateOccurrences(rule, fromDate, untilDate)`)
est une fonction pure, testable indépendamment de la couche réseau :
étant donné une règle et une plage de dates, retourne la liste des
horodatages d'occurrence.

### Modification de la règle

La règle n'est modifiable que depuis la **prochaine occurrence non
complétée** de la série (même popover que le report rapide et la
priorité). Modifier la règle là :

1. Supprime réellement (pas d'archivage) toutes les autres occurrences
   futures non complétées de la série — elles n'ont jamais eu lieu et ne
   portent aucun historique, donc rien n'est perdu. **Première
   suppression réelle de l'app**, volontairement scopée à ce seul cas
   (occurrences auto-générées, jamais échues, sans `practice_entry`).
2. Régénère la fenêtre de 8 semaines à partir de cette date avec la
   nouvelle règle.

Repasser `recurrence_type` à `aucune` sur la prochaine occurrence arrête
la série — pas de bouton "arrêter" dédié, c'est le même mécanisme.

### Conflits de planification

Si une occurrence générée (nouvelle série ou régénération) tombe sur un
créneau déjà occupé par une autre tâche, la série/régénération se crée
quand même, mais un bandeau liste les conflits juste après l'action
("2 occurrences en conflit : lun. 14 sept. 10h, mer. 16 sept. 10h") —
l'utilisateur ajuste manuellement s'il le souhaite (via report rapide ou
en modifiant le créneau). Le bandeau disparaît à la navigation, il n'est
pas persistant.

### UI de création

`NouvelleTache.tsx` gagne un sélecteur de récurrence (bouton-groupe,
même pattern que priorité/durée) : Aucune (défaut) / Quotidien /
Hebdomadaire (avec sélection des jours) / Tous les N jours (avec un
champ numérique pour N).

### Hors scope

- "Sauter cette occurrence sans casser le streak" (idée du backlog
  original) — les tâches n'ont pas de notion de streak (concept
  actuellement réservé aux skills, basé sur les entrées de pratique).
  Pour ignorer une occurrence, on la reporte (report rapide) ou on
  arrête la série.
- Motifs mensuels ou "N-ième jour de la semaine du mois" — hors scope
  pour cette v1, seuls quotidien/hebdomadaire/tous-les-N-jours sont
  couverts.
- Édition en masse ("changer toutes les occurrences passées") —
  jamais applicable, les occurrences passées/complétées ne sont jamais
  touchées par une régénération.

### Tests

`generateOccurrences` est une fonction pure, couverte par Vitest :
quotidien sur une plage de N jours, hebdomadaire avec un ou plusieurs
jours sélectionnés, tous-les-N-jours, plage vide, règle `aucune`
(retourne une liste vide).

---

## 3. Sous-tâches et regroupement par projet

### Sous-tâches (réutilisation des jalons)

Aucun nouveau champ : `EngagementMilestone` (`{id, engagementId, label,
completedAt, position}`) existe déjà et sert aujourd'hui de jalons pour
les skills, affichés sur `DetailSkill.tsx`. Les tâches n'ayant pas
d'écran de détail dédié (elles se créent via `NouvelleTache.tsx` et
s'éditent via `TaskPopover.tsx`), la checklist s'affiche directement
dans `TaskPopover.tsx`, sous le sélecteur de priorité et les boutons de
report — même UI d'ajout/cochage/suppression que celle déjà en place
sur `DetailSkill.tsx` pour les jalons, réutilisée telle quelle sur une
tâche via son `engagementId`.

Cocher toutes les sous-tâches ne complète pas automatiquement la tâche
parente — comportement indépendant, cohérent avec le fait que les
jalons ne complètent jamais un skill aujourd'hui non plus.

### Regroupement par projet

Un projet est un `engagement` à part entière (nom, tags, notes) mais
jamais planifié (`scheduledAt` toujours `null`) ni jamais pratiqué (pas
de `practice_entry`). Comme un skill a lui aussi `scheduledAt: null`, un
nouveau champ distingue les deux :

```sql
alter table saint_daily.engagement
  add column is_project boolean not null default false,
  add column project_id uuid references saint_daily.engagement(id);
```

- `is_project` : `true` uniquement pour un projet. Un projet ne peut
  pas lui-même avoir de `project_id` (un seul niveau, pas de projet
  imbriqué dans un projet — vérifié en application, pas en contrainte
  SQL pour rester simple).
- `project_id` : sur une tâche ou un skill, pointe vers son projet
  (`null` = pas de projet). Jamais renseigné sur un projet lui-même.

**Effet de bord à corriger** : `Accueil.tsx` (`skills` useMemo) et
`ListeSkills.tsx` filtrent aujourd'hui les skills via `!scheduledAt`
seul — les deux doivent exclure aussi `isProject` pour qu'un projet
n'apparaisse pas comme un skill dans ces listes.

### Écrans

- `NouveauProjet.tsx` : formulaire de création (Nom, Tags, Notes — pas
  de niveau générique ni de priorité, un projet n'est ni pratiqué ni
  planifié). Crée un engagement avec `isProject: true`.
- `DetailProjet.tsx` : liste les enfants du projet (tâches et skills
  mélangés, filtrés par `project_id`), dans le même esprit visuel que
  `DetailSkill.tsx`.
- Un 5e icône dans le rail de navigation (`AppShell.tsx`) pour accéder
  à la liste des projets.

### Rattachement à un projet

Un sélecteur "Projet" (liste déroulante des projets existants + "Aucun")
apparaît :
- À la création, sur `NouvelleTache.tsx` et `NouveauSkill.tsx`.
- Après création, modifiable depuis `TaskPopover.tsx` (tâches) et
  `DetailSkill.tsx` (skills) — même principe write-on-change que la
  priorité.

### Hors scope

- Projets imbriqués (un projet dans un projet).
- Progression automatique d'un projet (% de sous-engagements complétés)
  — pourra être une pièce future si le besoin se confirme à l'usage.
- Suppression d'un projet — un projet suit la même règle que tout le
  reste de l'app aujourd'hui (pas de suppression), sauf le cas
  spécifique et déjà scopé des occurrences de récurrence ci-dessus.

### Tests

Aucune nouvelle fonction pure candidate à un test dédié — ce chantier
est un nouveau champ de relation, deux nouveaux écrans calqués sur des
écrans existants, et une réutilisation d'un mécanisme déjà en place.
Vérification manuelle contre la base réelle une fois la migration
appliquée.

---

## Note d'implémentation : croissance de TaskPopover

Les trois chantiers ajoutent chacun de l'UI à `TaskPopover.tsx`
(boutons de report, éditeur de règle de récurrence, checklist de
sous-tâches, sélecteur de projet), en plus de ce qui y est déjà
(priorité, complétion). Le plan d'implémentation doit prévoir d'extraire
ces blocs en sous-composants dédiés (ex. `RecurrenceEditor.tsx`,
`MilestoneChecklist.tsx`) au fur et à mesure plutôt que de laisser
`TaskPopover.tsx` devenir un fichier qui fait tout — cohérent avec le
principe du projet de fichiers focalisés à responsabilité unique.

## Migrations

Deux migrations additives, indépendantes l'une de l'autre :

- `0007_task_recurrence.sql` — les 4 colonnes de récurrence (section 2).
- `0008_project_grouping.sql` — `is_project` et `project_id` (section 3).

Le report rapide (section 1) ne touche aucun schéma — il ne fait que
lire/écrire les colonnes `scheduled_at`/`scheduled_ends_at` déjà en
place.

Même méthode que les migrations précédentes : l'utilisateur applique
chaque migration SQL dans l'éditeur SQL du dashboard Supabase, en une
seule exécution transaction-wrapped (`begin;`/`commit;`).

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Report rapide : portée | Tâches uniquement |
| "Plus tard aujourd'hui" / "Demain" | Recherche du prochain créneau libre (pas un décalage fixe) |
| Plage horaire de recherche | Aucune contrainte (0h–24h) |
| Aucun créneau trouvé | Cascade automatiquement au(x) jour(s) suivant(s), plafond 30 jours |
| Emplacement des boutons de report | Popover du calendrier uniquement |
| Après un report réussi | Popover fermé + message de confirmation |
| Motifs de récurrence v1 | Quotidien / Hebdomadaire (+ jours) / Tous les N jours |
| Génération des occurrences | Fenêtre glissante de 8 semaines, générée côté client |
| Modification de la règle | Modifiable, régénère les occurrences futures non complétées |
| Occurrences obsolètes lors d'un changement de règle | Suppression réelle (jamais échues, aucun historique) |
| Conflit de créneau généré | Bandeau listant les conflits après création/modification |
| Sous-tâches vs regroupement par projet | Deux mécanismes distincts, confirmé |
| Nature d'un projet | Engagement explicite, avec écran dédié |
| Rattachement à un projet | Modifiable après création, comme la priorité |

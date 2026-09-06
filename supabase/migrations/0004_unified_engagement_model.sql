-- Fusionne skill et tâche ponctuelle dans une seule table `engagement`,
-- distinguée uniquement par la présence de `scheduled_at` — premier
-- sous-projet de l'évolution "Daily Tool" (voir spec). Opérations de
-- métadonnées pures (ALTER TABLE ... RENAME), aucune réécriture de
-- données ; les contraintes de clé étrangère et les policies RLS restent
-- attachées aux mêmes objets (Postgres les retrouve par OID, pas par nom).
--
-- Transaction explicite : ce fichier est appliqué à la main sur la base de
-- production (voir Task 6, qui anticipe de rejouer seule l'instruction de
-- contrainte si son nom supposé est faux). Sans begin/commit, un échec en
-- cours de route laisserait le schéma à moitié renommé sans retour arrière
-- simple.
begin;

alter table saint_daily.skill rename to engagement;
alter table saint_daily.engagement add column scheduled_at timestamptz;

alter table saint_daily.skill_milestone rename to engagement_milestone;
alter table saint_daily.engagement_milestone rename column skill_id to engagement_id;

alter table saint_daily.practice_entry rename column skill_id to engagement_id;

-- Cocher une tâche ponctuelle comme faite insère une entrée à durée
-- nulle (voir spec, "Cocher une tâche comme faite") — la contrainte
-- d'origine (> 0) ne visait que les séances de pratique réelles, jamais
-- pensée pour ce nouveau cas d'usage.
alter table saint_daily.practice_entry drop constraint practice_entry_duration_minutes_check;
alter table saint_daily.practice_entry add constraint practice_entry_duration_minutes_check check (duration_minutes >= 0);

commit;

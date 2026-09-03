-- Sépare les tables de Saint Daily du schéma `public` partagé avec Saint
-- Gym, dans un schéma dédié `saint_daily`. Opération de métadonnées pure
-- (ALTER TABLE ... SET SCHEMA) : aucune ligne n'est réécrite, aucun
-- downtime, les policies RLS restent attachées aux tables telles quelles.
-- `public.profile` (propriété de Saint Gym) n'est pas touchée — les FK
-- vers profile(user_id) continuent de fonctionner à travers les schémas.
create schema if not exists saint_daily;

alter table public.skill set schema saint_daily;
alter table public.skill_milestone set schema saint_daily;
alter table public.practice_entry set schema saint_daily;
alter table public.skill_app_settings set schema saint_daily;

-- Le préfixe `skill_` devenait redondant une fois la table logée dans un
-- schéma qui porte déjà le nom de l'app.
alter table saint_daily.skill_app_settings rename to app_settings;

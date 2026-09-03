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

-- Un nouveau schéma Postgres ne reçoit pas les droits d'accès par défaut
-- du schéma `public` (GRANT USAGE TO anon, authenticated). Sans ces droits,
-- PostgREST refuserait l'accès même après que le schéma soit exposé dans
-- Supabase. Les politiques RLS ne s'appliquent que sur les accès autorisés.
grant usage on schema saint_daily to anon, authenticated, service_role;
grant all on all tables in schema saint_daily to anon, authenticated, service_role;
grant all on all routines in schema saint_daily to anon, authenticated, service_role;
grant all on all sequences in schema saint_daily to anon, authenticated, service_role;
alter default privileges for role postgres in schema saint_daily grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema saint_daily grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema saint_daily grant all on sequences to anon, authenticated, service_role;

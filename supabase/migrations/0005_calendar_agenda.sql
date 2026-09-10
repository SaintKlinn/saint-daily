-- Un « vrai créneau » a un début et une fin — scheduled_at seul (sous-projet
-- 1) ne suffit plus pour l'affichage calendrier. Additif, aucune donnée
-- existante n'est réécrite : les tâches déjà créées restent sans fin de
-- créneau et continuent de s'afficher normalement dans "Tâches à faire",
-- juste absentes du calendrier tant qu'aucune fin n'est connue.
begin;

alter table saint_daily.engagement add column scheduled_ends_at timestamptz;
alter table saint_daily.engagement add constraint engagement_scheduled_ends_at_check
  check (scheduled_ends_at is null or (scheduled_at is not null and scheduled_ends_at > scheduled_at));

alter table saint_daily.app_settings add column show_practice_in_calendar boolean not null default false;

commit;

begin;

-- Même famille que `archived_at` et `deleted_at` : un marqueur d'événement
-- nullable sur la ligne de l'occurrence concernée. Chaque occurrence d'une
-- série est sa propre ligne, donc passer mardi ne dit rien de mercredi.
alter table saint_daily.engagement
  add column skipped_at timestamptz;

commit;

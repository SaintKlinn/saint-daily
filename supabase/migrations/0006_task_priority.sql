-- Un seul niveau parmi quatre, même convention que generic_level déjà
-- en place sur cette table. S'applique à tout `engagement` (skills
-- compris) pour rester une seule table, mais ne s'affiche que sur les
-- tâches côté UI. Aucune donnée existante à réécrire : toute ligne déjà
-- présente prend 'aucune' via le défaut de colonne.
begin;

alter table saint_daily.engagement add column priority text not null default 'aucune'
  check (priority in ('aucune', 'basse', 'moyenne', 'elevee'));

commit;

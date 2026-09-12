begin;

-- Colonnes nullables : une contrainte `check` est satisfaite par NULL en
-- Postgres, donc « pas d'objectif » et « pas d'humeur » restent l'état par
-- défaut sans valeur par défaut explicite.
alter table saint_daily.engagement
  add column goal_period text check (goal_period in ('hebdomadaire', 'mensuel')),
  add column goal_metric text check (goal_metric in ('heures', 'seances')),
  add column goal_target numeric check (goal_target > 0);

alter table saint_daily.practice_entry
  add column mood text check (mood in ('difficile', 'moyen', 'correct', 'bien', 'excellent'));

commit;

begin;

alter table saint_daily.engagement
  add column recurrence_series_id uuid,
  add column recurrence_type text not null default 'aucune'
    check (recurrence_type in ('aucune', 'quotidien', 'hebdomadaire', 'tous_les_n_jours')),
  add column recurrence_interval integer,
  add column recurrence_weekdays integer[];

commit;

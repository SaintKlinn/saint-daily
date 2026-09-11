begin;

alter table saint_daily.engagement
  add column is_project boolean not null default false,
  add column project_id uuid references saint_daily.engagement(id);

commit;

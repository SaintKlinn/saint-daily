begin;

alter table saint_daily.engagement
  add column deleted_at timestamptz;

commit;

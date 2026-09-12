begin;

alter table saint_daily.app_settings
  add column reminder_lead_minutes integer not null default 10;

commit;

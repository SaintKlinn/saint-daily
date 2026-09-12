begin;

alter table saint_daily.app_settings
  add column weekly_review_dismissed_at timestamptz;

commit;

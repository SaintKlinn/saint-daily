-- Réglages du minuteur Pomodoro, ajoutés à la table de réglages existante
-- (pas de nouvelle table — voir spec 2026-09-02-pomodoro-timer-design.md).
-- Valeurs par défaut = technique Pomodoro classique.

alter table skill_app_settings
  add column pomodoro_work_minutes int not null default 25 check (pomodoro_work_minutes > 0),
  add column pomodoro_short_break_minutes int not null default 5 check (pomodoro_short_break_minutes > 0),
  add column pomodoro_long_break_minutes int not null default 15 check (pomodoro_long_break_minutes > 0),
  add column pomodoro_cycles_before_long_break int not null default 4 check (pomodoro_cycles_before_long_break > 0),
  add column pomodoro_auto_advance boolean not null default true;

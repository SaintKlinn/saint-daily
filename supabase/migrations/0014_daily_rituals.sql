begin;

alter table saint_daily.app_settings
  add column morning_greeting_dismissed_date date;

-- `profile` est restée dans `public` lors du déplacement des tables vers
-- `saint_daily` (voir 0003) : la clé étrangère traverse les schémas.
-- La contrainte d'unicité est le cœur du modèle : un seul bilan par jour,
-- ce qui permet à l'enregistrement d'être un `upsert` idempotent plutôt
-- qu'un « lire puis décider ».
create table saint_daily.daily_reflection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(user_id) on delete cascade,
  date date not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index daily_reflection_user_id_idx on saint_daily.daily_reflection (user_id);

alter table saint_daily.daily_reflection enable row level security;
create policy "daily_reflection_owner_all" on saint_daily.daily_reflection
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mêmes droits explicites qu'en 0013 : les `alter default privileges` de
-- 0003 ne se déclenchent que pour le rôle `postgres`, et sans ces droits
-- PostgREST refuse l'accès avant même que la RLS n'entre en jeu.
grant all on saint_daily.daily_reflection to anon, authenticated, service_role;

commit;

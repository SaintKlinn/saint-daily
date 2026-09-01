-- Nouvelles tables Saint Daily dans le projet Supabase partagé avec Saint
-- Gym. `profile` existe déjà (voir gym-tracker/gym/supabase/schema.sql) et
-- n'est pas recréée ici — un seul compte pour tout l'écosystème.

create table skill (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profile(user_id) on delete cascade,
  name text not null,
  notes text,
  tags text[] not null default '{}',
  generic_level text not null default 'debutant' -- auto-déclaré par l'utilisateur, pas calculé
    check (generic_level in ('debutant', 'intermediaire', 'avance', 'expert')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table skill_milestone (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  label text not null,
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table practice_entry (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  user_id uuid not null references profile(user_id) on delete cascade,
  duration_minutes int not null check (duration_minutes > 0),
  note text,
  practiced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table skill_app_settings (
  user_id uuid primary key references profile(user_id) on delete cascade,
  reminder_threshold_days int not null default 5 check (reminder_threshold_days > 0),
  notifications_enabled boolean not null default true,
  auto_launch_enabled boolean not null default true
);

-- Row Level Security : chaque table filtrée sur son propriétaire, aucun
-- partage (Saint Daily v1 est 100% personnel, cf. spec).

alter table skill enable row level security;
create policy "skill_owner_all" on skill
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table skill_milestone enable row level security;
create policy "skill_milestone_owner_all" on skill_milestone
  for all
  using (exists (
    select 1 from skill where skill.id = skill_milestone.skill_id and skill.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from skill where skill.id = skill_milestone.skill_id and skill.user_id = auth.uid()
  ));

alter table practice_entry enable row level security;
create policy "practice_entry_owner_all" on practice_entry
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table skill_app_settings enable row level security;
create policy "skill_app_settings_owner_all" on skill_app_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index skill_user_id_idx on skill (user_id);
create index skill_milestone_skill_id_idx on skill_milestone (skill_id);
create index practice_entry_skill_id_idx on practice_entry (skill_id);
create index practice_entry_user_id_idx on practice_entry (user_id);

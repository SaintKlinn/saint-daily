begin;

alter table saint_daily.practice_entry
  add column tags text[] not null default '{}';

-- `profile` appartient à Saint Gym et est restée dans `public` lors du
-- déplacement des tables vers `saint_daily` (voir 0003) : la clé étrangère
-- traverse donc les schémas, comme celles posées par 0001.
create table saint_daily.note_template (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(user_id) on delete cascade,
  text text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table saint_daily.note_template enable row level security;
create policy "note_template_owner_all" on saint_daily.note_template
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 0003 a posé des `alter default privileges` qui couvriraient cette table
-- si elle est créée par le rôle `postgres`, mais on ne parie pas sur le
-- rôle qui exécutera la migration : sans ces droits, PostgREST refuse
-- l'accès avant même que la RLS n'entre en jeu, et l'erreur ne ressemble
-- pas du tout à un problème de permissions.
grant all on saint_daily.note_template to anon, authenticated, service_role;

commit;

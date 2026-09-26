begin;

-- Liaison plusieurs-à-plusieurs entre un engagement et les projets auxquels
-- il appartient. Un skill peut désormais servir plusieurs chantiers — c'est
-- ce que le `project_id` unique de 0008 ne pouvait pas exprimer.
--
-- `profile` appartient à Saint Gym et est restée dans `public` lors du
-- déplacement des tables vers `saint_daily` (voir 0003) : la clé étrangère
-- d'appartenance traverse donc les schémas, comme celles posées par 0001.
--
-- Les deux clés étrangères vers `engagement` prennent `on delete cascade`,
-- que le `project_id` de 0008 n'a jamais eu. C'est ce manque qui rend une
-- purge en lot impossible aujourd'hui : elle devrait supprimer les enfants
-- avant les parents. La nouvelle table n'hérite pas du problème.
--
-- `check (engagement_id <> project_id)` : un projet étant lui-même un
-- engagement, cette table autorise un projet dans un projet — c'est voulu,
-- les sous-projets en sortent gratuitement. Elle autoriserait aussi qu'un
-- engagement s'appartienne, ce que le check interdit. Les cycles plus longs
-- (A dans B dans A) restent possibles et devront être traités par le
-- chantier qui exposera les sous-projets, en protégeant toute traversée
-- récursive par un ensemble de visités.
create table saint_daily.engagement_project (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile(user_id) on delete cascade,
  engagement_id uuid not null references saint_daily.engagement(id) on delete cascade,
  project_id uuid not null references saint_daily.engagement(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (engagement_id, project_id),
  check (engagement_id <> project_id)
);

create index engagement_project_user_id_idx on saint_daily.engagement_project (user_id);

alter table saint_daily.engagement_project enable row level security;
create policy "engagement_project_owner_all" on saint_daily.engagement_project
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 0003 a posé des `alter default privileges` qui couvriraient cette table si
-- elle est créée par le rôle `postgres`, mais on ne parie pas sur le rôle qui
-- exécutera la migration : sans ces droits, PostgREST refuse l'accès avant
-- même que la RLS n'entre en jeu, et l'erreur ne ressemble pas du tout à un
-- problème de permissions.
grant all on saint_daily.engagement_project to anon, authenticated, service_role;

-- Reprise des rattachements existants.
--
-- `project_id` N'EST PAS supprimée, et ne doit pas l'être ici : l'application
-- installée la lit encore. Une migration qui retire ce qu'une version
-- déployée interroge est exactement ce qui a cassé la 1.5.1, quand
-- `saint_daily.skill` a été renommée en `engagement`. Sa suppression sera un
-- chantier d'après-release.
--
-- `project_id <> id` : rien n'a jamais empêché qu'une ligne se désigne
-- elle-même, la colonne de 0008 n'ayant aucune contrainte. Une telle ligne
-- violerait le check ci-dessus et ferait échouer toute la transaction. On
-- l'écarte de la reprise plutôt que de risquer une migration qui ne passe
-- pas, au prix d'un rattachement absurde perdu.
insert into saint_daily.engagement_project (user_id, engagement_id, project_id)
select user_id, id, project_id
  from saint_daily.engagement
 where project_id is not null
   and project_id <> id;

-- Les deux colonnes ci-dessous sont posées maintenant et exposées par des
-- chantiers ultérieurs. Une colonne coûte une ligne dans une migration qu'on
-- écrit de toute façon, contre une migration entière à appliquer à la main
-- plus tard : c'est ce qui permet à la série complète des chantiers Projets
-- de ne demander qu'une seule application de SQL.

-- L'échéance d'un chantier. Délibérément une colonne à elle, et non un
-- détournement du `scheduled_at` qui existe déjà sur tout engagement : le
-- calendrier affiche `scheduled_at` avec `scheduled_ends_at` et ne filtre pas
-- `is_project`, et le champ veut dire « quand c'est planifié », pas « quand
-- c'est dû ».
alter table saint_daily.engagement
  add column due_at timestamptz;

-- Le chantier courant, celui que l'Accueil mettra en tête. Un seul par
-- construction, puisqu'il y a une ligne de réglages par utilisateur.
-- `on delete set null` : un projet purgé efface la désignation au lieu de
-- bloquer sa suppression.
--
-- ATTENTION côté code : ne jamais ajouter cette clé à `DEFAULT_SETTINGS` ni à
-- `toRow` tant que cette migration n'est pas appliquée. `useSettings` crée la
-- ligne par `.insert({ user_id, ...toRow(DEFAULT_SETTINGS) })` — une clé de
-- plus nommerait une colonne inexistante, l'INSERT échouerait, `settings`
-- resterait null pour toujours et tout l'écran Réglages deviendrait
-- inaccessible.
alter table saint_daily.app_settings
  add column current_project_id uuid references saint_daily.engagement(id) on delete set null;

commit;

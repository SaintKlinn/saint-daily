-- Correctifs de l'audit RLS / index du 2026-09-28 (sévérités haute et
-- moyenne) — constats et méthode dans
-- docs/superpowers/specs/2026-09-28-audit-rls-index-constats.md.
--
-- Rejouable sans risque : chaque instruction est idempotente (`if not
-- exists`, et un `revoke` de droits déjà retirés ne fait rien). Aucune donnée
-- n'est touchée, aucune colonne n'est ajoutée : l'app n'a rien à attendre de
-- cette migration pour continuer à fonctionner, avant comme après.

begin;

-- ---------------------------------------------------------------------------
-- 1. Index de clés étrangères manquants
-- ---------------------------------------------------------------------------

-- `engagement.project_id` (0008) : clé étrangère vers `engagement` elle-même,
-- sans index ni `on delete`. Chaque suppression d'un engagement parcourait
-- donc toute la table pour vérifier qu'aucun enfant ne le référence, et l'app
-- filtre explicitement sur cette colonne à chaque mise à la corbeille,
-- restauration ou suppression d'un projet (useEngagements.ts). `engagement`
-- est la table qui grossit le plus : les séries récurrentes y créent une
-- ligne par occurrence.
create index if not exists engagement_project_id_idx
  on saint_daily.engagement (project_id);

-- `engagement_project.project_id` (0016) : la contrainte unique
-- (engagement_id, project_id) indexe `engagement_id` en tête, pas
-- `project_id`. Or l'app lit la composition d'un projet par `project_id`
-- (useLiaisonsProjet.ts), et la suppression d'un projet cascade sur cette
-- colonne.
create index if not exists engagement_project_project_id_idx
  on saint_daily.engagement_project (project_id);

-- ---------------------------------------------------------------------------
-- 2. Index pour le tri des séances
-- ---------------------------------------------------------------------------

-- Journal et Bilan chargent toutes les séances du compte, triées de la plus
-- récente à la plus ancienne et paginées par 1000 (usePracticeEntries.ts) ;
-- la fiche d'un skill fait de même pour un seul engagement. Les index
-- existants (user_id seul, engagement_id seul) obligeaient à trier en
-- mémoire à chaque ouverture de ces écrans.
create index if not exists practice_entry_user_id_practiced_at_idx
  on saint_daily.practice_entry (user_id, practiced_at desc);

create index if not exists practice_entry_engagement_id_practiced_at_idx
  on saint_daily.practice_entry (engagement_id, practiced_at desc);

-- ---------------------------------------------------------------------------
-- 3. Droits des rôles de l'API
-- ---------------------------------------------------------------------------

-- 0003 a accordé TOUS les droits sur le schéma à `anon`, y compris pour les
-- tables futures. `anon` est le rôle de la clé publique, embarquée dans
-- l'installeur : il n'a besoin de rien ici, l'app ne lit ni n'écrit ce schéma
-- avant la connexion (AuthGate). Aujourd'hui, seule RLS le tenait à l'écart —
-- une table ajoutée un jour sans `enable row level security` lui aurait été
-- ouverte en lecture et en écriture. L'usage du schéma est conservé, pour que
-- l'API réponde « aucun droit » plutôt qu'une erreur de schéma.
revoke all on all tables in schema saint_daily from anon;
revoke all on all sequences in schema saint_daily from anon;
revoke all on all functions in schema saint_daily from anon;
alter default privileges for role postgres in schema saint_daily revoke all on tables from anon;
alter default privileges for role postgres in schema saint_daily revoke all on sequences from anon;
alter default privileges for role postgres in schema saint_daily revoke all on functions from anon;

-- `TRUNCATE` ignore RLS : il vide la table pour TOUS les comptes. L'API ne
-- l'expose pas (elle ne fait que lire, insérer, modifier et supprimer), donc
-- rien n'était exploitable ; mais aucun usage de l'app n'en a besoin, pas plus
-- que de `REFERENCES` ou `TRIGGER`.
revoke truncate, references, trigger on all tables in schema saint_daily from authenticated;
alter default privileges for role postgres in schema saint_daily
  revoke truncate, references, trigger on tables from authenticated;

commit;

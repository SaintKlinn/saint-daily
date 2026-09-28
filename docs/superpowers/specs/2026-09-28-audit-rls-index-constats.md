# Audit RLS et index — constats (2026-09-28)

## Méthode

Mêmes vérifications que l'audit de Saint Gym (`gym`,
`docs/superpowers/specs/2026-09-05-schema-audit-findings.md`) :
1. policies RLS ;
2. index des clés étrangères ;
3. colonnes filtrées ou triées par l'app ;
4. droits des rôles de l'API, ajouté ici.

Plutôt que de relire le SQL à l'œil, les 16 migrations ont été **rejouées sur
un PostgreSQL 16 local**. Une imitation minimale de Supabase fournit les rôles
`anon`, `authenticated` et `service_role`, la fonction `auth.uid()` lue depuis
`request.jwt.claim.sub`, et `public.profile`. Le catalogue de cette base
(`pg_constraint`, `pg_index`, `pg_default_acl`,
`information_schema.role_table_grants`) a été croisé avec les requêtes de
`src/renderer/src/hooks/`. Chaque constat a été reproduit par une requête
réelle, jouée sous le rôle concerné.

**Ce n'est pas un audit des bugs applicatifs.**

## Vérifié et conforme

- **RLS activée sur les 7 tables** du schéma `saint_daily` : `engagement`,
  `engagement_milestone`, `practice_entry`, `app_settings`, `note_template`,
  `daily_reflection` et `engagement_project`.
- **Policies cohérentes** : chaque table porte une policy `for all` limitée au
  propriétaire (`auth.uid() = user_id`). Seule exception, `engagement_milestone`,
  qui n'a pas de `user_id` et vérifie la propriété de l'engagement parent par
  une sous-requête appuyée sur sa clé primaire.
- **Aucune ligne d'un autre compte n'est visible.** Un compte B ne voit pas le
  projet d'un compte A, même en connaissant son identifiant.

---

## Haute (1) — corrigé dans `0017_audit_rls_index.sql`

- **`engagement.project_id` sans index** (clé étrangère ajoutée en 0008, vers
  `engagement` elle-même, sans `on delete`).
  - **Coût à chaque suppression :** toute suppression d'un engagement
    parcourait toute la table pour vérifier qu'aucun enfant ne le référence.
  - **Colonne filtrée par l'app :** `.eq('project_id', …)` quatre fois dans
    `useEngagements.ts` (mise à la corbeille, restauration, suppression d'un
    projet).
  - **Table qui grossit :** `engagement` est la plus volumineuse du schéma, les
    séries récurrentes y créant une ligne par occurrence.
  - **Vérification :** après correction, la mise à la corbeille des enfants
    d'un projet passe par `engagement_project_id_idx`.

## Moyenne (3) — corrigé dans `0017_audit_rls_index.sql`

- **`engagement_project.project_id` sans index.** La contrainte unique
  `(engagement_id, project_id)` ne couvre que `engagement_id` en tête. Or la
  composition d'un projet est lue par `project_id` (`useLiaisonsProjet.ts:119`),
  et la suppression d'un projet cascade sur cette colonne.
- **Séances triées sans index adapté.**
  - **Les requêtes :** Journal et Bilan chargent toutes les séances du compte,
    triées par `practiced_at desc` et paginées par 1000
    (`usePracticeEntries.ts:241`) ; la fiche d'un skill fait de même par
    `engagement_id` (`usePracticeEntries.ts:88`).
  - **La mesure, sur un compte de 15 000 séances :** une page coûtait 25 ms
    (lecture des 15 410 lignes, puis tri). Avec
    `(user_id, practiced_at desc)`, elle coûte 2 ms en ne lisant que les
    lignes utiles.
  - **La correction :** index composites `(user_id, practiced_at desc)` et
    `(engagement_id, practiced_at desc)`.
- **Droits beaucoup trop larges pour `anon` et `authenticated`.**
  - **L'origine :** 0003 accorde tous les droits du schéma à `anon` et à
    `authenticated`, y compris par défaut pour toute table future.
  - **Pourquoi c'est un risque :** `anon` est le rôle de la clé publique,
    embarquée dans l'installeur, et l'app n'en a pas besoin, puisqu'elle ne
    touche ce schéma qu'une fois connectée (`AuthGate`). Seule RLS le tenait à
    l'écart : une table créée un jour sans `enable row level security` lui
    aurait été ouverte en lecture et en écriture.
  - **Le cas `TRUNCATE` :** ce droit ignore RLS. Joué directement en SQL sous
    `anon`, il vide `engagement` et, en cascade, cinq autres tables, pour tous
    les comptes. **Ce n'est pas exploitable par l'API** : PostgREST ne sait que
    lire, insérer, modifier et supprimer, et le schéma n'expose aucune fonction.
    Mais aucun usage ne justifie ce droit, ni `REFERENCES`, ni `TRIGGER`.
  - **La correction :** tous les droits sont retirés à `anon` (tables,
    séquences, fonctions, et droits par défaut) ; `TRUNCATE`, `REFERENCES` et
    `TRIGGER` sont retirés à `authenticated`.
  - **Vérifié :** un utilisateur connecté garde lecture, insertion,
    modification et suppression sur toutes les tables ; `anon` reçoit
    « permission denied », y compris pour une table créée après la migration.

## Basse (4) — non corrigé, à arbitrer

- **Un compte peut référencer l'engagement d'un autre compte.**
  - **La cause :** les policies ne vérifient que le `user_id` de la ligne
    écrite, pas celui de l'engagement référencé. Sont concernés
    `practice_entry.engagement_id`, `engagement.project_id`,
    `engagement_project.engagement_id` et `.project_id`, et
    `app_settings.current_project_id`.
  - **L'effet :** reproduit en local, un compte B a rattaché sa tâche au projet
    d'un compte A ; A ne pouvait alors plus supprimer son projet (violation de
    `engagement_project_id_fkey`).
  - **Pourquoi « basse » :** B doit connaître l'identifiant du projet, un UUID
    aléatoire que l'API ne lui montre jamais.
  - **La correction possible :** ajouter à chaque `with check` une condition
    `exists (…)` sur la propriété de l'engagement référencé, au prix d'une
    sous-requête par écriture.
- **Colonne jamais utilisée.** `app_settings.current_project_id` (0016)
  n'est lue ni écrite nulle part dans l'app. C'est aussi une clé étrangère
  sans index, sans conséquence sur une table d'une ligne par compte. Elle
  n'est pas supprimée : l'opération est irréversible, et elle est prévue pour
  le chantier courant sur l'Accueil. (`engagement.due_at`, citée ici à
  l'origine, est depuis exposée : c'est l'échéance des projets.)
- **Index devenus redondants.** `practice_entry_user_id_idx` et
  `practice_entry_skill_id_idx` sont couverts par les nouveaux index
  composites, qui commencent par la même colonne. Les garder ne coûte qu'un peu
  d'écriture ; les supprimer peut se faire plus tard, une fois 0017 en place.
- **Noms d'index hérités.** `skill_user_id_idx`, `skill_milestone_skill_id_idx`
  et `practice_entry_skill_id_idx` portent encore les noms d'avant le
  renommage des tables et des colonnes en 0004. Purement cosmétique.

---

## Appliquer la migration

Comme les précédentes : coller `supabase/migrations/0017_audit_rls_index.sql`
dans l'éditeur SQL du projet Supabase.

- **Rejouable sans risque :** elle a été appliquée deux fois de suite en local
  sans erreur.
- **Sans effet sur les données :** elle ne touche à aucune donnée et n'ajoute
  aucune colonne. L'app fonctionne avant comme après.

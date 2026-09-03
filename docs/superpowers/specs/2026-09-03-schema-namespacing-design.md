# Saint Daily — schéma Postgres dédié par app

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-03

## Contexte

Saint Daily partage son projet Supabase avec Saint Gym (dépôt `gym-tracker`,
`gym/supabase/schema.sql`, 1691 lignes, 22 tables — programme
d'entraînement, séances, réseau social avec follow/block/messages,
coaching, notifications). Le seul lien entre les deux apps est la table
`profile`, créée par Saint Gym et référencée par clé étrangère depuis les 4
tables de Saint Daily (`skill`, `skill_milestone`, `practice_entry`,
`skill_app_settings`) — un seul compte pour tout l'écosystème.

Toutes les tables des deux apps vivent aujourd'hui dans le schéma
`public`, sans séparation structurelle. Ce document a été déclenché par
quatre préoccupations concrètes (toutes retenues) :

1. **Risque de collision de noms** entre apps qui évoluent indépendamment
   (illustré cette même session par une erreur `relation "skill" already
   exists`, elle-même due à une ré-exécution accidentelle d'une migration
   déjà appliquée — pas une vraie collision Saint Daily/Saint Gym, mais un
   symptôme du même problème de fond : rien n'empêche structurellement ce
   genre de confusion).
2. **Confusion sur la propriété** : impossible de voir d'un coup d'œil,
   dans la base, quelles tables appartiennent à quelle app.
3. **Sécurité / isolation des données** au-delà des seules policies RLS.
4. **Préparer l'arrivée de futures apps** de l'écosystème Saint sans
   renégocier les noms à chaque fois.

## Décision de phasage

Saint Gym est une app mature, live, dont je ne connais pas encore le code
en détail — son schéma (22 tables), ses policies RLS, son code client
Supabase. Saint Daily (4 tables) est entièrement sous mon contrôle. Ce
chantier établit le pattern sur Saint Daily uniquement ; **la migration des
tables de Saint Gym vers son propre schéma est explicitement hors scope**
et fera l'objet d'un second brainstorm séparé, avec son propre design, le
jour où l'utilisateur voudra s'y attaquer.

## Architecture : un schéma Postgres par app

Un nouveau schéma `saint_daily` devient propriétaire des 4 tables de
l'app. `public` reste le seul schéma partagé, réservé à `profile` (et à
tout futur primitif réellement inter-apps — rien d'autre aujourd'hui).

```
public.profile                    ← partagé, écosystème entier
saint_daily.skill                 ← propriété exclusive de Saint Daily
saint_daily.skill_milestone
saint_daily.practice_entry
saint_daily.app_settings          ← renommé depuis skill_app_settings (voir plus bas)

saint_gym.*                       ← hors scope de ce chantier, encore dans
                                     public pour l'instant
```

C'est le pattern standard pour "plusieurs apps, une base partagée", et il
répond aux quatre préoccupations en une seule décision structurelle :

- **Collision impossible par construction** — `saint_daily.skill` et un
  éventuel `saint_gym.skill` ne se percutent jamais, quel que soit le nom
  choisi indépendamment par chaque app.
- **Propriété visible d'un coup d'œil** — le nom du schéma dans
  `\dt saint_daily.*` ou dans n'importe quel client SQL dit directement
  quelle app possède la table.
- **Isolation renforçable** — un schéma est un objet Postgres qui accepte
  ses propres `GRANT`/`REVOKE`, en plus des policies RLS déjà en place à
  l'intérieur de chaque table (RLS n'est pas remplacée, juste complétée).
- **Futures apps** — la convention est déjà écrite plus bas : chaque
  nouvelle app suit le même schéma dès sa première migration, sans jamais
  avoir à vérifier si un nom est déjà pris ailleurs.

## Renommage : `skill_app_settings` → `app_settings`

Une fois logé dans `saint_daily`, le préfixe `skill_` du nom de table
devient redondant (le schéma joue déjà ce rôle). Renommé en
`app_settings` au passage de la même migration. Impact côté code
applicatif Saint Daily : `src/renderer/src/lib/types.ts` (le type
`SkillAppSettings` peut rester tel quel — c'est un nom TypeScript, pas une
contrainte de nommage SQL, à la discrétion de l'implémentation) et
`src/renderer/src/hooks/useSettings.ts` (la requête `.from('skill_app_settings')`
devient `.from('app_settings')`) devront être mis à jour dans le plan.

## Mécanique de la migration SQL

`ALTER TABLE ... SET SCHEMA` est une opération de métadonnées catalogue
pur — aucune réécriture de données, quasi instantanée, aucun downtime.
Les policies RLS restent attachées à la table elle-même et n'ont rien à
changer ; les contraintes de clé étrangère vers `public.profile`
continuent de fonctionner normalement à travers les schémas (Postgres ne
restreint pas les FK à un même schéma).

Nouvelle migration (`supabase/migrations/0003_saint_daily_schema.sql`) :

```sql
create schema if not exists saint_daily;

alter table public.skill set schema saint_daily;
alter table public.skill_milestone set schema saint_daily;
alter table public.practice_entry set schema saint_daily;
alter table public.skill_app_settings set schema saint_daily;
alter table saint_daily.skill_app_settings rename to app_settings;
```

Les migrations `0001`/`0002` existantes ne sont pas réécrites (elles ont
créé les tables dans `public`, ce qui était correct à l'époque) — `0003`
est une migration de déplacement, appliquée une fois sur la base existante.

## Changements de code applicatif

Confirmé par lecture directe : `src/renderer/src/lib/supabase.ts` a un
point de création unique (`getSupabaseClient()`), et **aucun fichier** du
code Saint Daily ne fait de requête directe sur `profile` (uniquement des
clés étrangères + RLS via `auth.uid()`). Le changement de code se limite
donc à :

1. `supabase.ts` : ajouter `db: { schema: 'saint_daily' }` aux options de
   `createClient(url, anonKey, { db: { schema: 'saint_daily' }, auth: {...} })`.
2. `useSettings.ts` : `.from('skill_app_settings')` → `.from('app_settings')`
   (seul endroit référençant ce nom de table).

Aucun autre hook (`useSkills`, `useMilestones`, `usePracticeEntries`) n'a
besoin de changement : une fois le schéma par défaut du client fixé à
`saint_daily`, tous les `.from('skill')`, `.from('skill_milestone')`,
`.from('practice_entry')` résolvent automatiquement dans le bon schéma.

## Étape manuelle requise (Supabase, hors de mon contrôle)

PostgREST (l'API REST que Supabase expose) ne sert par défaut que le
schéma `public`. Pour que `saint_daily` devienne interrogeable depuis
l'app, l'utilisateur doit l'ajouter manuellement dans le dashboard
Supabase : **Project Settings → API → Exposed schemas**, ajouter
`saint_daily` à la liste (garder `public`). Geste ponctuel, à faire une
seule fois après l'application de la migration `0003`.

## Hors scope (rappel)

- La migration des 21 tables de Saint Gym vers `saint_gym` — chantier
  séparé, futur, avec son propre brainstorm.
- Toute modification du code ou des policies RLS de `gym-tracker`.
- Le renforcement effectif des `GRANT`/`REVOKE` au niveau schéma
  au-delà de ce qu'exigent RLS et l'exposition PostgREST — possible plus
  tard, non nécessaire pour que ce chantier fonctionne.

## Tests / vérification

Pas de test automatisé pour une migration SQL de déplacement de schéma —
vérifié manuellement : appliquer `0003` sur la base réelle, ajouter
`saint_daily` aux schémas exposés, relancer l'app en local, confirmer que
la liste des skills, les entrées de pratique, les jalons et les réglages
se chargent et s'écrivent normalement (mêmes hooks, mêmes écrans, aucun
changement de comportement attendu — seul le schéma cible change).

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Périmètre | Saint Daily uniquement pour ce chantier ; Saint Gym reste sur la table pour un futur chantier séparé |
| Motivation | Les 4 préoccupations retenues : collision, propriété, isolation, futures apps |
| Phasage | Établir le pattern sur Saint Daily d'abord, Saint Gym en second chantier |
| Architecture | Un schéma Postgres dédié par app (`saint_daily`), `profile` reste seul partagé dans `public` |
| Renommage | `skill_app_settings` → `app_settings` (le préfixe devient redondant dans le nouveau schéma) |

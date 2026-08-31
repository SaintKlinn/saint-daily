# Saint Daily — suivi de progression de skills

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-08-31

## Contexte

Saint Daily est le deuxième module de l'écosystème personnel « second cerveau »,
après [Saint Gym](../../../../gym-tracker/gym) (suivi de musculation). Les deux
apps partagent la même identité visuelle (technique du logo, structure des
tokens de couleur) et, pour Saint Daily, le même projet Supabase que Saint Gym
— un compte unique pour tout l'écosystème.

Le nom de travail « Skill Forum » évoquait une couche sociale ; ce n'est **pas**
le cas ici. Saint Daily v1 est un outil 100% personnel de suivi de progression
de skills (musique, code, langues, sport, etc.) : combien de temps pratiqué,
quelles notes en retenir, quels jalons franchis.

### Critères de succès (les trois à la fois, pas un choix exclusif)

- **Régularité** — ne plus abandonner un skill après deux semaines. Rappels et
  streaks visibles.
- **Archive** — retrouver une note ou une réflexion passée sur un skill.
  Recherche texte.
- **Progression visible** — voir concrètement la croissance dans le temps.
  Graphes, dans le même esprit que ceux de Saint Gym.

## Hors scope (v1)

Explicitement écarté, à ne pas construire maintenant :

- **Couche sociale** — pas de profils publics, follow, commentaires. Toutes les
  données sont privées à leur propriétaire.
- **Mode hors-ligne** — pas de queue locale/sync différée. Une action qui
  échoue faute de connexion affiche une erreur et reste éditable, point.
  Assumé comme Saint Gym (cf. ses propres limites documentées).
- **Présence web publique** — aucune URL indexable. En conséquence :
  robots.txt, sitemap.xml, canonical URLs, cartes de partage social et bandeau
  de cookie consent ne s'appliquent pas et ne sont pas construits.
- **Version mobile** — hors scope. Ce serait un projet séparé (app mobile
  companion), pas un ajout à celui-ci.
- **macOS / Linux** — Electron le permettrait techniquement, mais packaging,
  signature et tests ne couvrent que **Windows** pour la v1.
- **Design visuel détaillé** — mise en page exacte, styles précis des écrans,
  micro-interactions. Ce document fixe l'architecture et les données ; le
  détail visuel fait l'objet d'un brainstorming séparé une fois l'app
  opérationnelle (scaffold + auth + CRUD de base qui tournent).

## Architecture

- **Electron** (cible Windows v1) avec **Vite + React + TypeScript + Tailwind**
  dans le renderer — pattern standard pour une app Electron+Supabase, plus
  léger et mieux documenté qu'embarquer un serveur Next.js dans l'app.
- Client **Supabase** (`@supabase/supabase-js`) direct dans le renderer, même
  projet que Saint Gym → même `auth.users` / `profile`, un seul login pour tout
  l'écosystème. Pas de nouveau système d'auth à construire.
- Process principal Electron : fenêtre, **system tray**, **notifications
  natives**, **lancement automatique au démarrage de session** (nécessaire
  pour que les rappels de régularité aient un sens même app fermée).
- Thème graphique et logo portés dans un module dédié à Saint Daily, sur le
  même schéma que `lib/theme.ts` + `lib/logoRays.ts` de Saint Gym (voir
  section dédiée ci-dessous).
- Pas de dépendance de graphes externe — SVG natif, comme Saint Gym.

## Thème graphique

- **Emerald Ink** — `#064E3B` — couleur d'encre / fond, équivalent du rôle
  `base` de Saint Gym (qui y est proche du noir ; ici, vert émeraude foncé).
- **Champagne** — `#F8E7C9` — couleur claire, équivalent du rôle `cream` de
  Saint Gym (texte sur fond sombre, surfaces claires).

Ces deux couleurs sont l'ancrage de la palette et **ne changent pas**.

Validé lors du brainstorming visuel (canvas de maquettes, voir
`design/canvas/`) :

- **Accent doré** — `#E7B94E` (bright) / `#C08A2A` (mid) / `#8A5F1B` (deep) —
  même rôle que le laiton de Saint Gym (CTA, highlights, mise en avant), sur
  le même schéma `bright`/`mid`/`deep`.
- **Typographie** — IBM Plex Serif (titres), IBM Plex Sans (texte courant),
  IBM Plex Mono (données chiffrées — durées, dates), via Google Fonts.

Restent à définir plus tard si besoin : teintes `muted`, couleur `danger`,
variations de `roleBg`/`roleText` (probablement pas nécessaires vu l'absence
de couche sociale/rôles).

Le mark du logo (rayons SVG procéduraux, demi-dessin reflété — coordonnées
`LOGO_RAYS/LOGO_VIEWBOX` fournies par l'utilisateur) est centralisé dans un
module dédié (`lib/logoRays.ts` + `lib/theme.ts` équivalents pour Saint
Daily), même technique que Saint Gym : source unique consommée à la fois par
le rendu in-app (SVG React) et par la génération des icônes (fenêtre,
taskbar, installeur), avec l'accent doré à la place du laiton de Saint Gym.
**Implémentation : les 17 rayons exacts de `LOGO_RAYS` fournis par
l'utilisateur, pas une approximation** — le canvas de maquettes utilise une
version simplifiée à 7 rayons pour le placeholder visuel du header, qui n'est
pas la source de vérité du dessin.

## Modèle de données

Nouvelles tables dans le projet Supabase existant, toutes rattachées à
`profile(user_id)` (donc à `auth.users`). Aucune nouvelle table de compte —
`profile` est réutilisée telle quelle.

```sql
create table skill (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profile(user_id) on delete cascade,
  name text not null,
  notes text,                          -- partie « second cerveau » : réflexions libres sur le skill
  tags text[] not null default '{}',   -- étiquettes libres, pas de table de vocabulaire séparée en v1
  generic_level text not null default 'debutant'   -- auto-déclaré par l'utilisateur, pas calculé
    check (generic_level in ('debutant', 'intermediaire', 'avance', 'expert')),
  archived_at timestamptz,             -- pause sans supprimer l'historique
  created_at timestamptz not null default now()
);

create table skill_milestone (        -- jalons personnalisés, optionnels
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  label text not null,
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table practice_entry (          -- le journal de pratique
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skill(id) on delete cascade,
  user_id uuid not null references profile(user_id) on delete cascade,
  duration_minutes int not null check (duration_minutes > 0),
  note text,
  practiced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table skill_app_settings (      -- réglages propres à Saint Daily, séparés de `profile`
  user_id uuid primary key references profile(user_id) on delete cascade,
  reminder_threshold_days int not null default 5 check (reminder_threshold_days > 0),
  notifications_enabled boolean not null default true,
  auto_launch_enabled boolean not null default true
);
```

**RLS** : chaque table filtrée sur le propriétaire (`auth.uid() = user_id`
direct sur `skill`, `practice_entry`, `skill_app_settings` ; via jointure sur
`skill.user_id` pour `skill_milestone`, qui n'a pas de `user_id` propre).
Aucune policy de lecture partagée — cohérent avec « 100% personnel ».

**Streaks et « pas pratiqué depuis N jours »** sont calculés à partir de
`practice_entry.practiced_at` (agrégation côté client, ou vue Postgres si les
perfs l'exigent plus tard) — pas stockés en tant que tels.

## Écrans (fonctionnel — la mise en page précise est hors scope de ce document)

- **Accueil** — skills actifs, streaks, rappels dus (skill non pratiqué depuis
  plus de `reminder_threshold_days`), CTA « Nouvelle entrée » toujours
  visible.
- **Liste des skills** — filtrable par tag, recherche texte (nom + notes).
  Skills archivés (`archived_at` non nul) masqués par défaut, visibles via un
  toggle « voir les skills en pause ».
- **Détail d'un skill** — niveau générique éditable, jalons personnalisés
  cochables, journal chronologique des entrées de pratique, graphe de
  progression (heures cumulées dans le temps, SVG natif), action
  archiver/désarchiver.
- **Nouvelle entrée** — formulaire durée + note, accessible depuis l'accueil
  et depuis le détail d'un skill.
- **Réglages** — seuil de rappel, notifications natives on/off, lancement
  auto on/off, pages légales (Confidentialité, Conditions, FAQ — statiques,
  in-app).
- **État « introuvable »** — équivalent interne du 404 : écran affiché si un
  skill référencé n'existe plus (deep link cassé), avec retour à l'accueil.

## Gestion des erreurs

- **Perte de connexion pendant une action** (créer un skill, logger une
  entrée) : message d'erreur clair, la saisie reste dans le formulaire (pas de
  perte), retry manuel. Pas de queue offline (cf. hors scope).
- **Auth expirée** : redirection vers l'écran de login, puis retour à l'écran
  visé après reconnexion (pas de perte de contexte de navigation).
- **Erreurs Supabase/RLS inattendues** : loguées en console en dev, message
  générique côté utilisateur — jamais de détail technique brut affiché.

## Tests

- Tests unitaires ciblés sur la logique pure : calcul de streak, calcul
  « jours depuis dernière pratique », filtrage par tag.
- Pas de suite e2e large en v1 (Saint Gym lui-même n'en avait pas en phase
  alpha malgré Playwright configuré). Parcours critique (créer un skill →
  logger une entrée → voir le graphe/cocher un jalon) testé manuellement
  avant chaque release.
- Accessibilité (navigation clavier complète, contraste Emerald Ink /
  Champagne) et perf (bundle Vite, lazy-loading des écrans secondaires)
  vérifiées manuellement.

## Checklist de lancement adaptée (desktop-only, pas de présence web)

| Item d'origine | Traitement |
|---|---|
| Privacy Policy / Terms / FAQ | Pages statiques in-app, dans Réglages |
| CTA clair | « Nouvelle entrée » toujours visible (accueil + détail skill) |
| Custom 404 | Écran « introuvable » interne (pas de vraie 404 HTTP) |
| Alt text | Sur toutes les images/icônes, alt/aria-label pertinent |
| Analytics | Pas de tracking tiers. Si des statistiques sont voulues, ce sont des stats locales à l'utilisateur sur ses propres skills, pas du tracking marketing |
| Meta titles/descriptions | Sans objet (pas de pages web indexables) |
| Social share | Sans objet |
| Favicon | Icône d'app (fenêtre, taskbar, installeur), générée depuis le même mark de logo |
| Canonical URLs | Sans objet |
| Cookie consent | Sans objet (pas de cookies tiers, pas de site web) |
| Mobile version | Hors scope (cf. section Hors scope) |
| Accessibilité | Navigation clavier, contraste, aria-labels |
| Test forms | Validation des formulaires (nouvelle entrée, nouveau skill) testée manuellement |
| Check liens cassés | Pertinent seulement pour les liens externes ajoutés en note par l'utilisateur ; ouverts dans le navigateur système, pas de vérification automatique en v1 |
| Robots.txt / sitemap.xml | Sans objet |
| Optimiser les perfs | Bundle Vite optimisé, SVG natif (pas de lib de graphes), lazy-loading |

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Plateforme | Electron (desktop natif) |
| Présence web | Desktop uniquement, aucune URL publique |
| Stockage | Cloud via Supabase |
| Compte Supabase | Même projet que Saint Gym (compte unifié) |
| Social vs privé | 100% personnel |
| Mécanique de suivi | Journal de pratique + jalons, combinés |
| Organisation des skills | Tags libres |
| Jalons | Échelle générique + jalons personnalisés optionnels |
| Objectif principal | Régularité + archive + progression visuelle, les trois |
| Approche technique | Electron + Vite + React, Supabase direct dans le renderer (pas de Next.js embarqué) |

# Saint Daily

Application de bureau (Windows) pour suivre la pratique de compétences personnelles — un skill à la fois, avec un vrai journal de séances plutôt qu'une case à cocher.

[![release-please](https://github.com/SaintKlinn/saint-daily/actions/workflows/release-please.yml/badge.svg)](https://github.com/SaintKlinn/saint-daily/actions/workflows/release-please.yml)

## Ce que ça fait

- **Compétences & séances** — chaque compétence (niveau auto-déclaré, tags, jalons) accumule un historique de séances pratiquées, avec durée et note.
- **Séries & rappels** — un rappel apparaît quand une compétence n'a pas été pratiquée depuis un certain nombre de jours (réglable dans les paramètres).
- **Minuteur Pomodoro** — cycles travail/pause rattachés à une compétence, avec une petite fenêtre flottante façon « dynamic island » qui reste au premier plan quand la fenêtre principale est réduite.
- **Tray & démarrage auto** — reste en fond de tâche dans la barre système, option de lancement automatique avec Windows.
- **Mise à jour automatique** — vérifie et télécharge les nouvelles versions en silence ; un bandeau discret apparaît une fois la mise à jour prête, jamais de redémarrage forcé.

## Stack

Electron + [electron-vite](https://electron-vite.org/) · React 19 + TypeScript · Tailwind CSS · React Router (`HashRouter`) · [Supabase](https://supabase.com/) (auth + Postgres) · Vitest

## Démarrer en local

Prérequis : Node 20+, un projet Supabase (la table `profile` est partagée avec l'écosystème Saint — un seul compte pour toutes les apps).

1. `npm install`
2. Copier `.env.local.example` en `.env.local` et renseigner `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
3. Appliquer les migrations SQL de `supabase/migrations/` sur le projet
4. `npm run icons` (génère les icônes app/installeur depuis `resources/` — gitignorées, pas committées)
5. `npm run dev`

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'app en développement (electron-vite) |
| `npm test` | Suite de tests (Vitest) |
| `npm run typecheck` | Vérification TypeScript (process main + renderer) |
| `npm run icons` | Régénère les icônes app et l'artwork de l'installeur |
| `npm run dist:win` | Build l'installeur Windows en local, sans publier |

## Releases

Les versions sont automatisées : un commit `fix:`/`feat:` poussé sur `master` fait apparaître une Release PR (changelog généré depuis les commits via [release-please](https://github.com/googleapis/release-please)) ; la fusionner crée le tag et la GitHub Release, ce qui déclenche un build Windows qui attache le `.exe` à la release. Historique complet dans [CHANGELOG.md](CHANGELOG.md).

Convention de commit, à partir de la mise en place de ce pipeline : `type: sujet` — `feat:`, `fix:`, `perf:`, `refactor:`, `chore:`, `docs:`, `ci:`, `build:`. Détail de l'architecture du pipeline dans [docs/superpowers/specs/2026-09-02-release-pipeline-design.md](docs/superpowers/specs/2026-09-02-release-pipeline-design.md).

## Projet personnel

Saint Daily est un outil à usage personnel — pas de garantie de support, Windows uniquement pour l'instant.

# Saint Daily — pipeline de release (GitHub + changelog + auto-update)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-02

## Contexte

Saint Daily n'a aujourd'hui aucun dépôt distant (`git remote` vide), aucune CI,
et le packaging Windows local (`npm run dist:win`) est bloqué par une
limitation de privilège symlink NSIS sur cette machine — seul le build
electron-vite (app non empaquetée) fonctionne en local, jamais le vrai
`.exe`.

Ce document couvre la mise en place d'un vrai pipeline de release : un
dépôt GitHub privé, un `.exe` publié automatiquement à chaque version, un
changelog lisible à chaque release, et une mise à jour automatique de
l'app installée — le tout déclenché par les commits normaux plutôt que par
une étape manuelle de packaging.

## Hors scope

- **Signature de code** — le `.exe` n'est pas signé (pas de certificat
  éditeur). Windows SmartScreen affichera "éditeur inconnu" à
  l'installation ("plus d'infos" → "exécuter quand même"). Accepté pour un
  usage personnel ; à reconsidérer si l'app est un jour distribuée plus
  largement.
- **Réécriture de l'historique de commits existant** — les commits déjà
  faits ne sont pas rétro-étiquetés avec la convention Conventional
  Commits. La toute première release de ce pipeline est cadrée comme un
  point de départ ("v1.0.0 — état actuel de l'app"), pas comme une
  reconstruction rétroactive de l'historique.
- **macOS / Linux** — comme le reste de l'app, seul le build Windows est
  concerné.
- **Rollback / canal beta** — une seule ligne de releases (`master` →
  release stable). Pas de pre-release/beta channel en v1 de ce pipeline.

## Architecture

```
commit "feat: ..." / "fix: ..." poussé sur master
        │
        ▼
GitHub Actions : job release-please
        │  (maintient/actualise une "Release PR" qui accumule
        │   le changelog au fil des commits structurés)
        ▼
   Release PR mergée (par l'utilisateur, ou par Claude sur demande)
        │
        ▼
release-please crée le tag + la GitHub Release (notes de version incluses)
        │
        ▼
GitHub Actions : job build-and-publish (déclenché par release_created)
        │  runner windows-latest, npm run dist:win
        │  (résout aussi le blocage NSIS local — les runners GitHub
        │   n'ont pas cette restriction de symlink)
        ▼
   .exe attaché à la GitHub Release existante
        │
        ▼
electron-updater (dans l'app installée) détecte la nouvelle release,
télécharge en silence, prévient l'utilisateur, installe sur confirmation
```

Deux workflows séparés, pas un seul monolithique : `release-please` gère
version + changelog + tag/release ; le job de build ne se déclenche que
lorsque `release-please` signale qu'une release vient d'être créée
(`release_created: true` en sortie du premier job). Ça sépare "décider
qu'on publie" (la Release PR, un vrai geste humain) de "construire
l'artefact" (mécanique, automatique une fois la décision prise).

## Dépôt GitHub

- Nouveau dépôt **public**, créé sous le compte GitHub de l'utilisateur,
  nom `saint-daily` (cohérent avec `package.json`). Décision révisée en
  cours d'implémentation : un dépôt privé empêcherait `electron-updater`
  de vérifier les mises à jour pour quiconque installe le `.exe` sans un
  token GitHub personnel configuré sur sa machine — incompatible avec
  l'objectif de partager le `.exe` avec d'autres personnes. Le code
  source n'expose aucun secret (`.env.local` est gitignore, les
  identifiants dev sont lus à l'exécution, jamais commités).
- Push de l'historique local existant tel quel (aucun commit modifié).
- `GITHUB_TOKEN` fourni automatiquement par Actions suffit pour tout le
  pipeline — pas de token personnel à gérer, ni pour la CI ni pour
  l'auto-update en runtime (un dépôt public ne nécessite aucune
  authentification pour lire ses releases). Le workflow déclare
  `permissions: contents: write` (pour que le job de build publie
  l'asset sur la release) **et** `pull-requests: write` (pour que
  `release-please` puisse créer/mettre à jour la Release PR elle-même).

## Convention de commit

À partir de la mise en place de ce pipeline, tout nouveau commit sur ce
dépôt suit le format **Conventional Commits** (`type: sujet`, en anglais
pour le type/mot-clé, sujet en français comme le reste des messages de
commit du projet) :

| Type | Effet sur la version | Visible dans le changelog |
|---|---|---|
| `feat:` | mineure (1.x.0) | "Nouveautés" |
| `fix:` | patch (1.0.x) | "Corrections" |
| `perf:`, `refactor:`, `chore:`, `docs:`, `ci:`, `build:` | aucun bump de version (release-please ne bump que sur `feat`/`fix`/breaking change) | "Performance" / "Améliorations internes" / "Divers" selon le type |

Pas de notion de "breaking change" pertinente ici (pas d'API publique) —
la version majeure ne bouge pas automatiquement ; un bump majeur, si
jamais souhaité, se fait par override manuel au moment de merger la
Release PR.

**Configuration release-please** (`release-please-config.json`) : le
`changelog-sections` par défaut de l'outil n'affiche que `feat`/`fix` —
explicitement étendu pour inclure `perf`/`refactor`/`chore` avec des
titres de section en français, pour que "que ce soit bug fix ou pas" (la
demande initiale) soit effectivement reflété dans les notes de version,
pas seulement les fonctionnalités et corrections.

## Amorçage de version

`package.json` passe de `0.1.0` à `1.0.0` comme point de départ explicite
de ce pipeline (pas un bump normal déclenché par un commit `feat:`/`fix:`
— une décision manuelle, une fois, documentée dans le premier commit qui
met en place ce pipeline). `release-please` part de cette version pour
tous ses calculs suivants.

## Build & publication du `.exe`

- `electron-builder.yml` gagne une section `publish` :
  ```yaml
  publish:
    provider: github
    owner: <compte GitHub de l'utilisateur>
    repo: saint-daily
  ```
- Le job GitHub Actions correspondant tourne sur `windows-latest`, installe
  les dépendances (`npm ci`), lance `npm run dist:win` avec
  `electron-builder`'s `--publish always` (ou un upload explicite de
  l'asset généré vers la release déjà créée par `release-please` — choix
  d'implémentation, les deux atteignent le même résultat).
- Cette même config `publish` est ce qui permet à `electron-updater`, côté
  app installée, de savoir où chercher les nouvelles versions
  (electron-builder génère automatiquement `app-update.yml` à partir de
  cette section, embarqué dans le build).

## Mise à jour automatique (electron-updater)

Nouveau module main-process (même famille que `devLogin.ts`/`tray.ts`/
`autoLaunch.ts` déjà existants) :

- **Déclenchement** : une vérification au démarrage de l'app (`app.whenReady()`,
  après un court délai pour ne pas concurrencer le boot), puis une
  vérification périodique toutes les **4h** tant que l'app tourne
  (cohérent avec le fait que l'app reste souvent ouverte en tray/
  auto-launch).
- **Inerte hors app packagée** : comme `devLogin.ts`, ce module ne fait
  rien si `!app.isPackaged` (`electron-updater` n'a de sens que sur un
  vrai build installé, pas en `npm run dev`).
- **Téléchargement silencieux** : `autoUpdater.checkForUpdates()` (pas
  `checkForUpdatesAndNotify()`, qui affiche une notification OS générique
  — ici on veut un bandeau in-app cohérent avec l'identité visuelle,
  pas une notification système par défaut). Si une mise à jour est
  trouvée, elle se télécharge en arrière-plan sans interrompre
  l'utilisateur.
- **Notification à l'utilisateur** : une fois le téléchargement terminé
  (`update-downloaded`), l'état est poussé au renderer via IPC (même
  pont `window.api` déjà en place, étendu avec un espace de noms
  `autoUpdate`). Un bandeau discret apparaît dans l'app ("Mise à jour
  disponible — redémarrer pour l'appliquer") avec un bouton explicite.
  **Jamais de redémarrage forcé sans action de l'utilisateur.**
- **Installation** : le bouton du bandeau appelle
  `autoUpdater.quitAndInstall()` via IPC.

## Gestion des erreurs

- Un échec de vérification/téléchargement (pas de connexion, etc.) reste
  silencieux pour l'utilisateur — pas de bandeau d'erreur intrusif pour
  quelque chose qui se corrigera de lui-même à la prochaine vérification
  périodique. Loggé côté main process pour du débogage éventuel.
- Un échec du job de build GitHub Actions (ex. erreur de compilation)
  n'affecte jamais l'app déjà installée chez l'utilisateur — la release
  GitHub existe mais reste sans `.exe` attaché tant que le job n'a pas
  réussi ; `electron-updater` ne verra une "vraie" nouvelle version que
  lorsque l'asset est effectivement présent.

## Tests

- Pas de test automatisé pour la CI elle-même (fichiers de workflow YAML)
  — vérifiée manuellement en poussant un premier commit `feat:`/`fix:` et
  en observant la Release PR se créer, puis en la mergeant et en
  confirmant que la release + le `.exe` apparaissent.
- Le module `autoUpdate.ts` n'a pas de logique pure substantielle à tester
  unitairement (c'est essentiellement du câblage `electron-updater` +
  IPC) — vérifié manuellement en installant une version, publiant une
  version suivante, et confirmant le bandeau + l'installation.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Où le `.exe` est-il disponible | GitHub Releases |
| Dépôt | Nouveau dépôt GitHub public, à créer (révisé depuis privé — voir "Dépôt GitHub" : incompatible avec le partage du `.exe`) |
| Déclenchement du build | Automatique via GitHub Actions (résout aussi le blocage NSIS local) |
| Rédaction du changelog | Automatisée depuis des commits structurés (Conventional Commits) |
| Déclenchement de la release | Confirmation via une Release PR (release-please), jamais publié sans ce geste |
| Auto-update | Inclus dans ce périmètre (electron-updater) |
| Signature de code | Hors scope, accepté (SmartScreen "éditeur inconnu") |
| Contenu du changelog | Étendu au-delà de feat/fix par défaut (perf/refactor/chore inclus) pour refléter "bug fix ou pas" |
| Version de départ | 1.0.0, amorçage manuel unique — pas de rétro-étiquetage de l'historique existant |

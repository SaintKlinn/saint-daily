# Saint Daily — minuteur Pomodoro

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-02

## Contexte

Saint Daily existe pour faciliter la régularité de pratique. Le pomodoro y
trouve naturellement sa place : une technique de concentration par cycles,
directement rattachée au journal de pratique déjà existant plutôt qu'un outil
à part.

Deux caractéristiques distinguent ce pomodoro d'un minuteur générique :

- **Rattaché à un skill** — chaque pomodoro se pratique sur un skill précis.
  À la fin, il nourrit directement les séries et statistiques déjà en place
  (`practice_entry`), sans étape de saisie manuelle supplémentaire.
- **Widget flottant façon Dynamic Island** — quand l'utilisateur épingle le
  minuteur, une petite fenêtre toujours au premier plan reste visible
  par-dessus les autres applications, pour suivre le décompte sans revenir à
  Saint Daily.

## Hors scope (v1)

- **Position de l'overlay persistée** — la fenêtre flottante réapparaît à une
  position par défaut à chaque lancement de l'app ; elle ne mémorise pas où
  l'utilisateur l'a déplacée d'une session à l'autre.
- **Reprise après crash** — si l'app est tuée en plein pomodoro, les cycles
  déjà complétés restent comme entrées individuelles dans le journal (le
  filet de sécurité), mais la session elle-même n'est pas reconstruite au
  redémarrage. Relancer un nouveau pomodoro repart de zéro.
- **Historique dédié des sessions pomodoro** — pas de vue "liste de mes
  pomodoros passés" séparée du journal de pratique standard. Une session
  terminée est une `practice_entry` comme une autre.
- **Plusieurs pomodoros simultanés** — un seul pomodoro actif à la fois, tous
  skills confondus.
- **macOS / Linux** — `alwaysOnTop`/`skipTaskbar` sont testés uniquement sur
  Windows, comme le reste de l'app (v1 Windows-only, cf. spec principale).

## Architecture

### Machine à états (renderer, fenêtre principale)

Le minuteur vit dans un hook React (`usePomodoro`) de la fenêtre principale —
même logique que `useSkills`/`usePracticeEntries` aujourd'hui, pas de nouvelle
logique métier côté process main. La fenêtre principale continue de tourner
en arrière-plan quand elle est masquée (pattern déjà en place, `win.hide()`
plutôt que fermeture), donc le minuteur ne s'interrompt pas quand on réduit
l'app.

```ts
type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
type PomodoroStatus = 'idle' | 'running' | 'paused' | 'awaitingAdvance';

interface PomodoroSession {
  skillId: string;
  skillName: string;        // dénormalisé, pour l'affichage overlay sans jointure
  phase: PomodoroPhase;
  status: PomodoroStatus;
  cycleIndex: number;       // 0-based, remis à 0 après chaque pause longue
  phaseEndsAt: number;      // epoch ms, recalculé à chaque (re)départ de phase
  remainingMsAtPause: number | null;
  loggedEntryIds: string[]; // practice_entry créées cette session, pour la consolidation finale
}
```

Le temps restant est **toujours dérivé de `phaseEndsAt` (`Date.now()` diff)**,
jamais d'un compteur de ticks accumulés — un `setInterval` peut être throttled
par Chromium quand la fenêtre est masquée/occluded ; recalculer depuis un
timestamp absolu garantit un affichage exact dès que le tick suivant arrive,
même retardé.

**Transitions :**

- `idle → work` : l'utilisateur choisit un skill et démarre. `phaseEndsAt = now + pomodoro_work_minutes * 60000`.
- Un minuteur en cours arrive à 0 →
  - si `phase === 'work'` : crée une `practice_entry` de checkpoint (durée =
    `pomodoro_work_minutes`, note auto "Pomodoro — cycle {cycleIndex + 1}/
    {pomodoro_cycles_before_long_break}"), l'ajoute à `loggedEntryIds`.
  - détermine la phase suivante (pause courte, ou pause longue si
    `cycleIndex + 1 === pomodoro_cycles_before_long_break`, puis
    `cycleIndex` repart à 0 après une pause longue).
  - notification OS (même mécanisme que les rappels existants).
  - si `pomodoro_auto_advance` est actif : démarre la phase suivante
    immédiatement (`status` reste `running`, nouveau `phaseEndsAt`).
  - sinon : `status = 'awaitingAdvance'`, attend un clic (bouton "Commencer
    la pause" / "Reprendre le travail") avant de recalculer `phaseEndsAt`.
- Après une pause longue, ça repart automatiquement sur un nouveau cycle de
  travail (ou attend l'action utilisateur si l'auto-enchaînement est
  désactivé) — **le pomodoro boucle indéfiniment jusqu'à un Stop explicite**,
  pas de fin automatique après N cycles.
- `Pause`/`Resume` (manuel, à tout moment en `running`) : fige le temps
  restant dans `remainingMsAtPause`, puis le ressort au `Resume` pour
  recalculer un nouveau `phaseEndsAt`.
- `Stop` (manuel, à tout moment) :
  - si en plein cycle de travail non terminé et que le temps écoulé, arrondi
    à la minute la plus proche, est `> 0` : crée une dernière
    `practice_entry` de checkpoint pour ce temps partiel (pas d'entrée si
    l'arrondi tombe à 0 — la contrainte `duration_minutes > 0` l'interdirait
    de toute façon).
  - **consolidation** : somme les durées de toutes les entrées de
    `loggedEntryIds` (+ l'éventuelle entrée partielle), les supprime, insère
    une entrée unique avec la durée totale et la note du champ optionnel de
    l'écran `/pomodoro` (voir Écrans — pas de prompt bloquant au Stop).
    `practiced_at` reste la valeur par défaut (`now()`), comme toute entrée
    créée via Nouvelle entrée aujourd'hui — pas de rétro-datation à l'heure de
    début de session.
  - `status = 'idle'`.

**Limite connue, assumée pour la v1** : la consolidation (suppression des
entrées de checkpoint + insertion de l'entrée finale) est deux appels
Supabase séquentiels, pas une transaction atomique. Un crash exactement entre
les deux laisserait les checkpoints intacts sans l'entrée finale — dégradation
sans perte de données (les checkpoints existent toujours), juste une
consolidation à refaire manuellement dans de rares cas. Pas de fonction RPC
dédiée pour ce risque résiduel en v1.

### Fenêtres & IPC (process main)

Nouvelle fenêtre overlay (`src/main/pomodoroOverlay.ts`), créée au démarrage
mais cachée par défaut :

- `frame: false`, `transparent: true`, `resizable: false`, `skipTaskbar: true`
- `alwaysOnTop: true` (niveau `'screen-saver'` pour rester au-dessus des
  fenêtres d'autres apps, y compris plein écran)
- Taille fixe compacte (façon pilule), position par défaut : coin
  supérieur-droit de l'écran principal.
- Charge le même bundle renderer que la fenêtre principale, sur la route
  `#/pomodoro-overlay` (pas de nouveau point d'entrée Vite — un seul pipeline
  de build, réutilisation directe de `ProgressRing`/`LogoMark`/`colors`).
- Le `preload` existant (`src/preload/index.ts`) est étendu avec les méthodes
  pomodoro plutôt que d'introduire un second fichier de preload.

**Flux d'état** : le renderer de la fenêtre principale est la seule source de
vérité. Il pousse chaque changement d'état à `main` via IPC
(`pomodoro:state-changed`), qui le relaie tel quel à la fenêtre overlay
(`overlayWindow.webContents.send('pomodoro:state', state)`). Les actions
déclenchées depuis l'overlay (pause/resume/stop/avancer) remontent par le même
chemin inverse : overlay → main (`pomodoro:control`) → fenêtre principale, qui
applique le changement dans son état local — un seul point de mutation, quelle
que soit la fenêtre d'où part le clic.

`main` gère aussi la visibilité de l'overlay (`show()`/`hide()`), déclenchée
par le bouton "épingler" de la fenêtre principale — indépendant de l'état
réduit/visible de la fenêtre principale elle-même.

## Modèle de données

Aucune nouvelle table. Les checkpoints et l'entrée consolidée sont des
`practice_entry` ordinaires ; le regroupement "quelles entrées appartiennent à
la session en cours" est tenu en mémoire côté renderer (`loggedEntryIds`), pas
en base — si l'app est tuée avant consolidation, les checkpoints restent
simplement comme des entrées séparées, sans tag ni table de liaison à
nettoyer.

`skill_app_settings` gagne 5 colonnes (migration, valeurs par défaut
= technique Pomodoro classique) :

```sql
alter table skill_app_settings
  add column pomodoro_work_minutes int not null default 25 check (pomodoro_work_minutes > 0),
  add column pomodoro_short_break_minutes int not null default 5 check (pomodoro_short_break_minutes > 0),
  add column pomodoro_long_break_minutes int not null default 15 check (pomodoro_long_break_minutes > 0),
  add column pomodoro_cycles_before_long_break int not null default 4 check (pomodoro_cycles_before_long_break > 0),
  add column pomodoro_auto_advance boolean not null default true;
```

Pas de changement RLS — la policy existante sur `skill_app_settings`
(`auth.uid() = user_id`) couvre déjà ces nouvelles colonnes.

## Écrans

Même direction artistique que le reste de l'app (Emerald Ink / Champagne,
IBM Plex, mark en rayons, cartes en dégradé + RayCorner, entrées animées via
Motion) — pas de nouveau langage visuel.

- **`/pomodoro`** — double rôle selon l'état : sélecteur de skill + bouton
  "Démarrer" quand `status === 'idle'` ; vue plein écran du minuteur en cours
  sinon (grand `ProgressRing`, phase actuelle, compteur de cycle, contrôles
  pause/reprendre/stop, bouton "épingler"). Un champ note optionnel reste
  visible et modifiable pendant toute la session (running/paused/
  awaitingAdvance) — pas un prompt qui bloque au Stop ; son contenu au moment
  du Stop devient la note de l'entrée consolidée.
- **Accueil** — bouton secondaire "Démarrer un pomodoro" à côté de
  "+ Nouvelle entrée", ouvre `/pomodoro` sans skill présélectionné.
- **Détail d'un skill** — bouton "Démarrer un pomodoro" dans la rangée
  d'actions du haut, ouvre `/pomodoro` avec ce skill présélectionné.
- **`/pomodoro-overlay`** — pas d'`AppShell` (pas de rail de nav). Widget
  compact : nom du skill, temps restant, anneau de progression, compteur de
  cycle, contrôles pause/stop. Fond avec `-webkit-app-region: drag` pour
  repositionner la fenêtre par glisser-déposer, boutons en
  `-webkit-app-region: no-drag` pour rester cliquables.
- **Réglages** — nouveau bloc "Pomodoro" : les 4 durées (minutes), le nombre
  de cycles avant pause longue, le toggle d'auto-enchaînement (réutilise le
  composant `Toggle` existant).

## Gestion des erreurs

- Échec réseau à la création d'un checkpoint ou à la consolidation finale :
  message d'erreur affiché (`role="alert"`, même pattern que le reste de
  l'app), le minuteur continue de tourner localement — on ne bloque jamais le
  décompte pour une erreur d'écriture, on la signale.
- Fermeture de l'app (quitter depuis le tray) pendant un pomodoro actif :
  aucune confirmation bloquante en v1 — cohérent avec le hors-scope "reprise
  après crash", le filet de sécurité des checkpoints couvre déjà ce cas.

## Tests

- Tests unitaires purs (Vitest, même pattern que `streaks.test.ts`) sur le
  réducteur de la machine à états : transitions de phase, calcul du cycle
  suivant (courte vs longue pause), calcul de consolidation (somme des
  durées), arrondi et exclusion du temps partiel à 0 minute.
- Pas de test automatisé sur la fenêtre overlay elle-même (comportement
  Electron natif, hors de portée de Vitest) — vérification manuelle avant
  chaque release, comme le reste des parcours critiques de l'app.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Rattachement | Toujours à un skill (jamais de pomodoro "libre") |
| Structure | Cycles complets (travail / pause courte / pause longue) |
| Déclenchement de l'overlay | Bouton "épingler", indépendant de l'état de la fenêtre principale |
| Contenu de l'overlay | Skill, temps restant, anneau, contrôles pause/stop, compteur de cycle |
| Cycle → entrée | Checkpoint par cycle, consolidés en une entrée à la fin |
| Transitions de phase | Réglable (auto-enchaîné ou manuel), via un nouveau paramètre |
| Durées | Réglables dans Réglages (défauts 25/5/15, 4 cycles) |
| Fin de session | Boucle indéfiniment jusqu'à Stop explicite |
| Cycle interrompu | Le temps partiel est loggé aussi |
| Points d'entrée | Accueil (bouton secondaire) + Détail skill (skill présélectionné) |
| Architecture état | Renderer de la fenêtre principale = source de vérité, relayé via main vers l'overlay |
| Fenêtre overlay | Même bundle, route dédiée `#/pomodoro-overlay`, pas de second build Vite |

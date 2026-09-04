# Saint Daily — Pomodoro, écran de départ (Phase A : sélection du skill et de la durée)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-05

## Contexte

L'écran Pomodoro (`src/renderer/src/screens/Pomodoro.tsx`) a un écran de
départ minimal : un `<select>` brut listant tous les skills (y compris
archivés) sans recherche ni tri, et une durée de travail toujours celle
réglée globalement dans Réglages, invisible et non modifiable depuis cet
écran. Ce chantier améliore cet écran de départ ; l'écran du minuteur en
cours (progression du cycle, ajustement en cours de route, historique de
séance) est un chantier séparé et futur — voir "Hors scope" plus bas.

## Décision de phasage

Découpé en deux, par risque :

- **Phase A (ce document)** : écran de départ uniquement — sélecteur de
  skill enrichi et durée de travail ajustable au lancement. Purement
  additif ; aucune session en cours n'est jamais affectée par ce
  chantier.
- **Phase B (future, hors scope ici)** : écran du minuteur en cours —
  touche la machine à états (`pomodoroLogic.ts`) et le provider
  (`pomodoro.tsx`) pendant qu'une session tourne réellement ; mérite sa
  propre conception.

## Sélecteur de skill enrichi

Nouveau composant `src/renderer/src/components/SkillPicker.tsx`, branché
uniquement sur l'écran Pomodoro (le sélecteur de "Nouvelle entrée" n'est
pas touché — pas demandé, hors scope).

**Props** : `skills: Skill[]`, `entriesBySkill: Record<string,
PracticeEntry[]>`, `value: string`, `onChange: (skillId: string) => void`.

**Comportement** :
- Un champ de recherche filtre par nom, insensible à la casse (même
  logique que `filterByTag`/la recherche de `ListeSkills.tsx`, appliquée
  ici au nom plutôt qu'au tag).
- Sans recherche active, tri par dernière pratique la plus récente
  d'abord (`daysSinceLastPractice` croissant ; les skills jamais
  pratiqués — `daysSinceLastPractice` retourne `null` — passent en
  dernier). À égalité (même `daysSinceLastPractice`, y compris deux
  skills jamais pratiqués), tri secondaire alphabétique sur le nom, pour
  un ordre déterministe et testable.
- Les skills archivés sont exclus de la liste — un pomodoro se lance sur
  un skill actif ; le `<select>` actuel ne filtrait pas les archivés,
  c'est une correction incluse au passage puisqu'on reconstruit ce
  composant de toute façon.
- Chaque ligne reprend le visuel déjà utilisé dans `ListeSkills.tsx` :
  nom, badge de streak ("série de N j"), dernière pratique
  ("dernière · il y a N j" / "aujourd'hui" / "jamais") — même fonctions
  `calculateStreak`/`daysSinceLastPractice` de `lib/streaks.ts`.
- Liste toujours visible (pas de popover/dropdown superposé — l'app
  n'utilise ce pattern nulle part ailleurs), scrollable si elle dépasse
  une hauteur maximale.

**Donnée nouvelle nécessaire sur l'écran Pomodoro** : le picker a besoin
des entrées de pratique de TOUS les skills pour calculer streak/dernière
pratique par ligne — `Pomodoro.tsx` doit donc appeler
`useAllPracticeEntries(skills.map(s => s.id))` (déjà utilisé par
`Accueil.tsx` pour exactement ce calcul), ce qu'il ne fait pas
aujourd'hui (il n'utilise que `useSkills()`).

## Durée de travail ajustable au lancement

Une fois un skill choisi, une ligne de presets apparaît sous le
sélecteur : **15 / 25 / 50 min**, plus une option "Personnalisé" avec un
champ numérique pour un réglage fin. Présélection par défaut : le preset
qui correspond à `settings.pomodoroWorkMinutes` (les Réglages actuels),
ou "Personnalisé" pré-rempli avec cette valeur si elle ne correspond à
aucun preset — donc rien ne change par défaut tant que l'utilisateur ne
touche pas explicitement à ce contrôle.

**Portée du réglage** : uniquement la durée de la phase de **travail**,
pour **cette session précise**. Les durées de pause (courte/longue) et le
nombre de cycles avant pause longue restent ceux des Réglages, non
modifiables depuis cet écran — décision prise pendant le brainstorm pour
ne pas surcharger l'écran de départ. Ce réglage n'est **jamais persisté**
nulle part (ni en base, ni par skill) — un choix pour cette session
uniquement, comme décidé pendant le brainstorm (l'option "mémorisé par
skill" a été explicitement écartée).

## Architecture : durée figée à la session (changement dans `pomodoro.tsx`)

Aujourd'hui, `PomodoroProvider` dérive `durations` directement de
`settings` à chaque rendu :

```ts
const durations: PomodoroDurations | null = settings
  ? { workMinutes: settings.pomodoroWorkMinutes, ... }
  : null;
```

Si on se contentait de passer une durée de travail différente au seul
appel `startSession(...)` initial, un changement des Réglages pendant
qu'une session tourne changerait la durée des phases de travail
**suivantes** en plein milieu de la session — un effet de bord confus,
indépendant de ce chantier mais qui deviendrait visible dès qu'on
introduit une durée par session.

Décision : `PomodoroProvider` gagne un état `sessionDurations:
PomodoroDurations | null`, figé une seule fois à l'appel de `start(...)`
(fusion de la durée de travail choisie avec les pauses/cycles actuels des
Réglages), et remis à `null` dans `stopInternal()` aux côtés du
`setSession(null)`/`setNote('')`/`setPinned(false)` déjà présents.
Partout où le provider utilise aujourd'hui `durations`/`durationsRef`
pour la logique d'une session **en cours** (le tick, `pause`/`resume`/
`advance`, `logCheckpoint`, `stopInternal`), il doit lire l'expression
`sessionDurations ?? durations` à la place — en pratique, une fois une
session démarrée, `sessionDurations` est toujours non nul jusqu'à l'arrêt,
donc c'est bien la valeur figée qui est utilisée pendant toute la
session. `durationsRef.current` (lu depuis la fermeture du
`setInterval` du tick) doit suivre cette même expression, pas
`durations` seul.

`start()` change de signature : `start(skillId: string, skillName:
string, workMinutes: number)` — le 3e paramètre devient obligatoire (pas
optionnel : `Pomodoro.tsx` calcule toujours une valeur concrète, par
défaut celle des Réglages, jamais `undefined`).

**Ce qui ne change pas** : `pomodoroLogic.ts` (les fonctions pures
prennent déjà `durations` en paramètre générique, sans supposer qu'il
vient des Réglages — zéro changement nécessaire dans ce fichier) et
`PomodoroOverlay.tsx`/`pomodoroOverlay.ts` (l'overlay reçoit `durations`
via l'instantané relayé, qui utilise déjà `durationsRef.current` —
puisque cette référence suit maintenant `sessionDurations`, l'overlay
affiche automatiquement la bonne durée sans aucun changement de son
côté).

## Hors scope (rappel)

- L'écran du minuteur en cours : progression visuelle du cycle,
  ajustement de durée en cours de route, historique de la séance —
  Phase B, chantier séparé et futur.
- Rendre les pauses ou le nombre de cycles ajustables au lancement —
  décision explicite pendant le brainstorm, reste dans Réglages.
- Mémoriser une durée préférée par skill — option écartée pendant le
  brainstorm au profit d'un réglage par lancement.
- Enrichir le sélecteur de skill de `NouvelleEntree.tsx` — non demandé,
  reste un `<select>` simple.
- Toute correction liée aux erreurs Supabase/horloge système (sujet
  traité séparément dans cette même conversation).

## Tests / vérification

- **Logique pure** : aucune fonction de `pomodoroLogic.ts` ne change —
  la suite existante (`pomodoroLogic.test.ts`) reste la spécification de
  référence, sans ajout nécessaire pour ce chantier.
- **`SkillPicker`** : le tri (récent d'abord, jamais-pratiqué en
  dernier) et le filtre (recherche insensible à la casse, exclusion des
  archivés) sont des calculs purs dérivables de `skills`/
  `entriesBySkill` — extraits en fonction(s) testable(s) en Vitest plutôt
  que recalculés inline dans le composant, pour rester dans la
  convention déjà établie (`streaks.ts`/`filterByTag`).
- **Durée figée à la session** : vérification manuelle (démarrer un
  pomodoro avec une durée personnalisée, aller changer les Réglages
  pendant que la session tourne, confirmer que la phase de travail en
  cours ET les suivantes gardent la durée choisie au lancement, pas la
  nouvelle valeur des Réglages) — comportement de composant React vivant
  dans le temps, pas une fonction pure isolable.
- **Rendu visuel** : vérification manuelle (`npm run typecheck`, `npm
  test`, lancement `npm run dev`) — l'app Electron n'est pas
  prévisualisable dans le navigateur intégré à cette session.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Périmètre | Écran de départ uniquement (Phase A) ; écran en cours reporté (Phase B) |
| Sélecteur de skill | Recherche + tri par récence + streak/dernière pratique visibles ; archivés exclus |
| Durée ajustable | Presets (15/25/50) + personnalisé, travail uniquement, par lancement, jamais persistée |
| Pauses/cycles | Restent dans Réglages, non ajustables depuis cet écran |

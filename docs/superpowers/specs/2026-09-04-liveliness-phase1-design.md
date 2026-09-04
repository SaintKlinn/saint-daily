# Saint Daily — rendre l'app plus vivante (Phase 1 : socle, micro-interactions, récompenses)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-04

## Contexte

L'app fonctionne mais se ressent comme statique en dehors de quelques
animations d'entrée (`motion.div` fade-up sur les en-têtes d'écran,
révélation du `LogoMark` au login). Quatre pistes ont été retenues pour
la rendre plus vivante : micro-interactions, transitions entre écrans,
moments de récompense, animations d'ambiance.

Le ton retenu est **raffiné et discret**, dans la continuité directe de
la charte émeraude/champagne existante — pas d'expressivité ludique
(rebonds, confettis, pop marqués). Le mouvement doit rester un signal de
qualité, jamais une distraction.

## Décision de phasage

Chantier trop large pour un seul plan (~8 écrans + routing + nouvelle
logique). Découpé en 3 :

- **Phase 1 (ce document)** : socle de mouvement partagé + micro-
  interactions + moments de récompense. Surtout des ajouts localisés,
  peu de restructuration — le lot le plus sûr et le plus immédiatement
  senti au quotidien.
- **Phase 2 (future, hors scope ici)** : transitions entre écrans.
  Touche `App.tsx`/le routing (`AuthGate` imbriqué, `HashRouter`) —
  suffisamment délicat techniquement pour mériter son propre design.
- **Phase 3 (future, hors scope ici)** : animations d'ambiance
  (mouvement de fond au repos). La plus petite, la plus indépendante —
  pourra être glissée dans n'importe quel créneau ultérieur.

## Socle de mouvement

Rien de nouveau à inventer pour les entrées : la courbe
`cubic-bezier(0.16, 1, 0.3, 1)` est déjà la signature "entrée" de l'app
(utilisée dans `EmptyState.tsx`, `index.css` pour `.logo-ray-reveal`, et
systématiquement en tête de chaque écran via `motion.div
initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}`). Elle reste la
seule courbe d'entrée — aucune nouvelle courbe d'entrée introduite.

Nouveau : une transition **courte** pour le feedback immédiat
(survol/clic), quasi absente aujourd'hui — `Button.tsx`'s `BASE` change
instantanément de couleur au survol, sans aucune propriété `transition`.
Standard retenu : `transition-colors duration-150 ease-out` pour les
changements de couleur, `duration-150` également pour tout `transform`
de pression. Cette durée courte (150ms) contraste délibérément avec les
500ms des animations d'entrée : le feedback doit être instantané à
l'œil, l'entrée peut prendre son temps.

`MotionConfig reducedMotion="user"` (déjà en place dans `App.tsx`) et les
blocs `@media (prefers-reduced-motion: reduce)` (déjà en place dans
`index.css`) couvrent automatiquement tout nouveau `motion.*` et toute
nouvelle animation CSS ajoutés par ce plan — aucune garde
`prefers-reduced-motion` supplémentaire à écrire à la main.

## Micro-interactions

Concentrées sur les primitives déjà partagées, pour qu'un seul
changement profite à tout l'app (principe DRY déjà en place depuis
l'audit ui-ux-pro-max) :

- **`Button.tsx` / `buttonClassName`** : ajout de
  `transition-colors duration-150 ease-out` au `BASE`, et
  `active:scale-[0.97] transition-transform duration-150` pour un léger
  retrait au clic. S'applique à tous les boutons de l'app sans toucher
  aux écrans un par un.
- **Lignes de liste** (`ListeSkills.tsx` — lignes de skill ; `Accueil.tsx`
  — lignes "Rappels dus") : leurs classes `hover:bg-ink-700` existantes
  gagnent `transition-colors duration-200` (changement de fond un peu
  plus lent que les boutons, cohérent avec leur taille).
- **Chips de tags** (`ListeSkills.tsx`, les boutons `#tag`) : même
  traitement, `transition-colors duration-150`.
- **Rail de navigation** (`AppShell.tsx`) : **inchangé** — la pastille
  active via `layoutId`/spring est déjà au niveau attendu (constat de
  l'audit ui-ux-pro-max précédent), ce plan n'y touche pas.

## Moments de récompense

Trois déclencheurs retenus (sur les quatre proposés — une nouvelle
entrée de pratique elle-même n'en est délibérément pas un, trop
fréquente pour rester un vrai moment). Chacun reste **localisé** (pas de
plein écran, pas de blocage de l'interaction) et réutilise le vocabulaire
visuel existant (glow/pulse en accent doré `#E7B94E`), jamais le tracé du
`LogoMark` — réservé aux moments "app entière" (login, mise à jour).

### Jalon atteint

Déclencheur exact : `DetailSkill.tsx`, dans `handleToggleMilestone`,
uniquement quand `completed === true` (cocher, pas décocher). Au clic sur
la case qui vient d'être cochée : un pulse radial doré bref (scale +
opacity, ~400ms) centré sur la case elle-même — la ligne de jalon reste
en place, rien d'autre à l'écran ne bouge.

### Cycle Pomodoro terminé

Déclencheur exact : `lib/pomodoro.tsx`, dans le tick de l'`useEffect`
(ligne ~156-167), au moment où `completePhase(...)` fait transitionner
`current.phase === 'work'` vers `next.phase === 'longBreak'` — c'est-à-
dire la fin du **dernier** cycle de travail avant la pause longue, pas
chaque fin de phase individuelle. `PomodoroContextValue` gagne un champ
transitoire (ex. `cycleCompletedAt: number | null`, un timestamp remis à
`null` une fois consommé) que `Pomodoro.tsx` observe : à son
apparition, le `ProgressRing` fait un pulse doré et un message "Cycle
terminé" apparaît sous le minuteur puis s'efface après ~2s.
`PomodoroOverlay.tsx` n'a pas besoin de ce signal (l'overlay est un pur
relais d'affichage minimal, pas d'ajout de logique là).

### Série prolongée

Déclencheur exact : `DetailSkill.tsx`. Le streak est déjà recalculé à
chaque changement de `entries` (`useMemo(() => calculateStreak(entries),
[entries])`). Un `useRef` garde la dernière valeur affichée ; un
`useEffect` compare la nouvelle valeur à la précédente **en ignorant le
tout premier calcul** (montage initial, ou chargement en cours — sinon
chaque visite d'écran déclencherait le pulse). Si la nouvelle valeur est
strictement supérieure : le nombre affiché ("Streak : N j") fait un pulse
doré bref (~400ms, même traitement que le jalon ci-dessus, pour un
vocabulaire de récompense cohérent). Fonctionne quelle que soit l'origine de la nouvelle entrée
(formulaire dédié, journal, checkpoint Pomodoro) puisque c'est
`entries` lui-même qui est observé, pas un événement applicatif
spécifique — pas de plomberie supplémentaire nécessaire dans
`NouvelleEntree.tsx` ou `usePracticeEntries.ts`.

## Hors scope (rappel)

- Transitions entre écrans (Phase 2) et animations d'ambiance (Phase 3)
  — chantiers séparés, futurs.
- Célébration sur une nouvelle entrée de pratique elle-même — exclue
  explicitement par le cadrage (voir "Moments de récompense" ci-dessus).
- Tout écran ou composant non cité dans ce document (Réglages,
  NouveauSkill, Introuvable, bandeau de mise à jour) — aucun changement
  visuel prévu ici.
- Le rail de navigation (`AppShell.tsx`) — déjà conforme, non retouché.

## Tests / vérification

- **Logique pure testable** : la détection "streak augmenté" (comparer
  deux entiers, ignorer le premier calcul) et la détection "cycle
  terminé" (déjà couverte indirectement par les tests existants de
  `completePhase`/`nextPhase` dans `pomodoroLogic.test.ts` — si un
  helper pur est extrait pour la détection de transition
  `work → longBreak`, il sera testé au même endroit).
- **Rendu visuel** : vérification manuelle (`npm run typecheck`, `npm
  test`, lancement `npm run dev`) — l'app Electron n'est pas
  prévisualisable dans le navigateur intégré à cette session ; la
  confirmation visuelle finale reste au retour de l'utilisateur, comme
  pour le reste des changements UI de cette session.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Ton | Raffiné et discret, dans la continuité de la charte existante |
| Périmètre | 4 catégories demandées, découpées en 3 phases ; ce document couvre la Phase 1 |
| Moments de récompense | Jalon atteint, cycle Pomodoro terminé, série prolongée — pas la simple création d'une entrée |
| Vocabulaire visuel des récompenses | Glow/pulse doré localisé ; le tracé du LogoMark reste réservé aux moments "app entière" |

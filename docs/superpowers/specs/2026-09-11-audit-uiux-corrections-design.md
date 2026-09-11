# Saint Daily — Corrections issues de l'audit UI/UX Pro Max

**Statut** : en backlog — spec rédigée, plan d'implémentation non lancé
**Date** : 2026-09-11
**Source** : audit UI/UX Pro Max du 2026-09-11 (rapport publié — voir lien partagé par l'utilisateur)

## Contexte

L'audit UI/UX Pro Max de l'app (revue écran par écran contre les
guidelines d'accessibilité, de cohérence et de formulaires) a remonté 4
constats concrets, tous vérifiés en direct dans l'app et contre le code
source. Ce document les convertit en un chantier correctif unique,
prêt à passer en plan d'implémentation quand l'utilisateur donnera le
feu vert — pour l'instant il s'agit seulement de les cadrer et de les
mettre en backlog.

Les 4 constats sont indépendants les uns des autres (fichiers et
préoccupations disjoints) mais suffisamment petits pour tenir dans un
seul chantier plutôt que 4 sous-projets séparés.

## Constat 1 — Palette de priorité sous le seuil de contraste sur le Calendrier

**Sévérité** : haute.

Les trois couleurs de `priority` (`src/renderer/src/theme/colors.ts:31-35`)
ont été mesurées par luminance relative WCAG contre les deux fonds où
elles s'affichent réellement. Le minimum WCAG 1.4.11 (contraste non-textuel
pour un indicateur d'état) est 3:1.

| Niveau | Valeur actuelle | Sur Accueil (ink-900) | Sur Calendrier (ink-800) |
|---|---|---|---|
| Élevée | `#F87171` (= `danger`) | 3.51:1 — OK | 2.77:1 — **échoue** |
| Moyenne | `#D2894A` | 3.43:1 — OK | 2.70:1 — **échoue** |
| Basse | `#6FA8A3` | 3.61:1 — OK | 2.84:1 — **échoue** |

La même palette tient de justesse sur le fond plus sombre de l'Accueil
et échoue sur le fond plus clair du Calendrier — elle n'avait été
vérifiée que sur une seule des deux destinations.

**Correction proposée** — nouvelles valeurs, calculées pour dégager une
marge confortable au-dessus de 3:1 sur ink-800 (le fond le plus
contraignant des deux) :

| Niveau | Nouvelle valeur proposée | Sur ink-900 | Sur ink-800 |
|---|---|---|---|
| Élevée | `#FF9494` (rouge dédié, ne réutilise plus `danger`) | 4.59:1 | 3.61:1 |
| Moyenne | `#E6AD70` | 4.89:1 | 3.85:1 |
| Basse | `#8FC2BC` | 4.91:1 | 3.86:1 |

**Changement de décision par rapport à la spec priorité d'origine** :
`elevee` réutilisait `danger` (`#F87171`) — mais `danger` sert aussi au
texte d'erreur ailleurs dans l'app (`role="alert"`), et le faire passer
à `#FF9494` changerait ce rendu partout, hors du périmètre de cet
audit. `elevee` reçoit donc sa propre valeur dédiée, de teinte proche
mais indépendante de `danger`.

**Constat lié** : ni la pastille (Accueil) ni la bordure gauche
(Calendrier) ne portent de nom accessible — pas de `aria-label`, pas
d'icône, pas de texte. Un utilisateur daltonien ou lecteur d'écran n'a
aucun moyen de percevoir qu'une priorité existe sur ces deux écrans ;
l'information n'est récupérable qu'en ouvrant le popover d'édition de
la tâche (WCAG 1.4.1, Use of Color).

**Fichiers concernés** :
- `src/renderer/src/theme/colors.ts:31-35` — nouvelles valeurs + commentaire documentant les ratios (même convention que le commentaire déjà présent pour `muted`)
- `src/renderer/src/screens/Accueil.tsx:266-271` — ajout d'un `aria-label` sur la pastille (ex. `Priorité : élevée`)
- `src/renderer/src/screens/Calendrier.tsx` (bloc avec `border-l-[3px]`) — ajout d'un `aria-label` équivalent sur le bloc tâche

## Constat 2 — Créneaux vides du Calendrier accessibles à la souris uniquement

**Sévérité** : haute.

`src/renderer/src/screens/Calendrier.tsx:211-215` rend chaque case
horaire vide comme un `<div onClick={...}>` nu : pas de
`role="button"`, pas de `tabIndex`, pas de gestion clavier, pas de nom
accessible. Créer une tâche via "cliquer un créneau" est donc
entièrement inaccessible au clavier (WCAG 2.1.1). La création de tâche
reste possible par un autre chemin (le formulaire dédié) : c'est le
raccourci propre au calendrier qui est concerné, pas la fonctionnalité
dans son ensemble.

**Correction proposée** : `role="button"`, `tabIndex={0}`, un
`onKeyDown` déclenchant sur Entrée/Espace (même action que `onClick`),
et un `aria-label` du type `Créer une tâche le {jour} à {heure}`.

**Fichier concerné** : `src/renderer/src/screens/Calendrier.tsx:211-215`

## Constat 3 — Case à cocher native au lieu du composant Toggle

**Sévérité** : moyenne.

"Inclure l'historique de pratique"
(`src/renderer/src/screens/Calendrier.tsx:142-147`) est le seul réglage
booléen de l'app qui n'utilise pas le composant `Toggle` déjà en place
partout ailleurs (Réglages, ListeSkills) — c'est un
`<input type="checkbox">` brut, sans style. Fonctionnellement
accessible (une case native l'est par défaut), mais visuellement en
rupture avec le reste du système.

**Correction proposée** : remplacer par le composant `Toggle` existant
(`src/renderer/src/components/Toggle.tsx`), même intégration que sur
Réglages.

**Fichier concerné** : `src/renderer/src/screens/Calendrier.tsx:142-147`

## Constat 4 — Champ "Nom" obligatoire sans indicateur proactif

**Sévérité** : faible.

Sur "Nouveau skill", le champ "Nom" est requis mais ne porte aucun
indicateur visuel avant soumission — l'utilisateur ne l'apprend qu'au
message d'erreur post-soumission (`role="alert"`, correctement annoncé,
mais réactif plutôt que préventif).

**Correction proposée** : un indicateur visuel à côté du label (ex.
astérisque + mention "obligatoire" en légende, cohérent avec le reste
du formulaire).

**Fichier concerné** : `src/renderer/src/screens/NouveauSkill.tsx`

## Hors scope

- Toute autre couleur ou composant non mentionné par l'audit — ce
  chantier corrige exactement les 4 constats ci-dessus, pas une passe
  de refonte visuelle.
- Le token `danger` global — reste inchangé, voir la justification au
  constat 1.
- Les 4 pièces restantes du sous-projet 3 ("mécaniques de tâches
  avancées" : snooze, regroupement par projet, sous-tâches,
  récurrence) — sans lien avec cet audit, restent des chantiers
  séparés à cadrer plus tard.

## Tests / vérification

- Aucune nouvelle logique pure : pas de nouveau test Vitest attendu.
- Vérification manuelle une fois implémenté : contraste des 3 couleurs
  recalculé (ou vérifié via un outil de contraste) sur les deux fonds ;
  navigation clavier complète sur une semaine du Calendrier (Tab
  jusqu'à une case vide, Entrée pour créer une tâche) ; comparaison
  visuelle de la case Calendrier avec les Toggle de Réglages ; capture
  du formulaire "Nouveau skill" avec l'indicateur visible.

## Décisions à confirmer avant le plan d'implémentation

| Question | Proposition de cette spec |
|---|---|
| Nouvelles couleurs de priorité | `#FF9494` / `#E6AD70` / `#8FC2BC` (calculées pour ≥3.6:1 sur ink-800) — à valider visuellement dans l'app avant de figer |
| `elevee` garde-t-elle une teinte rouge proche de `danger` ou totalement libre ? | Cette spec choisit de rester proche (même famille de rouge), pour ne pas perdre l'association visuelle "urgence" |
| Libellé exact des `aria-label` | Cette spec propose `Priorité : {niveau}` et `Créer une tâche le {jour} à {heure}` — à ajuster si une autre formulation est préférée |

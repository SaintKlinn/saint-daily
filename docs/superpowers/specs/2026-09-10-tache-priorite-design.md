# Saint Daily — Priorité des tâches (sous-projet 3, pièce 1/5)

**Statut** : approuvé pour passage en plan d'implémentation
**Date** : 2026-09-10

## Contexte

Premier des cinq chantiers issus de la décomposition du sous-projet 3
("mécaniques de tâches avancées", évoqué comme hors scope dans les specs
des sous-projets 1 et 2). Les quatre autres pièces — snooze rapide,
regroupement par projet, sous-tâches, récurrence — restent des chantiers
séparés, à cadrer un par un une fois celui-ci livré.

Ce document couvre uniquement la priorité d'une tâche : un niveau parmi
quatre, réglable à la création et modifiable ensuite, avec un indicateur
visuel sur l'Accueil et le calendrier. Aucune autre forme d'édition de
tâche n'est introduite ici.

## Modèle de données

Migration additive, une colonne, même convention que `generic_level`
(déjà en place sur `engagement`) :

```sql
alter table saint_daily.engagement add column priority text not null default 'aucune'
  check (priority in ('aucune', 'basse', 'moyenne', 'elevee'));
```

S'applique à toute la table `engagement`, skills compris — la colonne
existe sur tous les engagements pour rester une seule table, mais
`priority` n'apparaît nulle part dans l'UI des skills ; seules les
tâches (avec `scheduled_at`) l'exposent. Aucune réécriture de données
existantes : toute ligne déjà présente prend `'aucune'` par défaut.

## Sélection à la création

`src/renderer/src/screens/NouvelleTache.tsx` gagne un sélecteur de
priorité — même principe que le sélecteur de durée déjà en place
(groupe de boutons) : **Aucune** / **Basse** / **Moyenne** / **Élevée**,
"Aucune" sélectionnée par défaut. `createEngagement` transmet la
priorité choisie à la création.

## Modification depuis le popover

Le popover du calendrier (`src/renderer/src/components/TaskPopover.tsx`)
gagne le même sélecteur de priorité. Le changement s'enregistre
immédiatement au clic, sans bouton "Enregistrer" séparé — même
comportement que la case "Inclure l'historique de pratique" du
calendrier, qui écrit dès le changement. Réutilise `updateEngagement`
(déjà en place sur `useEngagements`, actuellement limité à
`name`/`notes`/`tags`/`genericLevel`), étendu pour accepter `priority`.

Aucune autre forme d'édition n'est ajoutée : pas de renommage, pas de
changement de créneau, pas de changement de tags depuis le popover. La
priorité est la seule chose modifiable après création dans ce
sous-projet.

## Affichage

**Accueil ("Tâches à faire")** : une pastille colorée à côté du nom de
la tâche, sur le même principe visuel que le point déjà utilisé dans
les `StatCard` de l'Accueil (`<span className="h-[5px] w-[5px]
rounded-full" style={{ background: ... }} />`).

**Calendrier** : le bloc garde son style actuel (fond et bordure
`border-accent-bright/40` sur les 4 côtés, inchangés) et gagne en plus
un liseré coloré de 3px sur le bord gauche uniquement
(`border-l-[3px]`, couleur selon la priorité) — plutôt qu'une pastille,
plus robuste sur un créneau court où le texte est déjà tronqué.

**"Aucune"** : aucun changement visuel dans les deux cas — pas de
pastille sur l'Accueil, pas de liseré sur le bloc calendrier (bordure
`border-accent-bright/40` sur les 4 côtés, identique à l'état actuel).

**Couleurs** : trois nouveaux tokens dans `theme/colors.ts`, sous un
objet `priority`, en plus de la palette existante :

```ts
priority: {
  elevee: colors.danger,   // #F87171 — réutilise le rouge déjà en place pour signaler l'urgence
  moyenne: '#D2894A',      // ambre/terracotta chaud — distinct de l'or accent déjà utilisé pour les états actifs/primaires
  basse: '#6FA8A3',        // bleu-sarcelle doux — calme, contraste suffisant sur les fonds ink sans jurer avec l'émeraude
},
```

`elevee` réutilise `danger` plutôt que d'introduire une quatrième
teinte : le rouge signale déjà l'urgence ailleurs dans l'app (erreurs),
et "priorité élevée" porte la même charge sémantique. `moyenne` évite
volontairement l'or `accent.bright` — cet or signale déjà "actif/primaire"
partout ailleurs (nav, boutons), le réutiliser pour "priorité moyenne"
créerait une ambiguïté visuelle.

**Tri inchangé** : les deux écrans restent triés par heure ; la
priorité reste un repère visuel, jamais un critère de tri, pour ne pas
perturber la logique chronologique déjà en place.

## Hors scope (rappel)

- Les 4 autres pièces du sous-projet 3 décomposé : snooze rapide,
  regroupement par projet, sous-tâches, récurrence — chacune son propre
  cadrage ultérieur, spec par spec.
- Toute édition de tâche au-delà de la priorité (renommer, déplacer,
  changer le créneau, changer les tags).
- Priorité sur les skills — la colonne existe en base pour rester une
  seule table `engagement`, mais n'apparaît dans aucun écran skill.
- Tri par priorité — délibérément écarté, voir "Affichage" plus haut.

## Étape manuelle requise (Supabase)

Même méthode que les migrations précédentes : l'utilisateur applique la
migration SQL ci-dessus dans l'éditeur SQL du dashboard Supabase, en une
seule exécution transaction-wrapped (`begin;`/`commit;`, convention
adoptée depuis la revue finale du sous-projet 1).

## Tests / vérification

- Aucune fonction pure nouvelle candidate à un test Vitest dédié — ce
  chantier est un champ supplémentaire sur un flux déjà existant
  (création, modification), sans nouvelle logique de calcul.
- Vérification manuelle contre la base réelle une fois la migration
  appliquée : créer une tâche avec chaque niveau de priorité, confirmer
  la pastille/bordure correspondante sur l'Accueil et le calendrier ;
  changer la priorité depuis le popover, confirmer que le changement
  persiste après rechargement ; confirmer qu'une tâche "Aucune" reste
  visuellement identique à l'état actuel.

## Décisions prises pendant le brainstorming (résumé)

| Question | Décision |
|---|---|
| Portée du sous-projet 3 | Décomposé en 5 pièces indépendantes ; celle-ci ne couvre que la priorité |
| Priorité sur skills ou tâches seulement | Tâches uniquement (les skills ont déjà `generic_level`, un concept différent) |
| Échelle | 4 niveaux façon TickTick : Aucune (défaut) / Basse / Moyenne / Élevée |
| Modifiable après création | Oui, via un sélecteur dans le popover du calendrier — pas un formulaire d'édition complet |
| Affichage | Pastille sur l'Accueil, bordure colorée sur le calendrier ; "Aucune" = inchangé |
| Tri | Inchangé (par heure) — la priorité reste un repère visuel |

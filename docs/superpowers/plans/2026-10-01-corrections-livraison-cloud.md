# Corrections de la livraison cloud — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les dix défauts Important trouvés le 1er octobre 2026 par trois revues de branche et par la vérification live, sur le code livré depuis une session cloud (`9fbfc23..59d63d4`, versions 1.10.0 et 1.11.0).

**Architecture:** Dix corrections indépendantes, regroupées en sept tâches par fichier touché. Deux d'entre elles changent un modèle local — l'historique des jours de repos, et la mémoire des paliers fêtés — et le font sans migration ni rupture des valeurs déjà stockées : les anciens formats restent lus tels quels. Tout ce qui se calcule vit dans `lib/` et se teste.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Supabase (PostgREST), react-router-dom (HashRouter), motion/react, Vitest.

**Spec:** il n'y en a pas pour le code corrigé — la session cloud n'en a pas écrit. La source de ce plan est l'ensemble des constats des trois revues et de la vérification live, recopiés tâche par tâche ci-dessous avec leur scénario.

## Global Constraints

- **Aucune migration de base, aucune colonne nouvelle.** Les migrations sont appliquées à la main ; le code doit fonctionner sans attendre.
- **Toute la logique dérivée vit en fonctions pures dans `lib/`.** Le dépôt n'a ni jsdom ni `@testing-library/react`, seulement vitest : c'est le seul endroit où un calcul peut être vérifié.
- **Les six rôles de texte sont les seuls autorisés** : `libelle` 11 px, `secondaire` 13 px, `corps` 15 px, `titre` 20 px, `titre-ecran` 28 px, `heros` 40 px.
- **Les sept valeurs d'espacement sont les seules autorisées** : `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `6` (24 px), `8` (32 px), `12` (48 px). Hors `gap-px`.
- **Ne jamais écrire un nom de classe Tailwind dans un commentaire** : l'énumération des classes du diff ne distingue pas le code des commentaires.
- **Le français** pour l'interface, les commentaires et les noms. Les messages de commit en anglais.
- **Les 387 tests existants restent verts** et `npm run typecheck` reste propre à la fin de chaque tâche.
- **Tout hook dont la valeur fermée peut changer pendant qu'une requête est en vol porte le verrou de génération** (`useRef` incrémenté avant l'`await`, comparé après).

## Les deux décisions prises sans attendre l'utilisateur

**Jours de repos.** Changer ses jours de repos hebdomadaires vaut **à partir du jour du changement**, jamais pour le passé. Un réglage modifié ne doit pas réécrire une série vécue : décocher « Dim » ne casse pas rétroactivement une série de 60 jours. Les dates ponctuelles ne sont **plus jamais élaguées** — elles coûtent onze octets chacune, et leur élagage raccourcissait une série de plus de 400 jours et refaisait fêter « Un an d'affilée ».

**Paliers de série.** L'accueil calcule la série du palier sur **toutes les séances**, comme la « Série en cours » du Bilan qui compte les tâches cochées. Et un palier déjà fêté ne se refête pas quand le premier jour de la série se déplace (mise en pause d'un skill, date de repos ajoutée) : deux séries sont la même si l'actuelle a commencé au plus tard le jour de la dernière célébration.

## Structure des fichiers

| Fichier | Tâche | Responsabilité |
|---|---|---|
| `src/renderer/src/hooks/useEngagements.ts` | 1 | **modifié** — `softDelete` n'emporte jamais un sous-projet |
| `src/renderer/src/screens/DetailProjet.tsx` | 1 | **modifié** — `handleDelier` n'écrit plus `project_id` sur un sous-projet |
| `src/renderer/src/screens/NouvelleEntree.tsx` | 1, 2 | **modifié** — redirection vers le projet ; erreur visible ; utilisable avec seulement des projets |
| `src/renderer/src/screens/Pomodoro.tsx` | 2 | **modifié** — erreur visible, pas d'accueil « premier pas » sur un échec |
| `src/renderer/src/screens/Accueil.tsx` | 2, 6 | **modifié** — idem ; base de la série du palier |
| `src/renderer/src/screens/ListeSkills.tsx` | 2 | **modifié** — idem |
| `src/renderer/src/screens/ListeProjets.tsx` | 2 | **modifié** — idem |
| `src/renderer/src/hooks/useActionsRapidesTray.ts` | 3 | **modifié** — n'épingle l'overlay que si un minuteur tourne |
| `src/renderer/src/lib/pomodoro.tsx` | 4 | **modifié** — aucune session sauvegardée pendant une consolidation |
| `src/renderer/src/lib/joursRepos.ts` | 5 | **modifié** — historique daté du réglage hebdomadaire, plus d'élagage |
| `src/renderer/src/lib/joursRepos.test.ts` | 5 | **modifié** — ses tests |
| `src/renderer/src/components/ReglagesJoursRepos.tsx` | 5 | **modifié** — passe le jour du changement |
| `src/renderer/src/lib/paliers.ts` | 6 | **modifié** — une même série reconnue malgré un début déplacé |
| `src/renderer/src/lib/paliers.test.ts` | 6 | **modifié** — ses tests |
| `src/renderer/src/hooks/usePracticeEntries.ts` | 6 | **modifié** — départage par `id` de la lecture paginée de toutes les séances |
| `src/renderer/src/components/Dialogue.tsx` | 7 | **modifié** — focus rendu à l'ouvreur ; seule la fenêtre du dessus réagit |
| `src/renderer/src/components/PaletteCommandes.tsx` | 7 | **modifié** — espacement dans l'échelle |

Total attendu à la fin : **395 tests, 30 fichiers** (387 + 5 en tâche 5 + 3 en tâche 6).

---

### Task 1 : Projets — le sous-projet envoyé à la corbeille, et « Introuvable » après une séance de chantier

**Files:**
- Modify: `src/renderer/src/hooks/useEngagements.ts` (`softDelete`, vers la ligne 316)
- Modify: `src/renderer/src/screens/DetailProjet.tsx` (`handleDelier`, vers la ligne 238)
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx` (ligne 81)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: rien.

**Constat 1.** Un sous-projet C est rangé sous P1 et sous P2. `handleLier` n'écrit jamais `project_id` pour un sous-projet (il sort avant `synchroniserColonne`, `DetailProjet.tsx:233`), mais `handleDelier` l'appelle toujours. Retirer C de P1 écrit donc `project_id = P2` sur C ; supprimer ensuite P2 passe par `softDelete(P2, true)`, qui envoie à la corbeille tout ce qui porte `project_id = P2` — C part avec, sans ses membres, et disparaît aussi de P1.

**Constat 2.** Depuis « Nouvelle entrée » sur un projet, la séance s'enregistre, puis `navigate(`/skills/${skillId}`)` mène à `DetailSkill`, qui filtre `!e.isProject` et affiche « Introuvable — Ce skill n'existe plus : il a été supprimé définitivement ». Vérifié en live.

- [ ] **Step 1: `softDelete` n'emporte plus jamais un sous-projet**

Dans `src/renderer/src/hooks/useEngagements.ts`, la requête des enfants de `softDelete` :

```ts
    if (isProject) {
      // Jamais un sous-projet : il partirait sans ses propres membres, et
      // disparaîtrait de ses autres parents. Le filtre est posé ici, à la
      // source, plutôt que de compter sur `project_id` jamais écrit pour un
      // sous-projet — une valeur parasite a déjà pu l'être par le passé
      // (retrait d'un parent, voir handleDelier).
      const { error: childrenError } = await supabase
        .from('engagement')
        .update({ deleted_at: deletedAt })
        .eq('project_id', id)
        .eq('is_project', false)
        .is('deleted_at', null);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
    }
```

`restore` et `purge` n'ont rien à changer : un sous-projet n'étant plus jamais envoyé à la corbeille avec son parent, `restore` (qui ne relève que les enfants partis au même horodatage) ne le concerne pas, et l'étape 2 de `purge` qui détache tout le monde reste inoffensive.

- [ ] **Step 2: `handleDelier` n'écrit plus `project_id` sur un sous-projet**

Dans `src/renderer/src/screens/DetailProjet.tsx`, ajouter à `handleDelier` la même garde que `handleLier` :

```tsx
  async function handleDelier(engagementId: string) {
    if (!id) return;
    setActionError(null);
    const { error: delierError, liaisons: fraiches } = await delier(engagementId, id);
    if (delierError) {
      setActionError(delierError);
      return;
    }
    // Même garde que handleLier : pas de `project_id` pour un sous-projet.
    // Sans elle, retirer un sous-projet d'un de ses parents écrivait l'autre
    // parent dans la colonne, et supprimer cet autre parent l'emportait en
    // corbeille.
    if (engagements.find((e) => e.id === engagementId)?.isProject) return;
    const { error: syncError } = await synchroniserColonne(engagementId, fraiches, updateEngagement);
    if (syncError) setActionError(syncError);
  }
```

- [ ] **Step 3: après une séance de chantier, revenir au projet**

Dans `src/renderer/src/screens/NouvelleEntree.tsx`, remplacer la ligne 81 `navigate(`/skills/${skillId}`);` par :

```tsx
    // Une séance de chantier porte sur un projet : la fiche d'un skill le
    // filtrerait et dirait « Introuvable — supprimé définitivement », alors
    // que la séance vient d'être enregistrée.
    navigate(projets.some((p) => p.id === skillId) ? `/projets/${skillId}` : `/skills/${skillId}`);
```

`projets` est déjà déclaré dans ce composant (ligne 27).

- [ ] **Step 4: Vérifier**

Run: `npx vitest run` — Expected: **387 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hooks/useEngagements.ts src/renderer/src/screens/DetailProjet.tsx src/renderer/src/screens/NouvelleEntree.tsx
git commit -m "fix: never trash a sub-project with a parent, and return to the project after a chantier session"
```

---

### Task 2 : Un échec de chargement n'est pas un compte vide

**Files:**
- Modify: `src/renderer/src/screens/Pomodoro.tsx`
- Modify: `src/renderer/src/screens/NouvelleEntree.tsx`
- Modify: `src/renderer/src/screens/Accueil.tsx`
- Modify: `src/renderer/src/screens/ListeSkills.tsx`
- Modify: `src/renderer/src/screens/ListeProjets.tsx`

**Interfaces:**
- Consumes: `useEngagements()` rend `{ engagements, loading, error, … }` ; `error` vaut une chaîne en français quand la lecture a échoué, et `engagements` vaut alors `[]`.
- Produces: rien.

**Constat.** Quand la lecture des engagements échoue (wifi coupé, erreur serveur, et après la migration 0017 un jeton expiré qui retombe sur `anon`), `engagements` vaut `[]`, `loading` faux et `error` est posé. Cinq écrans prennent alors cette liste vide pour un compte neuf : « Il te faut un skill » sur le Pomodoro, « Aucun skill pour l'instant » à la place du formulaire de Nouvelle entrée (sans même afficher l'erreur), la carte « Bienvenue » de l'Accueil sous le message rouge, et les appels à créer de ListeSkills et ListeProjets. Un utilisateur qui a des données se fait dire qu'il n'en a pas.

**La règle, appliquée aux cinq** : l'état « premier pas » ne s'affiche que si la lecture a **réussi** et rendu une liste vide ; sur un échec, l'erreur s'affiche et rien d'autre ne prétend que le compte est vide.

- [ ] **Step 1: Pomodoro**

Dans `src/renderer/src/screens/Pomodoro.tsx`, ligne 28, prendre aussi l'erreur :

```tsx
  const { engagements, loading: skillsLoading, error: skillsError } = useEngagements();
```

Afficher l'erreur juste au-dessus du bloc existant `{error && (…)}` (vers la ligne 160), avec la même présentation :

```tsx
        {skillsError && (
          <p role="alert" className="text-corps text-danger">
            {skillsError}
          </p>
        )}
```

Et ajouter `!skillsError` à la condition de l'état vide (vers la ligne 177) :

```tsx
        {!skillsLoading && !skillsError && praticables.length === 0 && !selectedSkill ? (
```

- [ ] **Step 2: Nouvelle entrée — erreur visible, et utilisable avec seulement des projets**

Dans `src/renderer/src/screens/NouvelleEntree.tsx`, ligne 23 :

```tsx
  const { engagements, loading: engagementsLoading, error: engagementsError } = useEngagements();
```

Juste avant le commentaire « Sans aucun skill, le menu « Choisir… » était vide » (vers la ligne 91), afficher l'erreur :

```tsx
      {engagementsError && (
        <p role="alert" className="relative text-corps text-danger">
          {engagementsError}
        </p>
      )}
```

Puis remplacer la condition de l'état vide. Elle ne tenait compte que des skills ; depuis les sessions de chantier, un projet est aussi une cible valable, et un compte qui n'a que des projets ne pouvait pas enregistrer de séance :

```tsx
      {/* Sans rien à cibler, le menu « Choisir… » était vide : on ne pouvait
          ni remplir ni comprendre le formulaire. Un projet est aussi une
          cible (session de chantier). Jamais sur un échec de lecture : une
          liste vide n'y veut pas dire « aucun skill ». */}
      {!engagementsLoading && !engagementsError && skills.length === 0 && projets.length === 0 ? (
```

Le message de l'`EmptyState` qui suit reste celui d'aujourd'hui.

- [ ] **Step 3: Accueil**

Dans `src/renderer/src/screens/Accueil.tsx`, l'erreur des engagements s'appelle `skillsError` et s'affiche déjà (vers la ligne 379). Ajouter seulement la garde à la condition de `PremiersPas` (vers la ligne 399) :

```tsx
      {!engagementsLoading && !skillsError && skills.length === 0 ? (
```

Lire d'abord comment `skillsError` et `engagementsLoading` sont déclarés en tête du composant, pour reprendre leurs noms exacts.

- [ ] **Step 4: ListeSkills et ListeProjets**

Dans `src/renderer/src/screens/ListeSkills.tsx` et `src/renderer/src/screens/ListeProjets.tsx`, l'erreur de `useEngagements()` est déjà lue et affichée sous le nom `error`. Ajouter `!error` à la condition qui ouvre l'état vide :

```tsx
      {!loading &&
        !error &&
        visible.length === 0 &&
```

pour ListeSkills (vers la ligne 162), et pour ListeProjets (vers la ligne 252) :

```tsx
      {!loading &&
        !error &&
        lignesTriees.length === 0 &&
```

Vérifier dans chaque fichier le nom réel de la variable d'erreur des engagements avant de l'utiliser.

- [ ] **Step 5: Vérifier**

Run: `npx vitest run` — Expected: **387 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Pomodoro.tsx src/renderer/src/screens/NouvelleEntree.tsx src/renderer/src/screens/Accueil.tsx src/renderer/src/screens/ListeSkills.tsx src/renderer/src/screens/ListeProjets.tsx
git commit -m "fix: show the load error instead of a first-run screen when engagements fail to load"
```

---

### Task 3 : Le tray n'épingle plus un overlay vide

**Files:**
- Modify: `src/renderer/src/hooks/useActionsRapidesTray.ts` (lignes 55-66)

**Interfaces:**
- Consumes: `window.api.focusWindow()` (`src/preload/index.ts:65`) montre et met au premier plan la fenêtre principale, même cachée dans le tray (`src/main/index.ts:100`).
- Produces: rien.

**Constat.** « Démarrer un pomodoro » depuis le tray ne démarre la session que si `durations` est chargé, mais appelle `setPinned(true)` dans tous les cas quand la fenêtre est cachée. `durations` reste nul quand les réglages n'ont pas pu se charger (lancement automatique à l'ouverture de Windows avant le wifi), et `useSettings` ne réessaie pas. Résultat : une fenêtre transparente, toujours au premier plan, de 360 × 84 en haut à droite de l'écran, vide, qui capture les clics — et rien dans l'interface ne permet de la désépingler.

- [ ] **Step 1: Épingler seulement si un minuteur tourne, sinon montrer l'écran**

Remplacer le second `useEffect` :

```ts
  useEffect(
    () =>
      window.api?.onTrayPomodoroStart?.(({ skillId, skillName, fenetreVisible }) => {
        const { session, durations, start, setPinned } = pomodoroRef.current;
        // Une session déjà en cours n'est jamais remplacée depuis le tray :
        // on la montre, c'est tout.
        if (!session && durations) start(skillId, skillName, durations.workMinutes);
        // Sans réglages chargés, rien n'a démarré : épingler l'overlay
        // laisserait une fenêtre transparente et vide capturer les clics en
        // haut à droite de l'écran, sans moyen de la retirer. On montre
        // plutôt l'écran Pomodoro, qui dit ce qui manque.
        const minuteurEnCours = Boolean(session) || Boolean(durations);
        if (fenetreVisible || !minuteurEnCours) {
          if (!fenetreVisible) window.api?.focusWindow?.();
          navigate('/pomodoro');
        } else {
          setPinned(true);
        }
      }),
    [navigate]
  );
```

`session` lu ici est celui d'avant l'appel à `start` (l'état React ne change qu'au rendu suivant) : « un minuteur tourne » vaut donc « une session existait déjà, ou `start` vient d'être appelé ».

- [ ] **Step 2: Vérifier**

Run: `npx vitest run` — Expected: **387 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useActionsRapidesTray.ts
git commit -m "fix: pin the pomodoro overlay from the tray only when a timer actually started"
```

---

### Task 4 : Un Arrêter interrompu par la fermeture ne se consolide pas deux fois

**Files:**
- Modify: `src/renderer/src/lib/pomodoro.tsx`

**Interfaces:**
- Consumes: `effacerSessionPersistee()` de `./pomodoroPersistance` (déjà importé ligne 23) ; `flushLockRef` (ligne 133).
- Produces: rien.

**Constat.** La session sauvegardée n'est effacée que par l'effet qui suit `setSession(null)`, donc **après** les trois ou quatre allers-retours de `flushSession`. Pendant ce temps le statut reste `running`, et le battement de cœur (toutes les 5 s) comme `pagehide` réécrivent la session d'avant l'arrêt, avec ses anciens `loggedEntryIds`. Cliquer Arrêter puis quitter l'app dans la seconde (depuis le tray, extinction, redémarrage pour mise à jour) fait revenir cette session au lancement suivant ; un second Arrêter la consolide à nouveau. Avec des checkpoints de 25 + 25 min et 10 min de cycle en cours, on peut finir à **130 min enregistrées pour 60 min de travail**. `switchEngagement` a la même fenêtre.

**La correction** : effacer la session sauvegardée **avant le premier `await`** d'une consolidation, et rendre `persist` inopérant tant que la consolidation est en vol. Un arrêt brutal pendant la consolidation laisse alors, au pire, des checkpoints non consolidés ou le doublon déjà accepté (« visible et corrigeable dans le journal », voir le commentaire de `flushSession`) — jamais une seconde consolidation de la même session.

- [ ] **Step 1: `persist` ne réécrit rien pendant une consolidation**

En tête de la fonction `persist` (vers la ligne 152) :

```ts
  const persist = useCallback(() => {
    // Pendant une consolidation, la session en mémoire est celle d'AVANT
    // l'arrêt : la réécrire ferait revenir au lancement suivant une session
    // déjà soldée si l'app se ferme à ce moment-là, et un second Arrêter la
    // consoliderait une deuxième fois.
    if (flushLockRef.current) return;
    const current = sessionRef.current;
```

`flushLockRef` est déclaré plus haut dans le composant (ligne 133) : il est disponible ici.

- [ ] **Step 2: Effacer la sauvegarde dès que la consolidation commence**

Dans `switchEngagement`, juste après `flushLockRef.current = true;` :

```ts
    flushLockRef.current = true;
    // Avant le premier aller-retour : si l'app se ferme pendant la
    // consolidation, aucune session déjà soldée ne revient au lancement.
    // L'effet de sauvegarde réécrit la session poursuivie dès que le
    // changement est terminé.
    effacerSessionPersistee();
    setSwitching(true);
```

Dans `stop`, juste après `flushLockRef.current = true;` :

```ts
    flushLockRef.current = true;
    // Avant le premier aller-retour, pour la même raison que
    // switchEngagement.
    effacerSessionPersistee();
    try {
```

Le coût, assumé : une fermeture brutale **pendant** un changement d'engagement perd le minuteur en cours (le temps déjà enregistré, lui, est en base). Mieux vaut perdre un minuteur que compter deux fois du temps.

- [ ] **Step 3: Vérifier**

Run: `npx vitest run` — Expected: **387 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

Ce chemin n'est pas testable unitairement (il vit dans le Provider) ; la revue de tâche le trace.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/lib/pomodoro.tsx
git commit -m "fix: never restore a pomodoro session whose stop or switch was cut short by closing the app"
```

---

### Task 5 : Les jours de repos ne réécrivent plus le passé

**Files:**
- Modify: `src/renderer/src/lib/joursRepos.ts`
- Modify: `src/renderer/src/lib/joursRepos.test.ts`
- Modify: `src/renderer/src/components/ReglagesJoursRepos.tsx` (ligne 72)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces:
  - `export const DEPUIS_TOUJOURS = '0000-01-01'`
  - `export interface PeriodeHebdo { depuis: string; jours: number[] }`
  - `JoursRepos` gagne `historique?: PeriodeHebdo[]` (optionnel)
  - `basculerJourHebdo(repos: JoursRepos, jour: number, aujourdhui: string): JoursRepos` — **troisième paramètre ajouté**
  - `ecrireJoursRepos(repos: JoursRepos, stockage?: StockageLike | null): JoursRepos` — **paramètre `now` retiré**

**Constat (a).** Le réglage hebdomadaire n'a pas de date d'effet : `estJourDeRepos` l'applique à tous les jours passés. Avec le dimanche en repos depuis dix semaines et une série d'une soixantaine de jours, décocher « Dim » fait du dimanche d'hier une rupture : la série tombe à 1, le record du Bilan à 6, et les badges 7 et 30 jours se reverrouillent.

**Constat (b).** `ecrireJoursRepos` élague à **chaque** écriture les dates ponctuelles de plus de 400 jours. Une série de 426 jours qui enjambe un repos ancien perd 14 jours au premier geste sur les jours de repos, et son début se déplaçant, « Un an d'affilée » est refêté avec sa sonnerie.

**Le modèle.** `hebdo` reste le réglage **en vigueur aujourd'hui**, ce que l'écran affiche. `historique`, optionnel, liste les réglages successifs, chacun valant de `depuis` (inclus) jusqu'au suivant. **Absent, `hebdo` vaut depuis toujours** — exactement le comportement d'avant : les valeurs déjà stockées et tous les objets construits à la main dans les tests restent valides tels quels. L'historique n'apparaît qu'au premier changement de réglage hebdomadaire.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/renderer/src/lib/joursRepos.test.ts`, compléter l'import de `./joursRepos` avec `basculerJourHebdo` et `DEPUIS_TOUJOURS`.

**Remplacer** le test « oublie les dates ponctuelles trop anciennes » — il affirme le défaut — par :

```ts
  it('garde toutes les dates ponctuelles, même très anciennes', () => {
    // Les élaguer raccourcissait une série de plus de 400 jours et faisait
    // refêter « Un an d'affilée ». Une date coûte onze octets.
    const stockage = stockageFactice();
    ecrireJoursRepos({ hebdo: [], dates: ['2024-01-01', '2026-08-01'] }, stockage);
    expect(lireJoursRepos(stockage).dates).toEqual(['2024-01-01', '2026-08-01']);
  });
```

Dans le test « relit ce qui a été écrit, trié et sans doublon », retirer l'argument `LUNDI` de l'appel : `ecrireJoursRepos({ hebdo: [6, 0, 6], dates: ['2026-09-02', '2026-09-01'] }, stockage);`. Son attente ne change pas.

Ajouter un `describe` à la fin du fichier :

```ts
describe('historique du réglage hebdomadaire', () => {
  it('un réglage modifié aujourd’hui ne vaut qu’à partir d’aujourd’hui', () => {
    const repos = basculerJourHebdo({ hebdo: [0], dates: [] }, 0, '2026-08-31');
    expect(repos.hebdo).toEqual([]);
    expect(estJourDeRepos(new Date('2026-08-30T12:00:00Z'), repos)).toBe(true); // dimanche passé
    expect(estJourDeRepos(new Date('2026-09-06T12:00:00Z'), repos)).toBe(false); // dimanche à venir
  });

  it('retirer le dimanche ne casse pas la série déjà vécue', () => {
    // Pratique du lundi au samedi depuis le 10 août, dimanches en repos :
    // 19 jours pratiqués jusqu'au lundi 31.
    const jours: string[] = [];
    for (let d = new Date('2026-08-10T00:00:00Z'); d <= LUNDI; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0) jours.push(d.toISOString().slice(0, 10));
    }
    const entries = jours.map(seance);
    const avant = { hebdo: [0], dates: [] };
    expect(calculateStreak(entries, LUNDI, avant)).toBe(19);
    const apres = basculerJourHebdo(avant, 0, '2026-08-31');
    expect(calculateStreak(entries, LUNDI, apres)).toBe(19);
    expect(calculateBestStreak(entries, apres)).toBe(19);
  });

  it('l’ancien format, sans historique, vaut depuis toujours', () => {
    expect(estJourDeRepos(new Date('2020-01-05T12:00:00Z'), { hebdo: [0], dates: [] })).toBe(true);
    expect(normaliserJoursRepos({ hebdo: [0], dates: [] }).historique).toBeUndefined();
  });

  it('plusieurs bascules le même jour ne laissent qu’une période pour ce jour', () => {
    let repos = basculerJourHebdo({ hebdo: [0], dates: [] }, 6, '2026-08-31');
    repos = basculerJourHebdo(repos, 0, '2026-08-31');
    expect(repos.historique).toEqual([
      { depuis: DEPUIS_TOUJOURS, jours: [0] },
      { depuis: '2026-08-31', jours: [6] },
    ]);
    expect(repos.hebdo).toEqual([6]);
  });

  it('le jour affiché suit aussi l’historique', () => {
    const repos = basculerJourHebdo({ hebdo: [0], dates: [] }, 0, '2026-08-31');
    expect(estJourDeReposLocal(new Date(2026, 7, 30), repos)).toBe(true);
    expect(estJourDeReposLocal(new Date(2026, 8, 6), repos)).toBe(false);
  });
});
```

Cinq tests nouveaux ; un remplacé.

Run: `npx vitest run src/renderer/src/lib/joursRepos.test.ts`
Expected: FAIL — `basculerJourHebdo` n'accepte pas de troisième argument, `DEPUIS_TOUJOURS` n'existe pas, et la date de 2024 est encore élaguée.

- [ ] **Step 2: Le modèle et ses fonctions**

Dans `src/renderer/src/lib/joursRepos.ts` :

1. Remplacer l'interface `JoursRepos` et ajouter ce qui l'accompagne :

```ts
/** Un réglage hebdomadaire et le jour où il a pris effet. */
export interface PeriodeHebdo {
  // `YYYY-MM-DD`, inclus. `DEPUIS_TOUJOURS` pour le réglage d'avant tout
  // historique.
  depuis: string;
  jours: number[];
}

/** Antérieur à toute date réelle : vaut « depuis toujours ». */
export const DEPUIS_TOUJOURS = '0000-01-01';

export interface JoursRepos {
  // Le réglage hebdomadaire en vigueur aujourd'hui — ce que l'écran affiche.
  // 0 = dimanche … 6 = samedi (`getUTCDay`).
  hebdo: number[];
  // Les réglages successifs, du plus ancien au plus récent : chacun vaut de
  // `depuis` (inclus) jusqu'au suivant. Absent, `hebdo` vaut depuis
  // toujours — le comportement d'avant cet historique, ce qui garde valides
  // les valeurs déjà stockées. Sans lui, décocher un jour aujourd'hui
  // réécrivait toutes les séries passées.
  historique?: PeriodeHebdo[];
  // Jours ponctuels, `YYYY-MM-DD`.
  dates: string[];
}
```

2. Supprimer la constante `CONSERVATION_JOURS` et son commentaire.

3. Ajouter, avant `estJourDeRepos` :

```ts
/** Les jours de la semaine en repos à la date de clé `cle` (`YYYY-MM-DD`). */
export function joursHebdoAu(repos: JoursRepos, cle: string): number[] {
  if (!repos.historique || repos.historique.length === 0) return repos.hebdo;
  let jours: number[] = [];
  for (const periode of repos.historique) {
    if (periode.depuis > cle) break;
    jours = periode.jours;
  }
  return jours;
}
```

4. Faire passer les deux tests de jour par l'historique :

```ts
export function estJourDeRepos(date: Date, repos: JoursRepos): boolean {
  const cle = cleJourUtc(date);
  return joursHebdoAu(repos, cle).includes(date.getUTCDay()) || repos.dates.includes(cle);
}
```

et plus bas :

```ts
export function estJourDeReposLocal(jour: Date, repos: JoursRepos): boolean {
  const cle = cleJourLocal(jour);
  return joursHebdoAu(repos, cle).includes(jour.getDay()) || repos.dates.includes(cle);
}
```

5. Dans `normaliserJoursRepos`, valider l'historique quand il est présent, et en déduire `hebdo` :

```ts
const CLE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function nettoyerJours(brut: unknown): number[] {
  return Array.isArray(brut)
    ? [...new Set(brut.filter((j): j is number => Number.isInteger(j) && j >= 0 && j <= 6))].sort()
    : [];
}

/** Valide et normalise ce qui sort du stockage : toute valeur inattendue
 *  retombe sur « aucun repos » plutôt que de fausser les séries. */
export function normaliserJoursRepos(brut: unknown): JoursRepos {
  if (!brut || typeof brut !== 'object') return AUCUN_REPOS;
  const { hebdo, dates, historique } = brut as Partial<Record<keyof JoursRepos, unknown>>;
  const datesPropres = Array.isArray(dates)
    ? [...new Set(dates.filter((d): d is string => typeof d === 'string' && CLE_JOUR.test(d)))].sort()
    : [];
  const periodes = Array.isArray(historique)
    ? historique
        .filter(
          (p): p is { depuis: string; jours: unknown } =>
            !!p && typeof p === 'object' && typeof (p as PeriodeHebdo).depuis === 'string' && CLE_JOUR.test((p as PeriodeHebdo).depuis)
        )
        .map((p) => ({ depuis: p.depuis, jours: nettoyerJours(p.jours) }))
        .sort((a, b) => (a.depuis < b.depuis ? -1 : a.depuis > b.depuis ? 1 : 0))
    : [];
  if (periodes.length === 0) {
    return { hebdo: nettoyerJours(hebdo), dates: datesPropres };
  }
  return { hebdo: periodes[periodes.length - 1].jours, historique: periodes, dates: datesPropres };
}
```

`DEPUIS_TOUJOURS` vaut `0000-01-01` et passe donc `CLE_JOUR`.

6. `ecrireJoursRepos` n'élague plus, et perd son paramètre `now` :

```ts
export function ecrireJoursRepos(
  repos: JoursRepos,
  stockage: StockageLike | null = stockageParDefaut()
): JoursRepos {
  const propre = normaliserJoursRepos(repos);
  try {
    stockage?.setItem(CLE_JOURS_REPOS, JSON.stringify(propre));
  } catch {
    // Sans persistance, le choix vaut pour la session en cours.
  }
  instantane = propre;
  for (const ecouteur of ecouteurs) ecouteur();
  return propre;
}
```

7. `basculerJourHebdo` date le changement :

```ts
/** Ajoute ou retire un jour de la semaine **à partir d'`aujourdhui`**
 *  (`YYYY-MM-DD`, jour local) : les jours passés gardent le réglage qui
 *  valait alors. Plusieurs bascules le même jour ne laissent qu'une
 *  période pour ce jour. */
export function basculerJourHebdo(repos: JoursRepos, jour: number, aujourdhui: string): JoursRepos {
  const nouveau = repos.hebdo.includes(jour)
    ? repos.hebdo.filter((j) => j !== jour)
    : [...repos.hebdo, jour].sort();
  const passe = repos.historique && repos.historique.length > 0
    ? repos.historique.filter((p) => p.depuis < aujourdhui)
    : repos.hebdo.length > 0
      ? [{ depuis: DEPUIS_TOUJOURS, jours: repos.hebdo }]
      : [];
  return { ...repos, hebdo: nouveau, historique: [...passe, { depuis: aujourdhui, jours: nouveau }] };
}
```

Mettre à jour le commentaire d'en-tête du fichier : il dit que les jours sont comparés en UTC ; ajouter une phrase disant que le réglage hebdomadaire est daté et ne vaut que pour l'avenir.

- [ ] **Step 3: L'appelant**

Dans `src/renderer/src/components/ReglagesJoursRepos.tsx`, ligne 72, passer le jour du changement — `aujourdhui` est déjà calculé en tête du composant :

```tsx
                onClick={() => ecrireJoursRepos(basculerJourHebdo(repos, jour.valeur, aujourdhui))}
```

`ecrireJoursRepos` n'est appelé ailleurs qu'avec un seul argument (`ReglagesJoursRepos.tsx`, `PaletteCommandes.tsx:154`) : rien d'autre à changer. Le vérifier avec `grep -rn "ecrireJoursRepos(" src/renderer/src/`, sans tronquer.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run src/renderer/src/lib/joursRepos.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: **392 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/joursRepos.ts src/renderer/src/lib/joursRepos.test.ts src/renderer/src/components/ReglagesJoursRepos.tsx
git commit -m "fix: date weekly rest-day changes and stop pruning old rest days, so past streaks never change"
```

---

### Task 6 : Une seule série pour les paliers, et pas de palier refêté

**Files:**
- Modify: `src/renderer/src/lib/paliers.ts`
- Modify: `src/renderer/src/lib/paliers.test.ts`
- Modify: `src/renderer/src/screens/Accueil.tsx` (effet du palier, vers les lignes 63-77)
- Modify: `src/renderer/src/hooks/usePracticeEntries.ts` (`useAllPracticeEntriesForUser`, vers la ligne 276)

**Interfaces:**
- Consumes: `useAllPracticeEntriesForUser()` rend `{ entries, loading, error, refresh }` — toutes les séances du compte, comme pour le Bilan. `cleJourUtc(date)` de `lib/joursRepos.ts`.
- Produces:
  - `PaliersFetes` gagne `celebreLe?: string` (`YYYY-MM-DD`, jour UTC de la célébration)
  - `palierAFeter(serie: number, debutSerie: string | null, dejaFetes: PaliersFetes | null, aujourdhui: string)` — **quatrième paramètre ajouté**

**Constat (a).** L'Accueil calcule la série du palier sur les séances des engagements **non archivés**, alors que le Bilan affiche sa « Série en cours » sur **toutes** les séances, tâches cochées comprises. Une tâche cochée est archivée aussitôt : un jour où l'on n'a fait que cocher une tâche compte pour le Bilan et pas pour l'Accueil. Piano les jours 1 à 6, une tâche le jour 7 : le Bilan dit « 7 j », l'Accueil ne voit pas de série, et le palier de 7 jours n'est jamais fêté.

**Constat (b).** `palierAFeter` ne reconnaît une série déjà fêtée que si son premier jour est **exactement** le même. Mettre en pause un skill dont viennent les trois premiers jours déplace ce début : une série de 40 jours déjà fêtée à 30 refête 30, avec sa sonnerie, puis le refête encore à la remise en route. Modifier ou supprimer la séance du premier jour fait pareil.

**La règle.** Deux séries sont la même si l'actuelle a commencé **au plus tard le jour de la dernière célébration** : une vraie interruption ne peut survenir qu'après cette date, donc une série neuve commence forcément après. Les enregistrements antérieurs à ce plan n'ont pas `celebreLe` ; on l'estime alors au jour où leur plus haut palier a été atteint au plus tôt, `debutSerie + palier − 1`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/renderer/src/lib/paliers.test.ts` :

1. Ajouter le quatrième argument `'2026-09-15'` aux appels existants de `palierAFeter`, et `celebreLe: '2026-09-15'` aux deux objets `fetes` attendus :

```ts
  it('celebrates nothing below the first milestone or without a streak', () => {
    expect(palierAFeter(6, '2026-09-01', null, '2026-09-15')).toBeNull();
    expect(palierAFeter(12, null, null, '2026-09-15')).toBeNull();
  });

  it('celebrates the first milestone once reached', () => {
    expect(palierAFeter(7, '2026-09-01', null, '2026-09-15')).toEqual({
      palier: 7,
      fetes: { debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-15' },
    });
  });

  it('does not celebrate the same milestone twice in the same streak', () => {
    expect(palierAFeter(9, '2026-09-01', { debutSerie: '2026-09-01', paliers: [7] }, '2026-09-15')).toBeNull();
  });

  it('celebrates again in a new streak', () => {
    expect(palierAFeter(7, '2026-10-01', { debutSerie: '2026-09-01', paliers: [7] }, '2026-10-07')?.palier).toBe(7);
  });

  it('celebrates only the highest milestone when several are crossed at once', () => {
    expect(palierAFeter(40, '2026-08-01', null, '2026-09-15')).toEqual({
      palier: 30,
      fetes: { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-15' },
    });
  });

  it('celebrates the next milestone later in the same streak', () => {
    expect(palierAFeter(30, '2026-08-01', { debutSerie: '2026-08-01', paliers: [7] }, '2026-08-30')?.palier).toBe(30);
  });
```

2. Ajouter dans le même `describe` :

```ts
  it('does not celebrate again when the same streak’s first day moves', () => {
    // 40 jours fêtés à 30 le 5 septembre. Mettre en pause le skill des
    // trois premiers jours fait commencer la série le 4 août au lieu du 1er.
    const fetes = { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-05' };
    expect(palierAFeter(37, '2026-08-04', fetes, '2026-09-09')).toBeNull();
    // Et la remise en route le ramène au 1er : toujours la même série.
    expect(palierAFeter(40, '2026-08-01', fetes, '2026-09-09')).toBeNull();
  });

  it('celebrates again after a real break that followed the last celebration', () => {
    const fetes = { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-05' };
    expect(palierAFeter(7, '2026-09-10', fetes, '2026-09-16')?.palier).toBe(7);
  });

  it('estimates the celebration day of a record written before celebreLe existed', () => {
    // Fêté à 30 : au plus tôt le 30 août. Un début au 4 août est donc la
    // même série.
    expect(palierAFeter(37, '2026-08-04', { debutSerie: '2026-08-01', paliers: [7, 30] }, '2026-09-09')).toBeNull();
  });
```

3. À la fin du test `reads back what was written and rejects malformed values`, après sa dernière assertion `expect(lirePaliersFetes(stockage)).toBeNull();`, ajouter :

```ts
    // `celebreLe` relit quand il est présent, et une valeur d'un autre type
    // fait rejeter l'enregistrement plutôt que de fausser la règle.
    ecrirePaliersFetes({ debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-07' }, stockage);
    expect(lirePaliersFetes(stockage)).toEqual({ debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-07' });
    stockage.valeurs.set(CLE_PALIERS_FETES, JSON.stringify({ debutSerie: '2026-09-01', paliers: [7], celebreLe: 12 }));
    expect(lirePaliersFetes(stockage)).toBeNull();
```

Ses assertions existantes restent en place : un enregistrement sans `celebreLe` relit toujours à l'identique.

Trois tests nouveaux.

Run: `npx vitest run src/renderer/src/lib/paliers.test.ts`
Expected: FAIL — le décalage du début refête, et `celebreLe` n'est pas produit.

- [ ] **Step 2: `palierAFeter`**

Dans `src/renderer/src/lib/paliers.ts` :

```ts
export interface PaliersFetes {
  // Premier jour de la série concernée (voir currentStreakStart).
  debutSerie: string;
  paliers: number[];
  // Jour UTC (`YYYY-MM-DD`) de la dernière célébration. Absent des
  // enregistrements écrits avant lui : voir finDeLaSerieFetee.
  celebreLe?: string;
}

function ajouterJours(cle: string, n: number): string {
  const d = new Date(`${cle}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dernier jour où la série fêtée était sûrement encore en cours. Sans
 *  `celebreLe`, son plus haut palier a été atteint au plus tôt
 *  `debutSerie + palier − 1`. */
function finDeLaSerieFetee(fetes: PaliersFetes): string {
  if (fetes.celebreLe) return fetes.celebreLe;
  return ajouterJours(fetes.debutSerie, Math.max(1, ...fetes.paliers) - 1);
}

/**
 * Le palier à fêter maintenant, ou null. Si plusieurs sont franchis d'un
 * coup, seul le plus haut est fêté, et tous ceux en dessous sont comptés
 * comme fêtés : pas une salve de trois célébrations à la suite.
 *
 * Deux séries sont la même si l'actuelle a commencé au plus tard le jour de
 * la dernière célébration : une vraie interruption ne peut survenir
 * qu'après, donc une série neuve commence forcément après. Exiger le même
 * premier jour exact refêtait un palier dès que ce jour bougeait — un skill
 * mis en pause, une séance du premier jour modifiée, une date de repos
 * ajoutée.
 */
export function palierAFeter(
  serie: number,
  debutSerie: string | null,
  dejaFetes: PaliersFetes | null,
  aujourdhui: string
): { palier: number; fetes: PaliersFetes } | null {
  if (!debutSerie) return null;
  const deja = dejaFetes && debutSerie <= finDeLaSerieFetee(dejaFetes) ? dejaFetes.paliers : [];
  const atteints = PALIERS.filter((p) => p <= serie);
  const nouveaux = atteints.filter((p) => !deja.includes(p));
  if (nouveaux.length === 0) return null;
  const paliers = [...new Set([...deja, ...atteints])].sort((a, b) => a - b);
  return { palier: Math.max(...nouveaux), fetes: { debutSerie, paliers, celebreLe: aujourdhui } };
}
```

Dans `lirePaliersFetes`, accepter `celebreLe` quand il est une chaîne, rejeter la valeur s'il est présent sous une autre forme, et le rendre :

```ts
    if (
      typeof v?.debutSerie !== 'string' ||
      !Array.isArray(v.paliers) ||
      !v.paliers.every((p) => typeof p === 'number') ||
      (v.celebreLe !== undefined && typeof v.celebreLe !== 'string')
    ) {
      return null;
    }
    return {
      debutSerie: v.debutSerie,
      paliers: v.paliers as number[],
      ...(typeof v.celebreLe === 'string' ? { celebreLe: v.celebreLe } : {}),
    };
```

- [ ] **Step 3: L'Accueil compte la série sur toutes les séances**

Dans `src/renderer/src/screens/Accueil.tsx` :

1. Compléter les imports : `useAllPracticeEntriesForUser` depuis `../hooks/usePracticeEntries`, `cleJourUtc` depuis `../lib/joursRepos`.

2. Remplacer le commentaire et l'effet du palier (vers les lignes 63-77) :

```tsx
  // Série toutes séances confondues — tâches cochées comprises, engagements
  // archivés ou en corbeille compris — : la même base que la « Série en
  // cours » du Bilan. Sur les seuls engagements actifs, un jour où l'on
  // n'avait coché qu'une tâche (archivée aussitôt) ne comptait pas, et le
  // palier de ce jour n'était jamais fêté.
  const { entries: toutesLesSeances, loading: toutesLesSeancesLoading } = useAllPracticeEntriesForUser();
  const [palierAFeterMaintenant, setPalierAFeterMaintenant] = useState<{
    palier: number;
    fetes: PaliersFetes;
  } | null>(null);
  useEffect(() => {
    // Calculé une fois les séances chargées : avant, la liste est vide et
    // aucun palier ne paraîtrait atteint.
    if (toutesLesSeancesLoading) return;
    setPalierAFeterMaintenant(
      palierAFeter(
        calculateStreak(toutesLesSeances, undefined, repos),
        currentStreakStart(toutesLesSeances, undefined, repos),
        lirePaliersFetes(),
        cleJourUtc(new Date())
      )
    );
  }, [toutesLesSeancesLoading, toutesLesSeances, repos]);
```

Ne toucher à rien d'autre dans cet écran : la carte « Séries en cours » compte les **skills** qui ont une série, c'est un autre chiffre.

- [ ] **Step 4: Départager la lecture paginée de toutes les séances**

Dans `src/renderer/src/hooks/usePracticeEntries.ts`, `useAllPracticeEntriesForUser` trie sur `practiced_at` seul, alors que son frère `useAllPracticeEntries` départage par `id`. Une égalité à la frontière de deux pages peut dupliquer ou perdre une ligne, et l'éditeur de séance écrit désormais des horodatages à la minute, ce qui rend les égalités plus probables. Cette lecture devient la base du palier en plus de celle du Bilan :

```ts
      getSupabaseClient()
        .from('practice_entry')
        .select('*')
        // `practiced_at` seul n'est pas unique : `id` départage, pour que
        // chaque ligne apparaisse exactement une fois d'une page à l'autre.
        .order('practiced_at', { ascending: false })
        .order('id')
        .range(from, to)
```

- [ ] **Step 5: Vérifier**

Run: `npx vitest run src/renderer/src/lib/paliers.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: **395 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/paliers.ts src/renderer/src/lib/paliers.test.ts src/renderer/src/screens/Accueil.tsx src/renderer/src/hooks/usePracticeEntries.ts
git commit -m "fix: count milestone streaks on every session and stop re-celebrating when a streak's first day moves"
```

---

### Task 7 : La fenêtre partagée — focus rendu, une seule fenêtre réagit

**Files:**
- Modify: `src/renderer/src/components/Dialogue.tsx`
- Modify: `src/renderer/src/components/PaletteCommandes.tsx` (ligne 245)

**Interfaces:**
- Consumes: rien.
- Produces: rien — la signature de `Dialogue` ne change pas.

**Constat (a).** `avant = document.activeElement` est capturé dans un `useEffect`. À ce moment React a déjà appliqué l'`autoFocus` du champ de la palette (phase de commit) : `avant` est le champ de la palette elle-même, détaché à la fermeture, et le focus tombe sur `BODY`. Mesuré par la revue : un lien focalisé, Ctrl+K, Échap → le focus n'y revient pas. Avant `33c2b9c`, l'`AppShell` capturait l'ouvreur au moment de la touche et le rendait ; ce code a été retiré.

**Constat (b).** Chaque `Dialogue` écoute `keydown` sur `window`. Éditeur de séance ouvert, Ctrl+K ouvre la palette par-dessus, et **un seul Échap ferme les deux** — la date, la durée, les tags ou la note saisis dans l'éditeur sont perdus sans confirmation. Le Tab ne fonctionne bien dans la fenêtre du dessus que par l'ordre d'enregistrement des écouteurs.

**Constat (c).** `px-1.5 py-0.5` sur la touche « Échap » de la palette sort de l'échelle des sept crans.

- [ ] **Step 1: Capturer l'ouvreur au premier rendu, et une pile pour Échap et Tab**

Dans `src/renderer/src/components/Dialogue.tsx` :

1. Importer `useState` : `import { useEffect, useRef, useState, type ReactNode } from 'react';`

2. Au niveau du module, sous `FOCUSABLES` :

```ts
// Fenêtres ouvertes, de la plus ancienne à la plus récente. Seule celle du
// dessus réagit à Échap et à Tab : sans pile, chacune écoutait `window`, et
// un Échap dans la palette ouverte par-dessus l'éditeur fermait les deux —
// en perdant la saisie de l'éditeur.
const pile: symbol[] = [];
```

3. Dans le composant, avant le `useEffect` :

```tsx
  // Capturé pendant le premier rendu, AVANT que React n'applique l'autoFocus
  // d'un enfant (phase de commit). Dans l'effet, c'était déjà le champ de la
  // fenêtre elle-même, détaché à la fermeture : le focus tombait sur la page.
  const [avant] = useState(() => document.activeElement as HTMLElement | null);
  const [jeton] = useState(() => Symbol('dialogue'));
```

4. Dans le `useEffect`, retirer la ligne `const avant = document.activeElement as HTMLElement | null;`, empiler au début, ignorer les touches quand la fenêtre n'est pas au sommet, et dépiler au nettoyage :

```tsx
  useEffect(() => {
    pile.push(jeton);
    const racine = document.getElementById('root');
    // Deux fenêtres peuvent se superposer (Ctrl+K depuis l'éditeur) : on ne
    // relâche `inert` que si c'est cette fenêtre qui l'a posé.
    const posee = racine && !racine.inert;
    if (posee) racine.inert = true;
    function onKeyDown(e: KeyboardEvent) {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === 'Escape' && fermableRef.current) {
```

(le reste de `onKeyDown` et du focus initial est inchangé)

```tsx
    return () => {
      const position = pile.lastIndexOf(jeton);
      if (position >= 0) pile.splice(position, 1);
      cancelAnimationFrame(idFocus);
      window.removeEventListener('keydown', onKeyDown);
      if (posee) racine.inert = false;
      avant?.focus?.();
    };
  }, []);
```

Sous React StrictMode, l'effet monte, se nettoie et remonte : la pile reste juste, puisque chaque nettoyage retire ce que le montage précédent a empilé.

Mettre à jour le commentaire de tête du composant : la fenêtre du dessus est la seule à réagir au clavier.

- [ ] **Step 2: L'espacement de la touche Échap**

Dans `src/renderer/src/components/PaletteCommandes.tsx`, ligne 245, remplacer `px-1.5 py-0.5` par `px-2 py-1` :

```tsx
        <kbd className="border border-ink-700 px-2 py-1 font-data text-libelle text-muted">Échap</kbd>
```

- [ ] **Step 3: Vérifier**

Run: `npx vitest run` — Expected: **395 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Dialogue.tsx src/renderer/src/components/PaletteCommandes.tsx
git commit -m "fix: return focus to the opener and let only the top dialog handle Escape and Tab"
```

---

### Task 8 : Vérification finale

**Files:** aucun, sauf correctifs issus des constats.

- [ ] **Step 1: Énumérer les classes introduites par le diff**

Run: `git diff master --unified=0 -- "src/renderer/src/**/*.tsx" | grep "^+" | grep -oE "\b(text|gap|p|px|py|m|mx|my|mt|mb|ml|mr)-[a-z0-9./]+" | sort -u`

Vérifier que l'ensemble est inclus dans les six rôles et les sept crans. Lister ce qui existe, puis contrôler l'inclusion.

- [ ] **Step 2: Suite complète et typage**

Run: `npx vitest run --dir src/renderer` — Expected: **395 tests, 30 fichiers.**
Run: `npm run typecheck` — Expected: propre.
Run: `npx electron-vite build` — Expected: réussi.

- [ ] **Step 3: Merge local dans master, puis vérification live**

`preview_start` sert le dépôt racine, jamais le worktree. Ouvrir **son propre onglet** (`tabs_create`) : une revue lancée en parallèle peut emmener l'onglet partagé ailleurs.

1. **Séance de chantier** — « Nouvelle entrée » depuis un projet, enregistrer : on revient sur le **projet**, pas sur « Introuvable ». Supprimer la séance ensuite.
2. **Sous-projet** — ranger un projet sous deux parents, le retirer de l'un, supprimer l'autre : il ne part **pas** en corbeille. Restaurer le parent supprimé et défaire le rattachement ensuite.
3. **Jours de repos** — avec une série vivante grâce à un dimanche en repos, décocher « Dim » : la série ne bouge pas. Remettre le réglage tel qu'il était.
4. **Palette** — focaliser un lien du rail au clavier, Ctrl+K, Échap : le focus revient au lien.
5. **Palette sur l'éditeur** — ouvrir l'éditeur d'une séance, Ctrl+K, Échap : seule la palette se ferme.

Les corrections du Pomodoro (fermeture pendant un Arrêter) et du tray (réglages non chargés) ne se reproduisent pas sans tuer l'app au bon moment ou couper le réseau au lancement : les dire non vérifiées en live, vérifiées par la revue.

Nettoyer toute donnée de test créée au passage.

- [ ] **Step 4: Push, seulement si tout est passé**

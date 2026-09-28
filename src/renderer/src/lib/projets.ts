// Les règles qui décident de quoi un projet est composé. Elles vivent ici,
// en fonctions pures, parce que le dépôt n'a aucun socle de test de
// composants : c'est le seul endroit où cette logique peut être vérifiée.
//
// Le paramètre `liaisons` porte trois états, et les distinguer EST le
// chantier :
//   `null`   la liaison est indisponible — table absente, ou lecture en échec
//   `[]`     la table existe et ne contient rien
//   peuplé   la table existe et fait autorité
//
// Confondre les deux premiers produirait l'un de deux défauts opposés :
// une liaison indisponible lue comme vide ferait disparaître tous les
// rattachements, une liaison vide lue comme indisponible ressusciterait
// ceux que l'utilisateur vient de retirer. C'est pour rendre cette confusion
// impossible par accident que le type est `LiaisonProjet[] | null` plutôt
// qu'un tableau et un drapeau séparés.

import type { Engagement, LiaisonProjet } from './types';

/**
 * Les engagements composant un projet.
 *
 * La précédence est TOTALE, jamais une fusion : dès que les liaisons sont
 * disponibles, `project_id` est ignoré même s'il les contredit — ce qui
 * arrivera pour tout engagement modifié par une version antérieure de
 * l'application, qui écrit encore la colonne.
 */
export function membresDuProjet(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  projetId: string
): Engagement[] {
  if (liaisons === null) {
    return engagements.filter((e) => e.projectId === projetId);
  }
  const ids = new Set(
    liaisons.filter((l) => l.projectId === projetId).map((l) => l.engagementId)
  );
  return engagements.filter((e) => ids.has(e.id));
}

/**
 * Tous les engagements d'un projet, sous-projets compris : ses membres, les
 * membres de ses sous-projets, et ainsi de suite. C'est la règle de
 * remontée — le temps passé sur « la toiture » est du temps passé sur « la
 * maison ».
 *
 * Chaque engagement n'apparaît qu'une fois, même rattaché à deux niveaux :
 * un skill membre de la maison ET de la toiture ne compte pas double. Le
 * projet lui-même n'est jamais renvoyé.
 *
 * La traversée tient un ensemble de visités, amorcé avec le projet : la
 * contrainte `check (engagement_id <> project_id)` n'interdit que le cycle
 * trivial, et une maison dans une toiture dans une maison bouclerait sans
 * lui. L'interface refuse de créer un cycle (`sousProjetsRattachables`),
 * mais cette fonction ne doit pas dépendre d'une garantie posée ailleurs.
 */
export function membresRecursifs(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  projetId: string
): Engagement[] {
  const visites = new Set([projetId]);
  const resultat: Engagement[] = [];
  const aParcourir = [projetId];
  while (aParcourir.length > 0) {
    const courant = aParcourir.shift() as string;
    for (const membre of membresDuProjet(engagements, liaisons, courant)) {
      if (visites.has(membre.id)) continue;
      visites.add(membre.id);
      resultat.push(membre);
      if (membre.isProject) aParcourir.push(membre.id);
    }
  }
  return resultat;
}

/**
 * Les projets qu'on peut rattacher comme sous-projets de `projetId` : actifs,
 * ni lui-même, ni déjà membres directs, et surtout aucun qui contient déjà
 * `projetId`, même indirectement — le rattacher fermerait un cycle.
 */
export function sousProjetsRattachables(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  projetId: string
): Engagement[] {
  const directs = new Set(membresDuProjet(engagements, liaisons, projetId).map((m) => m.id));
  return engagements.filter(
    (e) =>
      e.isProject &&
      !e.archivedAt &&
      e.id !== projetId &&
      !directs.has(e.id) &&
      !membresRecursifs(engagements, liaisons, e.id).some((m) => m.id === projetId)
  );
}

/**
 * Les projets auxquels un engagement appartient — le sens qui n'existait
 * pas avec une colonne unique, et la raison d'être de ce chantier.
 *
 * Le résultat est filtré sur `isProject` : une liaison pointant un
 * engagement qui n'est pas un projet ne devrait pas exister, mais rien au
 * niveau du schéma ne l'interdit, et une telle ligne ne doit pas se
 * retrouver présentée comme un projet.
 */
export function projetsDeLEngagement(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  engagementId: string
): Engagement[] {
  const projets = engagements.filter((e) => e.isProject);
  if (liaisons === null) {
    const engagement = engagements.find((e) => e.id === engagementId);
    if (!engagement?.projectId) return [];
    return projets.filter((p) => p.id === engagement.projectId);
  }
  const ids = new Set(
    liaisons.filter((l) => l.engagementId === engagementId).map((l) => l.projectId)
  );
  return projets.filter((p) => ids.has(p.id));
}

/**
 * Le projet à recopier dans `project_id` pour que l'application installée
 * reste cohérente — voir la spec, §5. Écriture de compatibilité, à retirer
 * le jour où la colonne disparaît.
 *
 * Le tri est explicite parce qu'un tri implicite ferait dépendre la valeur
 * de l'ordre de retour de PostgREST : un défaut impossible à reproduire.
 *
 * Le paramètre n'est pas nullable : on n'appelle cette fonction qu'en
 * écrivant, donc quand la liaison est forcément disponible.
 */
export function projetPrincipal(liaisons: LiaisonProjet[], engagementId: string): string | null {
  const siennes = liaisons.filter((l) => l.engagementId === engagementId);
  if (siennes.length === 0) return null;
  // Copie défensive : `sort` mute en place.
  const triees = [...siennes].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
  );
  return triees[0].projectId;
}

/**
 * Le projet à AFFICHER comme sélectionné pour un engagement.
 *
 * Distinct de `projetPrincipal`, qui sert à écrire et exige donc une liaison
 * disponible. Ici on lit : quand la liaison est indisponible, on retombe sur
 * `project_id` comme partout ailleurs en lecture, au lieu de prétendre qu'il
 * n'y a aucun projet.
 */
export function projetAffiche(
  engagements: Engagement[],
  liaisons: LiaisonProjet[] | null,
  engagementId: string
): string | null {
  if (liaisons === null) {
    return engagements.find((e) => e.id === engagementId)?.projectId ?? null;
  }
  return projetPrincipal(liaisons, engagementId);
}

/**
 * Les entrées de pratique d'un projet : celles de ses membres, plus les
 * siennes propres. Pour faire remonter les sous-projets, l'appelant passe
 * `membresRecursifs` et non les seuls membres directs.
 *
 * Un projet EST un engagement et peut donc porter des entrées directement —
 * c'est ce que fait la « session de chantier » (Pomodoro ou nouvelle entrée
 * sur le projet). Ne compter que les membres
 * rendrait ce temps-là invisible dans le total de son propre projet. La règle
 * vit ici et non chez l'appelant, précisément pour qu'un test puisse la
 * contredire.
 *
 * Générique sur le type d'entrée : l'appelant récupère le type concret qu'il
 * a fourni, et les fonctions qui consomment le résultat — `formatMinutes`,
 * `daysSinceLastPractice`, `computeGoalProgress` — n'exigent chacune qu'une
 * poignée de champs.
 */
export function entreesDuProjet<T>(
  entreesParEngagement: Record<string, T[]>,
  membres: Engagement[],
  projetId: string
): T[] {
  // Un `Set` plutôt qu'un tableau : si le projet figurait parmi ses propres
  // membres, ses entrées compteraient double. La contrainte
  // `check (engagement_id <> project_id)` de la 0016 l'interdit en base, mais
  // cette fonction ne doit pas dépendre d'une garantie posée ailleurs.
  const ids = new Set(membres.map((m) => m.id));
  ids.add(projetId);
  return [...ids].flatMap((id) => entreesParEngagement[id] ?? []);
}

/**
 * Le total en minutes d'un ensemble d'entrées.
 *
 * Trivial, et nommé pour ça : noyé dans un `reduce` d'écran il serait
 * invérifiable, alors qu'il porte la seule unité de toute la tranche.
 */
export function tempsCumuleMinutes(entrees: { durationMinutes: number }[]): number {
  return entrees.reduce((total, e) => total + e.durationMinutes, 0);
}

/**
 * La dernière activité d'un chantier, en toutes lettres.
 *
 * L'application rend ailleurs les jours bruts — « pas pratiqué depuis 3
 * jours » dans les notifications de l'Accueil — ce qui convient à un skill
 * quotidien, dont les écarts se comptent en jours. Un chantier est l'inverse :
 * ses écarts se comptent en semaines, et « il y a 47 jours » se lit moins bien
 * que « il y a 7 semaines ».
 *
 * `null` veut dire « aucune entrée » et non « zéro jour » : c'est ce que rend
 * `daysSinceLastPractice` sur une liste vide, et les confondre dirait d'un
 * chantier jamais commencé qu'on y a touché aujourd'hui.
 *
 * Les mois sont ARRONDIS et non tronqués. Avec une troncature, 56 jours
 * donneraient « 1 mois » juste après « 7 semaines » : une valeur qui se lit
 * comme plus petite que la précédente alors que le temps a avancé.
 */
export function formatDormance(jours: number | null): string {
  if (jours === null) return 'Aucune activité';
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  if (jours < 14) return `Il y a ${jours} jours`;
  if (jours < 56) return `Il y a ${Math.floor(jours / 7)} semaines`;
  return `Il y a ${Math.round(jours / 30)} mois`;
}

/**
 * La part franchie des jalons d'un projet.
 *
 * Ce sont les jalons du projet LUI-MÊME, jamais ceux de ses skills
 * membres. Les deux ne parlent pas de la même chose : les jalons d'un
 * chantier sont ses livrables (« fondations », « murs »), ceux d'un skill
 * sont des étapes d'apprentissage (« maîtriser l'assemblage à queue
 * d'aronde »). Les additionner donnerait un pourcentage vide de sens, où
 * cocher une étape de menuiserie ferait « avancer la maison ».
 *
 * C'est une asymétrie assumée avec `tempsCumuleMinutes`, qui lui agrège
 * les membres : le temps passé sur la menuiserie EST du temps passé sur la
 * maison, alors qu'une étape d'apprentissage n'est PAS un livrable. Écrit
 * ici pour qu'une relecture ne « corrige » pas l'asymétrie en croyant
 * réparer un oubli.
 *
 * `total: 0` est le signal rendu à l'appelant : c'est à lui de n'afficher
 * ni barre ni libellé plutôt qu'un « 0 sur 0 », qui dirait à tort qu'un
 * chantier sans jalon n'a pas avancé.
 */
export function avancementProjet(jalons: { completedAt: string | null }[]): {
  franchis: number;
  total: number;
  ratio: number;
} {
  const total = jalons.length;
  const franchis = jalons.filter((j) => j.completedAt !== null).length;
  return { franchis, total, ratio: total === 0 ? 0 : franchis / total };
}

/** Le critère de tri de la liste des projets. Chacun a un sens unique. */
export type CritereTri = 'dormance' | 'temps' | 'avancement' | 'nom';

/**
 * Une ligne de la liste des projets, réduite à ce sur quoi on trie.
 *
 * Le tri reçoit des valeurs DÉJÀ dérivées, jamais des engagements : c'est
 * ce qui le rend vérifiable sans réseau. `avancement` vaut `null` quand le
 * projet n'a aucun jalon — la traduction depuis `avancementProjet` se fait
 * chez l'appelant, avec `total === 0 ? null : ratio`.
 */
export interface LigneProjet {
  id: string;
  nom: string;
  minutes: number;
  jours: number | null;
  avancement: number | null;
}

export function trierProjets(lignes: LigneProjet[], critere: CritereTri): LigneProjet[] {
  // Les valeurs absentes descendent, quel que soit le critère. Un chantier
  // jamais commencé n'est pas le plus négligé, et le mettre en tête
  // enterrerait sous lui celui qui l'est vraiment — le signal que ce tri
  // existe pour montrer.
  const absentEnBas = (
    a: number | null,
    b: number | null,
    comparer: (x: number, y: number) => number
  ): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return comparer(a, b);
  };
  const decroissant = (x: number, y: number) => y - x;
  const croissant = (x: number, y: number) => x - y;

  // `sort` mute son receveur : on copie, parce que l'appelant passe le
  // résultat d'un `useMemo` dont React réutilise l'identité.
  return [...lignes].sort((a, b) => {
    switch (critere) {
      case 'dormance':
        return absentEnBas(a.jours, b.jours, decroissant);
      case 'temps':
        // `minutes` n'est jamais nul : zéro minute est une valeur, pas une
        // absence, et l'ordre décroissant la range déjà en bas.
        return decroissant(a.minutes, b.minutes);
      case 'avancement':
        return absentEnBas(a.avancement, b.avancement, croissant);
      case 'nom':
        // En français : sans la locale, « Élagage » passerait après
        // « Zinguerie », son point de code étant plus haut.
        return a.nom.localeCompare(b.nom, 'fr');
    }
  });
}

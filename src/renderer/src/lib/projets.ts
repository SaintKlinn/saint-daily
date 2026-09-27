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
 * Les entrées de pratique d\'un projet : celles de ses membres, plus les
 * siennes propres.
 *
 * Un projet EST un engagement et peut donc porter des entrées directement —
 * c\'est ce que fera la « session de chantier ». Ne compter que les membres
 * rendrait ce temps-là invisible dans le total de son propre projet. La règle
 * vit ici et non chez l\'appelant, précisément pour qu\'un test puisse la
 * contredire.
 *
 * Générique sur le type d\'entrée : l\'appelant récupère le type concret qu\'il
 * a fourni, et les fonctions qui consomment le résultat — `formatMinutes`,
 * `daysSinceLastPractice`, `computeGoalProgress` — n\'exigent chacune qu\'une
 * poignée de champs.
 */
export function entreesDuProjet<T>(
  entreesParEngagement: Record<string, T[]>,
  membres: Engagement[],
  projetId: string
): T[] {
  // Un `Set` plutôt qu\'un tableau : si le projet figurait parmi ses propres
  // membres, ses entrées compteraient double. La contrainte
  // `check (engagement_id <> project_id)` de la 0016 l\'interdit en base, mais
  // cette fonction ne doit pas dépendre d\'une garantie posée ailleurs.
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
 * La dernière activité d\'un chantier, en toutes lettres.
 *
 * L\'application rend ailleurs les jours bruts — « pas pratiqué depuis 3
 * jours » dans les notifications de l\'Accueil — ce qui convient à un skill
 * quotidien, dont les écarts se comptent en jours. Un chantier est l\'inverse :
 * ses écarts se comptent en semaines, et « il y a 47 jours » se lit moins bien
 * que « il y a 7 semaines ».
 *
 * `null` veut dire « aucune entrée » et non « zéro jour » : c\'est ce que rend
 * `daysSinceLastPractice` sur une liste vide, et les confondre dirait d\'un
 * chantier jamais commencé qu\'on y a touché aujourd\'hui.
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

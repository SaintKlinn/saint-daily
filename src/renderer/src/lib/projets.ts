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

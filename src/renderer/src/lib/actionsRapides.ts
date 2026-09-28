// Skills proposés dans le menu du tray (voir hooks/useActionsRapidesTray.ts
// et src/main/tray.ts).

export const NB_SKILLS_RAPIDES = 5;

/**
 * Les skills pratiqués le plus récemment d'abord, complétés par ordre
 * alphabétique pour qu'un compte récent ait tout de même des raccourcis.
 * `idsRecents` suit l'ordre des séances, de la plus récente à la plus
 * ancienne, doublons compris.
 */
export function choisirSkillsRapides(
  skills: { id: string; name: string }[],
  idsRecents: string[],
  nombre = NB_SKILLS_RAPIDES
): { id: string; name: string }[] {
  const parId = new Map(skills.map((s) => [s.id, s]));
  const choisis: { id: string; name: string }[] = [];
  for (const id of new Set(idsRecents)) {
    const skill = parId.get(id);
    if (skill) choisis.push({ id: skill.id, name: skill.name });
    if (choisis.length === nombre) return choisis;
  }
  const restants = skills
    .filter((s) => !choisis.some((c) => c.id === s.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  for (const skill of restants) {
    if (choisis.length === nombre) break;
    choisis.push({ id: skill.id, name: skill.name });
  }
  return choisis;
}

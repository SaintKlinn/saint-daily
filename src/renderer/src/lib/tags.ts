/**
 * La saisie de tags, séparée par des virgules, en liste de tags.
 *
 * Découpe, taille les blancs, jette les vides, et dédoublonne SANS tenir
 * compte de la casse, en gardant la première orthographe rencontrée.
 *
 * Le dédoublonnage est la raison d'être de cette fonction. Les quatre
 * écrans de création qui l'appellent sont remplis une fois, et y saisir
 * deux fois le même tag est sans lendemain ; un champ qu'on rouvre et
 * réenregistre est l'inverse, et c'est exactement là que les doublons
 * s'accumulent.
 *
 * La casse est ignorée parce que le reste de l'application l'ignore déjà :
 * `filterByTag` (`lib/streaks.ts`) compare en minuscules, donc « Maison »
 * et « maison » sélectionnent les mêmes éléments. Mais la liste de tags de
 * l'écran Skills les compte séparément, donc les laisser coexister
 * fabriquerait deux filtres distincts menant au même résultat.
 */
export function analyserTags(saisie: string): string[] {
  const vus = new Set<string>();
  const tags: string[] = [];
  for (const brut of saisie.split(',')) {
    const tag = brut.trim();
    if (!tag) continue;
    const cle = tag.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    tags.push(tag);
  }
  return tags;
}

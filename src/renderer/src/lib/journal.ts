export interface JournalEntry {
  id: string;
  engagementName: string;
  note: string | null;
  tags: string[];
  practicedAt: string;
}

// Insensible aux accents en plus de la casse : app entièrement en
// français, où « seance » doit retrouver « Séance » et « débutant » doit
// retrouver « debutant ». `NFD` décompose chaque caractère accentué en
// lettre de base + diacritique combinant, que la classe `̀-ͯ`
// retire ensuite.
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Filtre client : le volume d'une app personnelle ne justifie pas une
 * recherche plein texte Postgres, et tout est déjà en mémoire pour le
 * Bilan. La recherche porte sur la note, les tags de la séance **et** le
 * nom de l'engagement — chercher « guitare » sans retrouver ses séances de
 * guitare serait déroutant.
 */
export function filterJournalEntries<T extends JournalEntry>(entries: T[], search: string): T[] {
  const needle = normalize(search.trim());
  if (!needle) return entries;
  return entries.filter((entry) => {
    if (normalize(entry.engagementName).includes(needle)) return true;
    if (entry.note && normalize(entry.note).includes(needle)) return true;
    return entry.tags.some((tag) => normalize(tag).includes(needle));
  });
}

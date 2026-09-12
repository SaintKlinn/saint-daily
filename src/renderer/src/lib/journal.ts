export interface JournalEntry {
  id: string;
  engagementName: string;
  note: string | null;
  tags: string[];
  practicedAt: string;
}

/**
 * Filtre client : le volume d'une app personnelle ne justifie pas une
 * recherche plein texte Postgres, et tout est déjà en mémoire pour le
 * Bilan. La recherche porte sur la note, les tags de la séance **et** le
 * nom de l'engagement — chercher « guitare » sans retrouver ses séances de
 * guitare serait déroutant.
 */
export function filterJournalEntries<T extends JournalEntry>(entries: T[], search: string): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    if (entry.engagementName.toLowerCase().includes(needle)) return true;
    if (entry.note && entry.note.toLowerCase().includes(needle)) return true;
    return entry.tags.some((tag) => tag.toLowerCase().includes(needle));
  });
}

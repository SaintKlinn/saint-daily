import { toLocalDayKey } from './retrospective';
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
// lettre de base + diacritique combinant, que la plage U+0300-U+036F
// retire ensuite. Cette plage est écrite en séquences d'échappement et
// non en caractères bruts : des marques combinantes littérales dans le
// source sont invisibles à la relecture et introuvables au grep.
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export interface GroupeJour<T> {
  cle: string; // YYYY-MM-DD, jour local
  date: Date;
  lignes: T[];
}

/**
 * Regroupe des lignes déjà triées (de la plus récente à la plus ancienne)
 * par jour local, en conservant leur ordre. Un long historique se lit par
 * journées plutôt que comme une seule liste où chaque ligne répète sa date.
 */
export function grouperParJour<T>(lignes: T[], dateDe: (ligne: T) => Date): GroupeJour<T>[] {
  const groupes: GroupeJour<T>[] = [];
  for (const ligne of lignes) {
    const date = dateDe(ligne);
    const cle = toLocalDayKey(date);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.cle === cle) dernier.lignes.push(ligne);
    else groupes.push({ cle, date, lignes: [ligne] });
  }
  return groupes;
}

/** « Aujourd'hui », « Hier », sinon « lundi 22 septembre » — l'année
 *  n'apparaît que si elle diffère de l'année en cours. */
export function libelleJour(date: Date, now: Date = new Date()): string {
  const cle = toLocalDayKey(date);
  if (cle === toLocalDayKey(now)) return "Aujourd'hui";
  const hier = new Date(now);
  hier.setDate(hier.getDate() - 1);
  if (cle === toLocalDayKey(hier)) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

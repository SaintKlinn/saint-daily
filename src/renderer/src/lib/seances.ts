import type { Mood } from './types';

// Libellés des humeurs, dans l'ordre du sélecteur. Source unique : ils
// étaient recopiés à l'identique dans DetailSkill et l'export, et l'éditeur
// de séance en aurait fait une troisième copie.
export const HUMEURS: Mood[] = ['difficile', 'moyen', 'correct', 'bien', 'excellent'];

export const MOOD_LABELS: Record<Mood, string> = {
  difficile: 'Difficile',
  moyen: 'Moyen',
  correct: 'Correct',
  bien: 'Bien',
  excellent: 'Excellent',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Valeur d'un champ `datetime-local` (heure locale, sans fuseau) pour un
 *  instant ISO : `2026-09-28T18:05`. */
export function versChampDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Instant ISO pour la valeur d'un champ `datetime-local`, lue en heure
 *  locale ; null si la valeur est vide ou invalide. */
export function depuisChampDateHeure(valeur: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur);
  if (!m) return null;
  const [, a, mo, j, h, mi] = m.map(Number);
  const d = new Date(a, mo - 1, j, h, mi);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface SaisieSeance {
  duree: string;
  dateHeure: string;
}

/** Message d'erreur à afficher, ou null si la saisie est valide. Une
 *  séance datée dans le futur est refusée : elle fausserait séries,
 *  rappels et Bilan, qui raisonnent tous sur ce qui a déjà eu lieu. */
export function erreurSaisieSeance({ duree, dateHeure }: SaisieSeance, now: Date = new Date()): string | null {
  const minutes = Number(duree);
  // `Number('')` vaut 0 : sans ce test, un champ vidé passait pour une
  // séance de zéro minute.
  if (duree.trim() === '' || !Number.isInteger(minutes) || minutes < 0) return 'La durée doit être un nombre entier de minutes.';
  if (minutes > 24 * 60) return 'Une séance ne peut pas dépasser 24 heures.';
  const iso = depuisChampDateHeure(dateHeure);
  if (!iso) return 'La date et l’heure sont invalides.';
  if (new Date(iso).getTime() > now.getTime() + 60_000) return 'Une séance ne peut pas être datée dans le futur.';
  return null;
}

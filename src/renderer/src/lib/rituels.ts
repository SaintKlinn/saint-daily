import { startOfWeek } from './calendarLayout';

/**
 * Décide si le bandeau de revue hebdomadaire doit s'afficher.
 *
 * Le repère est le début de la semaine en cours, pas un délai de sept
 * jours glissants : la revue porte sur une semaine calendaire, elle doit
 * donc revenir le lundi et pas au septième jour après le dernier rejet.
 *
 * En cas de date illisible, on montre le bandeau — le rejeter à nouveau
 * réécrira une date valide, alors que le masquer laisserait la revue
 * définitivement invisible.
 */
export function shouldShowWeeklyReview(dismissedAt: string | null, now: Date = new Date()): boolean {
  if (!dismissedAt) return true;
  const dismissed = new Date(dismissedAt);
  if (!Number.isFinite(dismissed.getTime())) return true;
  return dismissed.getTime() < startOfWeek(now).getTime();
}

/**
 * Bornes horaires des deux rituels, en heure **locale** : ils suivent la
 * journée vécue par l'utilisateur, pas UTC. « Voici ta journée » passé
 * midi arriverait trop tard pour servir, et un bilan du soir demandé à
 * 14h n'aurait rien à résumer.
 */
export const MORNING_END_HOUR = 12;
export const EVENING_START_HOUR = 18;

/** Clé de jour local au format AAAA-MM-JJ, celui de la colonne `date`. */
export function toLocalDateKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function shouldShowMorningGreeting(dismissedDate: string | null, now: Date = new Date()): boolean {
  if (now.getHours() >= MORNING_END_HOUR) return false;
  return dismissedDate !== toLocalDateKey(now);
}

export function shouldShowEveningPrompt(hasReflectionToday: boolean, now: Date = new Date()): boolean {
  if (now.getHours() < EVENING_START_HOUR) return false;
  return !hasReflectionToday;
}

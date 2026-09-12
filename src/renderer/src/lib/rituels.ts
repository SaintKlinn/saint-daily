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

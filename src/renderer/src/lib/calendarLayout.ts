export function startOfWeek(reference: Date): Date {
  const day = reference.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Comparaison par composants de date locale plutôt que par arithmétique de
// millisecondes : un jour peut faire 23h ou 25h lors d'un changement
// d'heure, ce qui fausserait un simple `diffMs / DAY_MS`.
export function dayIndexInWeek(weekStart: Date, dateIso: string): number | null {
  const date = new Date(dateIso);
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    if (date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate()) {
      return i;
    }
  }
  return null;
}

export interface BlockPosition {
  topPercent: number;
  heightPercent: number;
}

const MINUTES_PER_DAY = 24 * 60;
// En dessous de 15 min affichées, le bloc devient illisible (juste un trait)
// — on préfère un bloc un peu trop grand à un bloc invisible.
const MIN_HEIGHT_PERCENT = (15 / MINUTES_PER_DAY) * 100;

export function blockPositionFromDuration(startIso: string, durationMinutes: number): BlockPosition {
  const start = new Date(startIso);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const topPercent = (startMinutes / MINUTES_PER_DAY) * 100;
  const heightPercent = Math.max((Math.max(0, durationMinutes) / MINUTES_PER_DAY) * 100, MIN_HEIGHT_PERCENT);
  return { topPercent, heightPercent };
}

export function blockPositionFromRange(startIso: string, endIso: string): BlockPosition {
  const durationMinutes = Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  return blockPositionFromDuration(startIso, durationMinutes);
}

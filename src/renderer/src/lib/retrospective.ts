import { addDays, startOfDay, startOfWeek } from './calendarLayout';

export interface PracticeEntryLike {
  engagementId: string;
  durationMinutes: number;
  practicedAt: string; // ISO 8601
}

export interface EngagementLike {
  id: string;
  name: string;
  tags: string[];
}

/**
 * Clé de jour en heure LOCALE. Tout ce module raisonne sur le rythme
 * quotidien vécu par l'utilisateur : une séance de 23h le 10 doit tomber
 * le 10, pas le 11 comme le ferait une clé UTC pour un fuseau à l'est.
 * (`streaks.ts` fait le choix inverse, en UTC, pour rester déterministe
 * quelle que soit la machine — les deux cohabitent volontairement.)
 */
export function toLocalDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function countEntriesByDay(entries: PracticeEntryLike[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const key = toLocalDayKey(new Date(entry.practicedAt));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type HeatmapLevel = 0 | 1 | 2 | 3;

export function heatmapLevel(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

export interface HeatmapCell {
  dayKey: string;
  date: Date;
  count: number;
  level: HeatmapLevel;
  isFuture: boolean;
}

export const HEATMAP_WEEKS = 53;

/**
 * Grille de 53 colonnes (semaines) × 7 lignes (jours, lundi en haut), se
 * terminant sur la semaine de `now`. La dernière colonne contient les
 * jours à venir de la semaine en cours : ils sont marqués `isFuture` pour
 * que la grille reste rectangulaire sans faire croire à une absence de
 * pratique.
 */
export function buildHeatmapGrid(counts: Record<string, number>, now: Date = new Date()): HeatmapCell[][] {
  const currentWeekStart = startOfWeek(now);
  const firstWeekStart = addDays(currentWeekStart, -7 * (HEATMAP_WEEKS - 1));
  const today = startOfDay(now);
  const columns: HeatmapCell[][] = [];
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const column: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      const date = addDays(firstWeekStart, week * 7 + day);
      const dayKey = toLocalDayKey(date);
      const count = counts[dayKey] ?? 0;
      column.push({
        dayKey,
        date,
        count,
        level: heatmapLevel(count),
        isFuture: startOfDay(date).getTime() > today.getTime(),
      });
    }
    columns.push(column);
  }
  return columns;
}

export interface WeekTotals {
  minutes: number;
  sessions: number;
}

export interface WeekComparison {
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
}

export function compareWeeks(entries: PracticeEntryLike[], now: Date = new Date()): WeekComparison {
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisWeek: WeekTotals = { minutes: 0, sessions: 0 };
  const lastWeek: WeekTotals = { minutes: 0, sessions: 0 };
  for (const entry of entries) {
    const at = new Date(entry.practicedAt);
    // Une entrée datée après la semaine en cours (saisie manuelle d'une
    // date future) n'appartient à aucune des deux colonnes affichées.
    if (at >= thisWeekStart && at < thisWeekEnd) {
      thisWeek.minutes += entry.durationMinutes;
      thisWeek.sessions += 1;
    } else if (at >= lastWeekStart && at < thisWeekStart) {
      lastWeek.minutes += entry.durationMinutes;
      lastWeek.sessions += 1;
    }
  }
  return { thisWeek, lastWeek };
}

export interface BreakdownRow {
  key: string;
  label: string;
  minutes: number;
  sessions: number;
}

// À égalité de minutes, l'ordre alphabétique garantit un rendu stable d'un
// affichage à l'autre plutôt qu'un ordre dépendant de l'insertion.
function byMinutesDesc(a: BreakdownRow, b: BreakdownRow): number {
  if (a.minutes !== b.minutes) return b.minutes - a.minutes;
  return a.label.localeCompare(b.label);
}

/**
 * Une entrée dont l'engagement porte plusieurs tags compte INTÉGRALEMENT
 * pour chacun : c'est une classification multiple, pas une partition. Le
 * total des lignes peut donc dépasser le temps réellement pratiqué, comme
 * `filterByTag` qui correspond déjà sur "au moins un tag".
 */
export function tagBreakdown(
  entries: PracticeEntryLike[],
  engagementsById: Record<string, EngagementLike>
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const entry of entries) {
    const engagement = engagementsById[entry.engagementId];
    if (!engagement) continue;
    for (const tag of engagement.tags) {
      const row = rows.get(tag) ?? { key: tag, label: tag, minutes: 0, sessions: 0 };
      row.minutes += entry.durationMinutes;
      row.sessions += 1;
      rows.set(tag, row);
    }
  }
  return [...rows.values()].sort(byMinutesDesc);
}

export function engagementBreakdown(
  entries: PracticeEntryLike[],
  engagementsById: Record<string, EngagementLike>
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const entry of entries) {
    const engagement = engagementsById[entry.engagementId];
    if (!engagement) continue;
    const row = rows.get(engagement.id) ?? { key: engagement.id, label: engagement.name, minutes: 0, sessions: 0 };
    row.minutes += entry.durationMinutes;
    row.sessions += 1;
    rows.set(engagement.id, row);
  }
  return [...rows.values()].sort(byMinutesDesc);
}

export type TimeOfDayKey = 'nuit' | 'matin' | 'apresMidi' | 'soir';

export interface TimeOfDayBucket {
  key: TimeOfDayKey;
  label: string;
  startHour: number;
  endHour: number;
  sessions: number;
  averageMinutes: number;
}

const BUCKET_DEFINITIONS: { key: TimeOfDayKey; label: string; startHour: number; endHour: number }[] = [
  { key: 'nuit', label: 'Nuit', startHour: 0, endHour: 6 },
  { key: 'matin', label: 'Matin', startHour: 6, endHour: 12 },
  { key: 'apresMidi', label: 'Après-midi', startHour: 12, endHour: 18 },
  { key: 'soir', label: 'Soir', startHour: 18, endHour: 24 },
];

export function timeOfDayBuckets(entries: PracticeEntryLike[]): TimeOfDayBucket[] {
  const totals = new Map<TimeOfDayKey, { sessions: number; minutes: number }>();
  for (const definition of BUCKET_DEFINITIONS) totals.set(definition.key, { sessions: 0, minutes: 0 });
  for (const entry of entries) {
    const hour = new Date(entry.practicedAt).getHours();
    const definition = BUCKET_DEFINITIONS.find((d) => hour >= d.startHour && hour < d.endHour);
    if (!definition) continue;
    const total = totals.get(definition.key)!;
    total.sessions += 1;
    total.minutes += entry.durationMinutes;
  }
  return BUCKET_DEFINITIONS.map((definition) => {
    const total = totals.get(definition.key)!;
    return {
      ...definition,
      sessions: total.sessions,
      averageMinutes: total.sessions === 0 ? 0 : Math.round(total.minutes / total.sessions),
    };
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

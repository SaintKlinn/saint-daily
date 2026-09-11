import { addDays } from './calendarLayout';
import type { Priority, RecurrenceType } from './types';

export const RECURRENCE_WINDOW_DAYS = 56;

export interface RecurrenceRule {
  type: RecurrenceType;
  interval: number | null;
  weekdays: number[] | null;
}

// "tous les N jours" doit repartir de la dernière occurrence + N jours pour
// garder la cadence ; quotidien/hebdomadaire avancent toujours d'un jour (le
// filtre du jour de la semaine fait le tri pour hebdomadaire).
export function nextAnchorDate(rule: RecurrenceRule, lastOccurrenceDate: Date): Date {
  if (rule.type === 'tous_les_n_jours') return addDays(lastOccurrenceDate, Math.max(1, rule.interval ?? 1));
  return addDays(lastOccurrenceDate, 1);
}

// `fromDate` est un point d'ancrage, pas nécessairement une occurrence
// elle-même (cas hebdomadaire : seuls les jours de la semaine sélectionnés
// comptent) — l'heure de `fromDate` est conservée sur chaque date générée.
export function generateOccurrences(rule: RecurrenceRule, fromDate: Date, untilDate: Date): Date[] {
  if (rule.type === 'aucune') return [];
  const occurrences: Date[] = [];
  const step = rule.type === 'tous_les_n_jours' ? Math.max(1, rule.interval ?? 1) : 1;
  let cursor = new Date(fromDate);
  while (cursor.getTime() <= untilDate.getTime()) {
    if (rule.type === 'hebdomadaire') {
      if ((rule.weekdays ?? []).includes(cursor.getDay())) occurrences.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    } else {
      occurrences.push(new Date(cursor));
      cursor = addDays(cursor, step);
    }
  }
  return occurrences;
}

export interface EngagementLike {
  id: string;
  name: string;
  tags: string[];
  priority: Priority;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  archivedAt: string | null;
  recurrenceSeriesId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
}

export interface OccurrenceSlot {
  seriesId: string;
  scheduledAt: string;
  scheduledEndsAt: string;
}

export interface PlannedOccurrence extends OccurrenceSlot {
  templateId: string;
}

// Pure — ne touche pas le réseau. `windowEnd` est fourni par l'appelant
// (aujourd'hui + RECURRENCE_WINDOW_DAYS) plutôt que calculé ici, pour rester
// testable avec une date fixe.
export function planMissingOccurrences(engagements: EngagementLike[], windowEnd: Date): PlannedOccurrence[] {
  const bySeriesId = new Map<string, EngagementLike[]>();
  for (const e of engagements) {
    if (e.archivedAt || !e.recurrenceSeriesId || e.recurrenceType === 'aucune' || !e.scheduledAt || !e.scheduledEndsAt) {
      continue;
    }
    const list = bySeriesId.get(e.recurrenceSeriesId) ?? [];
    list.push(e);
    bySeriesId.set(e.recurrenceSeriesId, list);
  }

  const planned: PlannedOccurrence[] = [];
  for (const [seriesId, occurrences] of bySeriesId) {
    const latest = occurrences.reduce((a, b) =>
      new Date(a.scheduledAt as string) > new Date(b.scheduledAt as string) ? a : b
    );
    const durationMs =
      new Date(latest.scheduledEndsAt as string).getTime() - new Date(latest.scheduledAt as string).getTime();
    const rule: RecurrenceRule = {
      type: latest.recurrenceType,
      interval: latest.recurrenceInterval,
      weekdays: latest.recurrenceWeekdays,
    };
    const anchor = nextAnchorDate(rule, new Date(latest.scheduledAt as string));
    const dates = generateOccurrences(rule, anchor, windowEnd);
    for (const date of dates) {
      planned.push({
        seriesId,
        templateId: latest.id,
        scheduledAt: date.toISOString(),
        scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
      });
    }
  }
  return planned;
}

export interface ScheduleConflict {
  scheduledAt: string;
}

export function detectConflicts(occurrences: OccurrenceSlot[], existingTasks: EngagementLike[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const occ of occurrences) {
    const occStart = new Date(occ.scheduledAt).getTime();
    const occEnd = new Date(occ.scheduledEndsAt).getTime();
    const overlaps = existingTasks.some((t) => {
      if (t.recurrenceSeriesId === occ.seriesId) return false;
      if (!t.scheduledAt || !t.scheduledEndsAt) return false;
      const tStart = new Date(t.scheduledAt).getTime();
      const tEnd = new Date(t.scheduledEndsAt).getTime();
      return tStart < occEnd && tEnd > occStart;
    });
    if (overlaps) conflicts.push({ scheduledAt: occ.scheduledAt });
  }
  return conflicts;
}

export function isNextOccurrenceInSeries(task: EngagementLike, allEngagements: EngagementLike[]): boolean {
  if (!task.recurrenceSeriesId || task.recurrenceType === 'aucune' || !task.scheduledAt) return false;
  const taskTime = new Date(task.scheduledAt).getTime();
  return !allEngagements.some((e) => {
    if (e.archivedAt || e.id === task.id || e.recurrenceSeriesId !== task.recurrenceSeriesId) return false;
    if (!e.scheduledAt) return false;
    return new Date(e.scheduledAt).getTime() < taskTime;
  });
}

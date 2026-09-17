import { addDays, endOfDay, startOfDay } from './calendarLayout';

export interface ExistingTaskSlot {
  scheduledAt: string;
  scheduledEndsAt: string;
}

export interface FreeSlot {
  scheduledAt: string;
  scheduledEndsAt: string;
}

// Day 0 starts exactly at `fromDate` (so "plus tard aujourd'hui" can't suggest
// a slot in the past); every later day starts at its own midnight instead.
export function findNextFreeSlot(
  fromDate: Date,
  durationMinutes: number,
  existingTasks: ExistingTaskSlot[],
  maxDaysAhead: number
): FreeSlot | null {
  const durationMs = durationMinutes * 60_000;

  for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
    const dayReference = dayOffset === 0 ? fromDate : addDays(fromDate, dayOffset);
    const windowStart = dayOffset === 0 ? fromDate : startOfDay(dayReference);
    const windowEnd = endOfDay(dayReference);

    const dayTasks = existingTasks
      .map((task) => ({ start: new Date(task.scheduledAt), end: new Date(task.scheduledEndsAt) }))
      .filter((task) => task.end > windowStart && task.start < windowEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = windowStart;
    for (const task of dayTasks) {
      if (task.start.getTime() - cursor.getTime() >= durationMs) {
        return {
          scheduledAt: cursor.toISOString(),
          scheduledEndsAt: new Date(cursor.getTime() + durationMs).toISOString(),
        };
      }
      if (task.end.getTime() > cursor.getTime()) cursor = task.end;
    }
    if (windowEnd.getTime() - cursor.getTime() >= durationMs) {
      return {
        scheduledAt: cursor.toISOString(),
        scheduledEndsAt: new Date(cursor.getTime() + durationMs).toISOString(),
      };
    }
  }

  return null;
}

export interface NamedTaskSlot {
  id: string;
  name: string;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
}

/**
 * Noms des tâches qu'un créneau chevauche, dans l'ordre où elles arrivent.
 *
 * Les bords qui se touchent ne comptent pas : une tâche qui finit à 10h00
 * et une qui commence à 10h00 ne se chevauchent pas. L'appelant est
 * responsable d'exclure la tâche qu'il déplace elle-même.
 */
export function overlappingTaskNames(
  slot: { scheduledAt: string; scheduledEndsAt: string },
  tasks: NamedTaskSlot[]
): string[] {
  const start = new Date(slot.scheduledAt).getTime();
  const end = new Date(slot.scheduledEndsAt).getTime();
  return tasks
    .filter((task) => {
      if (!task.scheduledAt || !task.scheduledEndsAt) return false;
      const taskStart = new Date(task.scheduledAt).getTime();
      const taskEnd = new Date(task.scheduledEndsAt).getTime();
      return taskStart < end && taskEnd > start;
    })
    .map((task) => task.name);
}

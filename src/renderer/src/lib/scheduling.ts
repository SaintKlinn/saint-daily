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

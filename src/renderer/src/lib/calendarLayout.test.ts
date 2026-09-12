import { describe, expect, it } from 'vitest';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, endOfDay, startOfDay, startOfMonth, startOfWeek } from './calendarLayout';

describe('startOfWeek', () => {
  it('returns the same Monday when given a Monday', () => {
    const monday = new Date(2026, 8, 7, 15, 30); // mardi... non, calculons: 7 sept 2026 est un lundi
    const result = startOfWeek(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls back to Monday when given a Wednesday', () => {
    const wednesday = new Date(2026, 8, 9, 10, 0);
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
  });

  it('rolls back to Monday when given a Sunday', () => {
    const sunday = new Date(2026, 8, 13, 23, 0);
    const result = startOfWeek(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(7);
  });
});

describe('startOfMonth', () => {
  it('rolls back to the 1st at midnight from the last day of a 31-day month', () => {
    const result = startOfMonth(new Date(2026, 7, 31, 23, 59)); // 31 août 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls back to the 1st for a short month (February, 28 days in 2026)', () => {
    const result = startOfMonth(new Date(2026, 1, 28, 10, 0));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('adds positive days within the same month', () => {
    const start = new Date(2026, 8, 7);
    const result = addDays(start, 3);
    expect(result.getDate()).toBe(10);
    expect(result.getMonth()).toBe(8);
  });

  it('rolls over into the next month', () => {
    const start = new Date(2026, 8, 29);
    const result = addDays(start, 3);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(2);
  });

  it('supports negative days', () => {
    const start = new Date(2026, 8, 7);
    const result = addDays(start, -7);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(31);
  });
});

describe('dayIndexInWeek', () => {
  const weekStart = startOfWeek(new Date(2026, 8, 7));

  it('returns 0 for the week start itself', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 7, 9, 0).toISOString())).toBe(0);
  });

  it('returns 6 for the last day of the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 13, 23, 59).toISOString())).toBe(6);
  });

  it('returns 3 for a mid-week Thursday', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 10, 14, 0).toISOString())).toBe(3);
  });

  it('returns null for a date before the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 6, 23, 59).toISOString())).toBeNull();
  });

  it('returns null for a date after the week', () => {
    expect(dayIndexInWeek(weekStart, new Date(2026, 8, 14, 0, 0).toISOString())).toBeNull();
  });
});

describe('blockPositionFromDuration', () => {
  it('places a task starting at midnight at the top of the grid', () => {
    const { topPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 0, 0).toISOString(), 60);
    expect(topPercent).toBe(0);
  });

  it('places a task starting at noon at 50% down the grid', () => {
    const { topPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 12, 0).toISOString(), 30);
    expect(topPercent).toBeCloseTo(50, 5);
  });

  it('sizes a 30-minute task to roughly 2.08% of the day', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 30);
    expect(heightPercent).toBeCloseTo((30 / 1440) * 100, 5);
  });

  it('clamps a very short task to a minimum readable height', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 5);
    expect(heightPercent).toBeCloseTo((15 / 1440) * 100, 5);
  });

  it('never returns a negative height for a zero-or-negative duration', () => {
    const { heightPercent } = blockPositionFromDuration(new Date(2026, 8, 7, 9, 0).toISOString(), 0);
    expect(heightPercent).toBeGreaterThan(0);
  });
});

describe('blockPositionFromRange', () => {
  it('derives the same result as blockPositionFromDuration for an equivalent start+end', () => {
    const start = new Date(2026, 8, 7, 9, 0);
    const end = new Date(2026, 8, 7, 9, 30);
    const fromRange = blockPositionFromRange(start.toISOString(), end.toISOString());
    const fromDuration = blockPositionFromDuration(start.toISOString(), 30);
    expect(fromRange.topPercent).toBeCloseTo(fromDuration.topPercent, 5);
    expect(fromRange.heightPercent).toBeCloseTo(fromDuration.heightPercent, 5);
  });
});

describe('startOfDay', () => {
  it('zeroes the time components and keeps the same calendar day', () => {
    const result = startOfDay(new Date(2026, 8, 7, 15, 42, 10));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('endOfDay', () => {
  it('returns midnight at the start of the following day', () => {
    const result = endOfDay(new Date(2026, 8, 7, 15, 42, 10));
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(8);
    expect(result.getHours()).toBe(0);
  });

  it('rolls over into the next month at month end', () => {
    const result = endOfDay(new Date(2026, 8, 30, 10, 0));
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { findNextFreeSlot, type ExistingTaskSlot } from './scheduling';

describe('findNextFreeSlot', () => {
  it('returns the requested slot unchanged when the day is completely free', () => {
    const from = new Date(2026, 8, 7, 14, 0);
    const result = findNextFreeSlot(from, 30, [], 30);
    expect(result).not.toBeNull();
    expect(result!.scheduledAt).toBe(from.toISOString());
    expect(new Date(result!.scheduledEndsAt).getTime() - from.getTime()).toBe(30 * 60_000);
  });

  it('returns the first gap after an existing task on the same day', () => {
    const from = new Date(2026, 8, 7, 9, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() },
    ];
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 7, 9, 30).toISOString());
  });

  it('skips a gap too small for the requested duration and returns the next one', () => {
    const from = new Date(2026, 8, 7, 9, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 10).toISOString() },
      { scheduledAt: new Date(2026, 8, 7, 9, 20).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 10, 0).toISOString() },
    ];
    // the gap between the two tasks (9:10-9:20) is only 10 minutes, too small for a 30-minute task
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 7, 10, 0).toISOString());
  });

  it('cascades to the next day when the current day has no free slot left', () => {
    const from = new Date(2026, 8, 7, 23, 50); // only 10 minutes left before midnight
    const result = findNextFreeSlot(from, 30, [], 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 8, 0, 0).toISOString());
  });

  it('returns null when no free slot exists within the day cap', () => {
    const from = new Date(2026, 8, 7, 0, 0);
    const existing: ExistingTaskSlot[] = Array.from({ length: 3 }, (_, i) => ({
      scheduledAt: new Date(2026, 8, 7 + i, 0, 0).toISOString(),
      scheduledEndsAt: new Date(2026, 8, 8 + i, 0, 0).toISOString(), // each task fills an entire day
    }));
    const result = findNextFreeSlot(from, 30, existing, 3);
    expect(result).toBeNull();
  });

  it('accounts for a task that started the previous day and overlaps into this one', () => {
    const from = new Date(2026, 8, 8, 0, 0);
    const existing: ExistingTaskSlot[] = [
      { scheduledAt: new Date(2026, 8, 7, 23, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 8, 0, 20).toISOString() },
    ];
    const result = findNextFreeSlot(from, 30, existing, 30);
    expect(result!.scheduledAt).toBe(new Date(2026, 8, 8, 0, 20).toISOString());
  });
});

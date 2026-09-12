import { describe, expect, it } from 'vitest';
import { dueReminders, reminderKey, reminderMessage, REMINDER_TOLERANCE_MS } from './reminders';

const NOW = new Date('2026-09-12T10:00:00Z');

function engagement(overrides: Partial<{ id: string; name: string; scheduledAt: string | null; archivedAt: string | null }> = {}) {
  return {
    id: 'e1',
    name: 'Cours de guitare',
    scheduledAt: '2026-09-12T10:10:00Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('dueReminders', () => {
  it('returns nothing without engagements', () => {
    expect(dueReminders([], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('fires the lead reminder exactly when the lead time is reached', () => {
    // Planifiée à 10:10, délai 10 min => déclencheur à 10:00 pile.
    const due = dueReminders([engagement()], {}, NOW, 10, new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ engagementId: 'e1', kind: 'lead', stale: false });
  });

  it('does not fire before the lead time', () => {
    const due = dueReminders([engagement()], {}, NOW, 5, new Set());
    expect(due).toEqual([]);
  });

  it('fires the start reminder once the scheduled time is reached', () => {
    const due = dueReminders([engagement({ scheduledAt: '2026-09-12T10:00:00Z' })], {}, NOW, 10, new Set());
    expect(due.map((r) => r.kind)).toEqual(['lead', 'start']);
  });

  it('marks a trigger older than the tolerance as stale', () => {
    const long = new Date(NOW.getTime() - REMINDER_TOLERANCE_MS - 1000).toISOString();
    const due = dueReminders([engagement({ scheduledAt: long })], {}, NOW, 0, new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: 'start', stale: true });
  });

  it('keeps a trigger just inside the tolerance fresh', () => {
    const recent = new Date(NOW.getTime() - 30_000).toISOString();
    const due = dueReminders([engagement({ scheduledAt: recent })], {}, NOW, 0, new Set());
    expect(due[0]).toMatchObject({ kind: 'start', stale: false });
  });

  it('skips engagements that are not scheduled', () => {
    expect(dueReminders([engagement({ scheduledAt: null })], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('skips archived engagements', () => {
    expect(dueReminders([engagement({ archivedAt: '2026-09-01T00:00:00Z' })], {}, NOW, 10, new Set())).toEqual([]);
  });

  it('skips engagements that already have a practice entry', () => {
    expect(dueReminders([engagement()], { e1: 1 }, NOW, 10, new Set())).toEqual([]);
  });

  it('skips triggers already fired', () => {
    const fired = new Set([reminderKey('e1', 'lead')]);
    expect(dueReminders([engagement()], {}, NOW, 10, fired)).toEqual([]);
  });

  it('emits only the start trigger when the lead time is zero', () => {
    const due = dueReminders([engagement({ scheduledAt: '2026-09-12T10:00:00Z' })], {}, NOW, 0, new Set());
    expect(due.map((r) => r.kind)).toEqual(['start']);
  });

  it('ignores an unparseable scheduled date instead of throwing', () => {
    expect(dueReminders([engagement({ scheduledAt: 'pas une date' })], {}, NOW, 10, new Set())).toEqual([]);
  });
});

describe('reminderKey', () => {
  it('is stable and distinguishes the two kinds', () => {
    expect(reminderKey('abc', 'lead')).toBe('abc:lead');
    expect(reminderKey('abc', 'start')).toBe('abc:start');
  });
});

describe('reminderMessage', () => {
  it('wording depends on the kind', () => {
    const base = { engagementId: 'e1', name: 'Cours de guitare', key: 'e1:lead', stale: false };
    expect(reminderMessage({ ...base, kind: 'lead' }, 10)).toBe('Cours de guitare dans 10 min');
    expect(reminderMessage({ ...base, kind: 'start' }, 10)).toBe('Cours de guitare commence maintenant');
  });
});

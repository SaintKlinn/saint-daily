import { describe, expect, it } from 'vitest';
import {
  detectConflicts,
  generateOccurrences,
  isNextOccurrenceInSeries,
  nextAnchorDate,
  planMissingOccurrences,
  type EngagementLike,
  type RecurrenceRule,
} from './recurrence';

function engagement(overrides: Partial<EngagementLike> & { id: string }): EngagementLike {
  return {
    id: overrides.id,
    name: overrides.name ?? 'Tâche',
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 'aucune',
    scheduledAt: overrides.scheduledAt ?? null,
    scheduledEndsAt: overrides.scheduledEndsAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    recurrenceSeriesId: overrides.recurrenceSeriesId ?? null,
    recurrenceType: overrides.recurrenceType ?? 'aucune',
    recurrenceInterval: overrides.recurrenceInterval ?? null,
    recurrenceWeekdays: overrides.recurrenceWeekdays ?? null,
  };
}

describe('generateOccurrences', () => {
  it('returns nothing for "aucune"', () => {
    const rule: RecurrenceRule = { type: 'aucune', interval: null, weekdays: null };
    expect(generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 20, 9, 0))).toEqual([]);
  });

  it('generates one date per day for "quotidien"', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 11, 9, 0));
    expect(result).toHaveLength(5);
    expect(result[0].toISOString()).toBe(new Date(2026, 8, 7, 9, 0).toISOString());
    expect(result[4].toISOString()).toBe(new Date(2026, 8, 11, 9, 0).toISOString());
  });

  it('steps by N days for "tous_les_n_jours"', () => {
    const rule: RecurrenceRule = { type: 'tous_les_n_jours', interval: 3, weekdays: null };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 16, 9, 0));
    expect(result.map((d) => d.getDate())).toEqual([7, 10, 13, 16]);
  });

  it('only includes matching weekdays for "hebdomadaire"', () => {
    // 7 sept. 2026 est un lundi (day 1); [1, 3] = lundi + mercredi
    const rule: RecurrenceRule = { type: 'hebdomadaire', interval: null, weekdays: [1, 3] };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 20, 9, 0));
    expect(result.map((d) => d.getDate())).toEqual([7, 9, 14, 16]);
  });

  it('returns nothing when the window is already closed', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    expect(generateOccurrences(rule, new Date(2026, 8, 10, 9, 0), new Date(2026, 8, 7, 9, 0))).toEqual([]);
  });

  it('treats a non-positive interval as 1 day, never hanging', () => {
    const rule: RecurrenceRule = { type: 'tous_les_n_jours', interval: 0, weekdays: null };
    const result = generateOccurrences(rule, new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 9, 9, 0));
    expect(result.map((d) => d.getDate())).toEqual([7, 8, 9]);
  });
});

describe('nextAnchorDate', () => {
  it('advances by 1 day for "quotidien"', () => {
    const rule: RecurrenceRule = { type: 'quotidien', interval: null, weekdays: null };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
  });

  it('advances by 1 day for "hebdomadaire" (the weekday filter does the rest)', () => {
    const rule: RecurrenceRule = { type: 'hebdomadaire', interval: null, weekdays: [1] };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
  });

  it('advances by the interval for "tous_les_n_jours"', () => {
    const rule: RecurrenceRule = { type: 'tous_les_n_jours', interval: 5, weekdays: null };
    const result = nextAnchorDate(rule, new Date(2026, 8, 7, 9, 0));
    expect(result.toISOString()).toBe(new Date(2026, 8, 12, 9, 0).toISOString());
  });
});

describe('planMissingOccurrences', () => {
  it('returns nothing when there are no recurring series', () => {
    const engagements = [engagement({ id: 'a', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString() })];
    expect(planMissingOccurrences(engagements, new Date(2026, 8, 20))).toEqual([]);
  });

  it('fills the window for a series behind schedule', () => {
    const engagements = [
      engagement({
        id: 'a',
        name: 'Arroser les plantes',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString(),
      }),
    ];
    const planned = planMissingOccurrences(engagements, new Date(2026, 8, 10, 9, 0));
    expect(planned).toHaveLength(3); // 8, 9, 10 sept.
    expect(planned.every((p) => p.seriesId === 'serie-1' && p.templateId === 'a')).toBe(true);
    const first = planned[0];
    expect(first.scheduledAt).toBe(new Date(2026, 8, 8, 9, 0).toISOString());
    // durée (15 min) préservée sur chaque occurrence générée
    expect(new Date(first.scheduledEndsAt).getTime() - new Date(first.scheduledAt).getTime()).toBe(15 * 60_000);
  });

  it('ignores an archived occurrence when finding the latest in a series', () => {
    const engagements = [
      engagement({
        id: 'a',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString(),
      }),
      engagement({
        id: 'b',
        recurrenceSeriesId: 'serie-1',
        recurrenceType: 'quotidien',
        scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString(),
        scheduledEndsAt: new Date(2026, 8, 9, 9, 15).toISOString(),
        archivedAt: new Date().toISOString(),
      }),
    ];
    const planned = planMissingOccurrences(engagements, new Date(2026, 8, 9, 9, 0));
    // la dernière occurrence NON archivée est "a" (7 sept.) — "b" (9 sept., archivée) est ignorée,
    // donc la génération reprend au 8 sept., pas au 10.
    expect(planned.map((p) => p.scheduledAt)).toEqual([
      new Date(2026, 8, 8, 9, 0).toISOString(),
      new Date(2026, 8, 9, 9, 0).toISOString(),
    ]);
  });

  it('excludes engagements with recurrenceType "aucune"', () => {
    const engagements = [
      engagement({ id: 'a', recurrenceSeriesId: 'serie-1', recurrenceType: 'aucune', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 15).toISOString() }),
    ];
    expect(planMissingOccurrences(engagements, new Date(2026, 8, 20))).toEqual([]);
  });
});

describe('detectConflicts', () => {
  it('returns nothing when nothing overlaps', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'other', scheduledAt: new Date(2026, 8, 7, 14, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 14, 30).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([]);
  });

  it('flags an occurrence that overlaps an unrelated task', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'other', scheduledAt: new Date(2026, 8, 7, 9, 15).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 45).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([{ scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString() }]);
  });

  it('ignores an overlap with a sibling of the same series', () => {
    const occurrences = [{ seriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 0).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 30).toISOString() }];
    const existing = [engagement({ id: 'sibling', recurrenceSeriesId: 's1', scheduledAt: new Date(2026, 8, 7, 9, 15).toISOString(), scheduledEndsAt: new Date(2026, 8, 7, 9, 45).toISOString() })];
    expect(detectConflicts(occurrences, existing)).toEqual([]);
  });
});

describe('isNextOccurrenceInSeries', () => {
  it('is true when no other non-archived sibling starts earlier', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString() });
    const sibling = engagement({ id: 'b', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(true);
  });

  it('is false when a non-archived sibling starts earlier', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    const sibling = engagement({ id: 'b', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(false);
  });

  it('ignores an earlier sibling that is archived', () => {
    const task = engagement({ id: 'a', recurrenceSeriesId: 's1', recurrenceType: 'quotidien', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    const sibling = engagement({
      id: 'b',
      recurrenceSeriesId: 's1',
      recurrenceType: 'quotidien',
      scheduledAt: new Date(2026, 8, 8, 9, 0).toISOString(),
      archivedAt: new Date().toISOString(),
    });
    expect(isNextOccurrenceInSeries(task, [task, sibling])).toBe(true);
  });

  it('is false for a task with no recurrence', () => {
    const task = engagement({ id: 'a', recurrenceType: 'aucune', scheduledAt: new Date(2026, 8, 9, 9, 0).toISOString() });
    expect(isNextOccurrenceInSeries(task, [task])).toBe(false);
  });
});

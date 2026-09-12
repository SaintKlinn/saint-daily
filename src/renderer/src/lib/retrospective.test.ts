import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  compareWeeks,
  countEntriesByDay,
  engagementBreakdown,
  formatMinutes,
  heatmapLevel,
  tagBreakdown,
  timeOfDayBuckets,
  toLocalDayKey,
  HEATMAP_WEEKS,
} from './retrospective';

// Les dates sont construites avec `new Date(y, m, d, h)` — donc en heure
// LOCALE — parce que toutes ces fonctions raisonnent sur le rythme
// quotidien vécu par l'utilisateur, pas sur UTC.

describe('toLocalDayKey', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(toLocalDayKey(new Date(2026, 0, 5, 13, 0))).toBe('2026-01-05');
  });
});

describe('countEntriesByDay', () => {
  it('returns an empty map for no entries', () => {
    expect(countEntriesByDay([])).toEqual({});
  });

  it('counts several entries on the same day', () => {
    const entries = [
      { engagementId: 'a', durationMinutes: 30, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
      { engagementId: 'b', durationMinutes: 0, practicedAt: new Date(2026, 8, 10, 20).toISOString() },
      { engagementId: 'a', durationMinutes: 15, practicedAt: new Date(2026, 8, 11, 9).toISOString() },
    ];
    expect(countEntriesByDay(entries)).toEqual({ '2026-09-10': 2, '2026-09-11': 1 });
  });

  it('counts a zero-duration entry like any other', () => {
    const entries = [{ engagementId: 'a', durationMinutes: 0, practicedAt: new Date(2026, 8, 10, 9).toISOString() }];
    expect(countEntriesByDay(entries)).toEqual({ '2026-09-10': 1 });
  });
});

describe('heatmapLevel', () => {
  it('maps counts to the four intensity levels', () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(2)).toBe(2);
    expect(heatmapLevel(3)).toBe(2);
    expect(heatmapLevel(4)).toBe(3);
    expect(heatmapLevel(42)).toBe(3);
  });
});

describe('buildHeatmapGrid', () => {
  it('builds 53 columns of 7 days ending on the current week', () => {
    const now = new Date(2026, 8, 10, 12); // jeudi
    const grid = buildHeatmapGrid({}, now);
    expect(grid).toHaveLength(HEATMAP_WEEKS);
    expect(grid[0]).toHaveLength(7);
    // Dernière colonne = semaine en cours, premier jour = lundi.
    expect(toLocalDayKey(grid[HEATMAP_WEEKS - 1][0].date)).toBe('2026-09-07');
  });

  it('fills counts and flags days after today as future', () => {
    const now = new Date(2026, 8, 10, 12);
    const grid = buildHeatmapGrid({ '2026-09-09': 2 }, now);
    const lastColumn = grid[HEATMAP_WEEKS - 1];
    expect(lastColumn[2].count).toBe(2); // mercredi
    expect(lastColumn[2].level).toBe(2);
    expect(lastColumn[2].isFuture).toBe(false);
    expect(lastColumn[3].isFuture).toBe(false); // aujourd'hui n'est pas futur
    expect(lastColumn[4].isFuture).toBe(true); // vendredi
  });
});

describe('compareWeeks', () => {
  it('splits entries between the current and the previous week', () => {
    const now = new Date(2026, 8, 10, 12); // jeudi 10 sept, semaine du lundi 7
    const entries = [
      { engagementId: 'a', durationMinutes: 30, practicedAt: new Date(2026, 8, 8, 9).toISOString() },
      { engagementId: 'a', durationMinutes: 45, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
      { engagementId: 'a', durationMinutes: 20, practicedAt: new Date(2026, 8, 3, 9).toISOString() },
    ];
    expect(compareWeeks(entries, now)).toEqual({
      thisWeek: { minutes: 75, sessions: 2 },
      lastWeek: { minutes: 20, sessions: 1 },
    });
  });

  it('ignores entries older than the previous week', () => {
    const now = new Date(2026, 8, 10, 12);
    const entries = [{ engagementId: 'a', durationMinutes: 90, practicedAt: new Date(2026, 7, 1, 9).toISOString() }];
    expect(compareWeeks(entries, now)).toEqual({
      thisWeek: { minutes: 0, sessions: 0 },
      lastWeek: { minutes: 0, sessions: 0 },
    });
  });

  it('ignores entries dated after the current week', () => {
    const now = new Date(2026, 8, 10, 12);
    const entries = [{ engagementId: 'a', durationMinutes: 90, practicedAt: new Date(2026, 8, 20, 9).toISOString() }];
    expect(compareWeeks(entries, now).thisWeek).toEqual({ minutes: 0, sessions: 0 });
  });
});

describe('tagBreakdown', () => {
  const engagementsById = {
    a: { id: 'a', name: 'Guitare', tags: ['Musique', 'Perso'] },
    b: { id: 'b', name: 'Cuir', tags: ['Artisanat'] },
  };

  it('counts an entry fully toward each of its engagement tags', () => {
    const entries = [{ engagementId: 'a', durationMinutes: 60, practicedAt: new Date(2026, 8, 10, 9).toISOString() }];
    expect(tagBreakdown(entries, engagementsById)).toEqual([
      { key: 'Musique', label: 'Musique', minutes: 60, sessions: 1 },
      { key: 'Perso', label: 'Perso', minutes: 60, sessions: 1 },
    ]);
  });

  it('sorts by minutes descending, then alphabetically', () => {
    const entries = [
      { engagementId: 'a', durationMinutes: 10, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
      { engagementId: 'b', durationMinutes: 90, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
    ];
    expect(tagBreakdown(entries, engagementsById).map((r) => r.key)).toEqual(['Artisanat', 'Musique', 'Perso']);
  });

  it('skips entries whose engagement is unknown', () => {
    const entries = [{ engagementId: 'zzz', durationMinutes: 60, practicedAt: new Date(2026, 8, 10, 9).toISOString() }];
    expect(tagBreakdown(entries, engagementsById)).toEqual([]);
  });
});

describe('engagementBreakdown', () => {
  it('groups by engagement and labels with its name', () => {
    const engagementsById = {
      a: { id: 'a', name: 'Guitare', tags: [] },
      b: { id: 'b', name: 'Cuir', tags: [] },
    };
    const entries = [
      { engagementId: 'a', durationMinutes: 30, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
      { engagementId: 'a', durationMinutes: 30, practicedAt: new Date(2026, 8, 11, 9).toISOString() },
      { engagementId: 'b', durationMinutes: 15, practicedAt: new Date(2026, 8, 10, 9).toISOString() },
    ];
    expect(engagementBreakdown(entries, engagementsById)).toEqual([
      { key: 'a', label: 'Guitare', minutes: 60, sessions: 2 },
      { key: 'b', label: 'Cuir', minutes: 15, sessions: 1 },
    ]);
  });
});

describe('timeOfDayBuckets', () => {
  it('always returns the four periods in order', () => {
    expect(timeOfDayBuckets([]).map((b) => b.key)).toEqual(['nuit', 'matin', 'apresMidi', 'soir']);
  });

  it('places entries by local hour and averages their duration', () => {
    const entries = [
      { engagementId: 'a', durationMinutes: 30, practicedAt: new Date(2026, 8, 10, 7).toISOString() },
      { engagementId: 'a', durationMinutes: 50, practicedAt: new Date(2026, 8, 10, 11, 59).toISOString() },
      { engagementId: 'a', durationMinutes: 10, practicedAt: new Date(2026, 8, 10, 23).toISOString() },
    ];
    const buckets = timeOfDayBuckets(entries);
    expect(buckets[1]).toMatchObject({ key: 'matin', sessions: 2, averageMinutes: 40 });
    expect(buckets[3]).toMatchObject({ key: 'soir', sessions: 1, averageMinutes: 10 });
    expect(buckets[0]).toMatchObject({ key: 'nuit', sessions: 0, averageMinutes: 0 });
  });

  it('puts the boundary hours in the later bucket', () => {
    const at = (hour: number) => ({ engagementId: 'a', durationMinutes: 1, practicedAt: new Date(2026, 8, 10, hour).toISOString() });
    expect(timeOfDayBuckets([at(0)])[0].sessions).toBe(1);
    expect(timeOfDayBuckets([at(6)])[1].sessions).toBe(1);
    expect(timeOfDayBuckets([at(12)])[2].sessions).toBe(1);
    expect(timeOfDayBuckets([at(18)])[3].sessions).toBe(1);
  });
});

describe('formatMinutes', () => {
  it('formats below and above an hour', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(135)).toBe('2 h 15');
  });
});

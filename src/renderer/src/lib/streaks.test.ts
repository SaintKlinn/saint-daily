import { describe, expect, it } from 'vitest';
import {
  calculateStreak,
  daysSinceLastPractice,
  filterByTag,
  filterSkillsForPicker,
  sortSkillsByRecentPractice,
  streakJustExtended,
} from './streaks';

describe('calculateStreak', () => {
  it('returns 0 with no entries', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    const entries = [
      { practicedAt: '2026-08-31T09:00:00Z' },
      { practicedAt: '2026-08-30T09:00:00Z' },
      { practicedAt: '2026-08-29T09:00:00Z' },
    ];
    expect(calculateStreak(entries, now)).toBe(3);
  });

  it('still counts an active streak when today has no entry yet', () => {
    const now = new Date('2026-08-31T07:00:00Z');
    const entries = [{ practicedAt: '2026-08-30T09:00:00Z' }, { practicedAt: '2026-08-29T09:00:00Z' }];
    expect(calculateStreak(entries, now)).toBe(2);
  });

  it('resets to 0 when the chain is broken', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    expect(calculateStreak([{ practicedAt: '2026-08-28T09:00:00Z' }], now)).toBe(0);
  });
});

describe('daysSinceLastPractice', () => {
  it('returns null with no entries', () => {
    expect(daysSinceLastPractice([])).toBeNull();
  });

  it('returns 0 for a practice logged today', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    expect(daysSinceLastPractice([{ practicedAt: '2026-08-31T09:00:00Z' }], now)).toBe(0);
  });

  it('returns the number of full days since the most recent entry', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    const entries = [{ practicedAt: '2026-08-25T09:00:00Z' }, { practicedAt: '2026-08-27T09:00:00Z' }];
    expect(daysSinceLastPractice(entries, now)).toBe(4);
  });
});

describe('filterByTag', () => {
  const skills = [
    { name: 'Piano', tags: ['Musique', 'Créatif'] },
    { name: 'React', tags: ['Code', 'Technique'] },
  ];

  it('returns all skills when no tag is given', () => {
    expect(filterByTag(skills, null)).toEqual(skills);
  });

  it('filters case-insensitively on an exact tag match', () => {
    expect(filterByTag(skills, 'musique')).toEqual([skills[0]]);
  });

  it('returns an empty list when no skill has the tag', () => {
    expect(filterByTag(skills, 'Sport')).toEqual([]);
  });
});

describe('streakJustExtended', () => {
  it('is false with no previous value (first render, nothing to compare against yet)', () => {
    expect(streakJustExtended(null, 5)).toBe(false);
  });

  it('is true when the streak grew', () => {
    expect(streakJustExtended(3, 4)).toBe(true);
  });

  it('is false when the streak held steady or dropped', () => {
    expect(streakJustExtended(4, 4)).toBe(false);
    expect(streakJustExtended(4, 0)).toBe(false);
  });
});

describe('filterSkillsForPicker', () => {
  const skills = [
    { name: 'Piano', archivedAt: null },
    { name: 'Guitare', archivedAt: '2026-01-01T00:00:00Z' },
    { name: 'Peinture', archivedAt: null },
  ];

  it('excludes archived skills even with no search', () => {
    expect(filterSkillsForPicker(skills, '')).toEqual([skills[0], skills[2]]);
  });

  it('filters case-insensitively on the name among active skills', () => {
    expect(filterSkillsForPicker(skills, 'pia')).toEqual([skills[0]]);
  });

  it('never returns an archived skill even if its name matches the search', () => {
    expect(filterSkillsForPicker(skills, 'guit')).toEqual([]);
  });
});

describe('sortSkillsByRecentPractice', () => {
  const now = new Date('2026-08-31T18:00:00Z');
  const a = { id: 'a', name: 'Alpha' };
  const b = { id: 'b', name: 'Beta' };
  const c = { id: 'c', name: 'Charlie' };

  it('sorts by most recently practiced first', () => {
    const entriesBySkill = {
      a: [{ practicedAt: '2026-08-29T09:00:00Z' }], // 2 jours
      b: [{ practicedAt: '2026-08-31T09:00:00Z' }], // aujourd'hui
      c: [{ practicedAt: '2026-08-25T09:00:00Z' }], // 6 jours
    };
    expect(sortSkillsByRecentPractice([a, b, c], entriesBySkill, now)).toEqual([b, a, c]);
  });

  it('puts never-practiced skills last, alphabetically among themselves', () => {
    const entriesBySkill = { a: [{ practicedAt: '2026-08-30T09:00:00Z' }] };
    expect(sortSkillsByRecentPractice([c, b, a], entriesBySkill, now)).toEqual([a, b, c]);
  });

  it('breaks ties on the same daysSinceLastPractice alphabetically', () => {
    const entriesBySkill = {
      a: [{ practicedAt: '2026-08-30T09:00:00Z' }],
      b: [{ practicedAt: '2026-08-30T09:00:00Z' }],
    };
    expect(sortSkillsByRecentPractice([b, a], entriesBySkill, now)).toEqual([a, b]);
  });
});

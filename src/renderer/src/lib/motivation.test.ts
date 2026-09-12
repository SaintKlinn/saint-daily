import { describe, expect, it } from 'vitest';
import { startOfWeek } from './calendarLayout';
import { computeBadges, computeGoalProgress } from './motivation';

function entry(practicedAt: string, durationMinutes = 30) {
  return { practicedAt, durationMinutes };
}

describe('computeBadges', () => {
  it('returns every badge locked for an empty history', () => {
    const badges = computeBadges([]);
    expect(badges).toHaveLength(4);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('unlocks the seven-day badge at exactly seven consecutive days', () => {
    const six = Array.from({ length: 6 }, (_, i) => entry(`2026-08-0${i + 1}T09:00:00Z`));
    const seven = [...six, entry('2026-08-07T09:00:00Z')];
    expect(computeBadges(six).find((b) => b.key === 'streak-7')?.unlocked).toBe(false);
    expect(computeBadges(seven).find((b) => b.key === 'streak-7')?.unlocked).toBe(true);
  });

  it('unlocks the ten-hour badge at exactly 600 minutes', () => {
    const justUnder = [entry('2026-08-01T09:00:00Z', 599)];
    const exactly = [entry('2026-08-01T09:00:00Z', 600)];
    expect(computeBadges(justUnder).find((b) => b.key === 'hours-10')?.unlocked).toBe(false);
    expect(computeBadges(exactly).find((b) => b.key === 'hours-10')?.unlocked).toBe(true);
  });

  it('counts zero-duration entries as sessions', () => {
    const hundred = Array.from({ length: 100 }, () => entry('2026-08-01T09:00:00Z', 0));
    expect(computeBadges(hundred).find((b) => b.key === 'sessions-100')?.unlocked).toBe(true);
    expect(computeBadges(hundred).find((b) => b.key === 'hours-10')?.unlocked).toBe(false);
  });
});

describe('computeGoalProgress', () => {
  // Jeudi 10 septembre 2026 ; semaine du lundi 7, mois depuis le 1er.
  const NOW = new Date(2026, 8, 10, 14, 0);

  it('counts sessions inside the current week only', () => {
    const entries = [
      entry(new Date(2026, 8, 8, 9).toISOString()),
      entry(new Date(2026, 8, 9, 9).toISOString()),
      entry(new Date(2026, 8, 3, 9).toISOString()),
    ];
    expect(computeGoalProgress(entries, 'hebdomadaire', 'seances', 3, NOW)).toMatchObject({
      current: 2,
      target: 3,
    });
  });

  it('counts hours inside the current month', () => {
    const entries = [
      entry(new Date(2026, 8, 2, 9).toISOString(), 90),
      entry(new Date(2026, 8, 9, 9).toISOString(), 30),
      entry(new Date(2026, 7, 28, 9).toISOString(), 600),
    ];
    expect(computeGoalProgress(entries, 'mensuel', 'heures', 4, NOW).current).toBeCloseTo(2);
  });

  it('caps the ratio at 1 once the goal is beaten', () => {
    const entries = Array.from({ length: 10 }, () => entry(new Date(2026, 8, 8, 9).toISOString()));
    expect(computeGoalProgress(entries, 'hebdomadaire', 'seances', 3, NOW).ratio).toBe(1);
  });

  it('never divides by zero when the target is absurd', () => {
    expect(computeGoalProgress([], 'hebdomadaire', 'seances', 0, NOW).ratio).toBe(0);
  });

  // 178 min = 2.9666... h : `toFixed(1)` seul arrondirait à « 3.0 », un
  // affichage qui dit l'objectif atteint alors que `current >= target`
  // (comparé ailleurs sur la valeur brute) dirait le contraire. Tronquer
  // avant d'arrondir garantit que le chiffre affiché ne peut jamais
  // dépasser la progression réelle.
  it('floors the displayed hours instead of rounding them up (178 min stays under 3 h)', () => {
    const progress = computeGoalProgress([entry(new Date(2026, 8, 8, 9).toISOString(), 178)], 'hebdomadaire', 'heures', 3, NOW);
    expect(progress.label).toBe('2.9 h sur 3 h');
    expect(progress.current).toBeLessThan(progress.target);
  });

  it('counts an entry dated exactly at the start of the goal window', () => {
    const windowStart = startOfWeek(NOW);
    const entries = [entry(windowStart.toISOString())];
    expect(computeGoalProgress(entries, 'hebdomadaire', 'seances', 1, NOW).current).toBe(1);
  });
});

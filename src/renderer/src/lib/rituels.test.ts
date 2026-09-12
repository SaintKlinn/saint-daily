import { describe, expect, it } from 'vitest';
import { shouldShowWeeklyReview } from './rituels';

// Jeudi 10 septembre 2026 ; la semaine commence le lundi 7 (cf. startOfWeek).
const NOW = new Date(2026, 8, 10, 14, 0);

describe('shouldShowWeeklyReview', () => {
  it('shows the banner when it was never dismissed', () => {
    expect(shouldShowWeeklyReview(null, NOW)).toBe(true);
  });

  it('hides it when it was dismissed earlier this week', () => {
    expect(shouldShowWeeklyReview(new Date(2026, 8, 8, 9).toISOString(), NOW)).toBe(false);
  });

  it('shows it again once a new week has started', () => {
    expect(shouldShowWeeklyReview(new Date(2026, 8, 4, 9).toISOString(), NOW)).toBe(true);
  });

  it('treats a dismissal exactly at the start of the week as this week', () => {
    expect(shouldShowWeeklyReview(new Date(2026, 8, 7, 0, 0, 0).toISOString(), NOW)).toBe(false);
  });

  it('shows it rather than hiding it when the stored date is unreadable', () => {
    expect(shouldShowWeeklyReview('pas une date', NOW)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { shouldShowEveningPrompt, shouldShowMorningGreeting, shouldShowWeeklyReview, toLocalDateKey } from './rituels';

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

describe('toLocalDateKey', () => {
  it('formats the local day, zero-padded', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('shouldShowMorningGreeting', () => {
  it('shows it in the morning when never dismissed today', () => {
    expect(shouldShowMorningGreeting(null, new Date(2026, 8, 10, 8))).toBe(true);
  });

  it('hides it once dismissed today', () => {
    expect(shouldShowMorningGreeting('2026-09-10', new Date(2026, 8, 10, 8))).toBe(false);
  });

  it('shows it again the next morning', () => {
    expect(shouldShowMorningGreeting('2026-09-09', new Date(2026, 8, 10, 8))).toBe(true);
  });

  it('is hidden from noon onwards, dismissed or not', () => {
    expect(shouldShowMorningGreeting(null, new Date(2026, 8, 10, 12))).toBe(false);
    expect(shouldShowMorningGreeting(null, new Date(2026, 8, 10, 19))).toBe(false);
  });

  it('still shows at one minute to noon', () => {
    expect(shouldShowMorningGreeting(null, new Date(2026, 8, 10, 11, 59))).toBe(true);
  });
});

describe('shouldShowEveningPrompt', () => {
  it('is hidden before 18h', () => {
    expect(shouldShowEveningPrompt(false, new Date(2026, 8, 10, 17, 59))).toBe(false);
  });

  it('shows from 18h when nothing was written today', () => {
    expect(shouldShowEveningPrompt(false, new Date(2026, 8, 10, 18))).toBe(true);
  });

  it('hides once today already has a reflection', () => {
    expect(shouldShowEveningPrompt(true, new Date(2026, 8, 10, 21))).toBe(false);
  });
});

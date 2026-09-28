import { describe, expect, it } from 'vitest';
import { BARRE_ABSENTE, etatBarreDesTaches, type EtatPomodoroMinimal } from './pomodoroTaskbar';

const now = Date.parse('2026-09-02T10:00:00Z');
const durations = { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };

function etat(session: Partial<EtatPomodoroMinimal['session']>): EtatPomodoroMinimal {
  return {
    durations,
    session: { phase: 'work', status: 'running', phaseEndsAt: now, remainingMsAtPause: null, extensionMs: 0, ...session },
  };
}

describe('etatBarreDesTaches', () => {
  it('removes the bar when there is no session', () => {
    expect(etatBarreDesTaches(null, now)).toEqual(BARRE_ABSENTE);
    expect(etatBarreDesTaches(etat({ status: 'idle' }), now)).toEqual(BARRE_ABSENTE);
  });

  it('fills with the elapsed share of a running phase', () => {
    // 5 minutes restantes sur 25 : 80 % faits.
    expect(etatBarreDesTaches(etat({ phaseEndsAt: now + 5 * 60_000 }), now)).toEqual({ ratio: 0.8, mode: 'normal' });
  });

  it('uses the break durations during a break', () => {
    expect(etatBarreDesTaches(etat({ phase: 'shortBreak', phaseEndsAt: now + 60_000 }), now).ratio).toBeCloseTo(0.8);
  });

  it('counts extensions in the total', () => {
    // 15 minutes restantes sur 25 + 5 : moitié faite.
    expect(etatBarreDesTaches(etat({ phaseEndsAt: now + 15 * 60_000, extensionMs: 5 * 60_000 }), now).ratio).toBeCloseTo(0.5);
  });

  it('freezes in paused mode on the remaining time at pause', () => {
    const barre = etatBarreDesTaches(etat({ status: 'paused', remainingMsAtPause: 20 * 60_000 }), now);
    expect(barre.mode).toBe('paused');
    expect(barre.ratio).toBeCloseTo(0.2);
  });

  it('shows a full paused bar while the next phase waits for a click', () => {
    expect(etatBarreDesTaches(etat({ status: 'awaitingAdvance' }), now)).toEqual({ ratio: 1, mode: 'paused' });
  });

  it('never goes past full or below empty', () => {
    expect(etatBarreDesTaches(etat({ phaseEndsAt: now - 60_000 }), now).ratio).toBe(1);
    expect(etatBarreDesTaches(etat({ phaseEndsAt: now + 99 * 60_000 }), now).ratio).toBe(0);
  });
});

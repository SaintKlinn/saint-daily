import { describe, expect, it } from 'vitest';
import { AMBIANCES, alphaHex, momentDeLaJournee } from './ambiance';

describe('momentDeLaJournee', () => {
  const a = (h: number, m = 0) => momentDeLaJournee(new Date(2026, 8, 10, h, m));

  it('maps local hours to the four moments, boundaries included', () => {
    expect(a(4, 59)).toBe('nuit');
    expect(a(5)).toBe('aube');
    expect(a(8, 59)).toBe('aube');
    expect(a(9)).toBe('jour');
    expect(a(16, 59)).toBe('jour');
    expect(a(17)).toBe('soir');
    expect(a(20, 59)).toBe('soir');
    expect(a(21)).toBe('nuit');
    expect(a(0)).toBe('nuit');
  });
});

describe('AMBIANCES', () => {
  it('keeps the historical daytime halo', () => {
    expect(alphaHex(AMBIANCES.jour.intensite)).toBe('1a');
  });

  it('stays subtle at every moment', () => {
    for (const ambiance of Object.values(AMBIANCES)) {
      expect(ambiance.intensite).toBeGreaterThan(0);
      // Un halo, pas un éclairage : au-delà de ~20 %, le texte muted posé
      // dessus perdrait de son contraste.
      expect(ambiance.intensite).toBeLessThanOrEqual(0.2);
    }
  });
});

describe('alphaHex', () => {
  it('formats and clamps', () => {
    expect(alphaHex(0)).toBe('00');
    expect(alphaHex(1)).toBe('ff');
    expect(alphaHex(0.5)).toBe('80');
    expect(alphaHex(2)).toBe('ff');
    expect(alphaHex(-1)).toBe('00');
  });
});

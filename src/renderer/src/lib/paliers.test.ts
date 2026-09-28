import { describe, expect, it } from 'vitest';
import {
  CLE_PALIERS_FETES,
  ecrirePaliersFetes,
  lirePaliersFetes,
  messagePalier,
  palierAFeter,
  PALIERS,
} from './paliers';
import type { StockageLike } from './preferencesAffichage';

function stockageMemoire(): StockageLike & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>();
  return { valeurs, getItem: (c) => valeurs.get(c) ?? null, setItem: (c, v) => void valeurs.set(c, v) };
}

describe('palierAFeter', () => {
  it('celebrates nothing below the first milestone or without a streak', () => {
    expect(palierAFeter(6, '2026-09-01', null)).toBeNull();
    expect(palierAFeter(12, null, null)).toBeNull();
  });

  it('celebrates the first milestone once reached', () => {
    expect(palierAFeter(7, '2026-09-01', null)).toEqual({
      palier: 7,
      fetes: { debutSerie: '2026-09-01', paliers: [7] },
    });
  });

  it('does not celebrate the same milestone twice in the same streak', () => {
    expect(palierAFeter(9, '2026-09-01', { debutSerie: '2026-09-01', paliers: [7] })).toBeNull();
  });

  it('celebrates again in a new streak', () => {
    expect(palierAFeter(7, '2026-10-01', { debutSerie: '2026-09-01', paliers: [7] })?.palier).toBe(7);
  });

  it('celebrates only the highest milestone when several are crossed at once', () => {
    expect(palierAFeter(40, '2026-08-01', null)).toEqual({
      palier: 30,
      fetes: { debutSerie: '2026-08-01', paliers: [7, 30] },
    });
  });

  it('celebrates the next milestone later in the same streak', () => {
    expect(palierAFeter(30, '2026-08-01', { debutSerie: '2026-08-01', paliers: [7] })?.palier).toBe(30);
  });
});

describe('messagePalier', () => {
  it('has a dedicated message for every milestone', () => {
    for (const palier of PALIERS) {
      const { titre, detail } = messagePalier(palier);
      expect(titre.length).toBeGreaterThan(0);
      expect(detail).not.toBe('Continue sur cette lancée.');
    }
  });
});

describe('lirePaliersFetes / ecrirePaliersFetes', () => {
  it('reads back what was written and rejects malformed values', () => {
    const stockage = stockageMemoire();
    ecrirePaliersFetes({ debutSerie: '2026-09-01', paliers: [7] }, stockage);
    expect(lirePaliersFetes(stockage)).toEqual({ debutSerie: '2026-09-01', paliers: [7] });
    stockage.valeurs.set(CLE_PALIERS_FETES, JSON.stringify({ debutSerie: 3, paliers: [] }));
    expect(lirePaliersFetes(stockage)).toBeNull();
    stockage.valeurs.set(CLE_PALIERS_FETES, '{oups');
    expect(lirePaliersFetes(stockage)).toBeNull();
  });
});

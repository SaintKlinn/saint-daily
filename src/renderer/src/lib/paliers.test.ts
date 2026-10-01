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
    expect(palierAFeter(6, '2026-09-01', null, '2026-09-15')).toBeNull();
    expect(palierAFeter(12, null, null, '2026-09-15')).toBeNull();
  });

  it('celebrates the first milestone once reached', () => {
    expect(palierAFeter(7, '2026-09-01', null, '2026-09-15')).toEqual({
      palier: 7,
      fetes: { debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-15' },
    });
  });

  it('does not celebrate the same milestone twice in the same streak', () => {
    expect(palierAFeter(9, '2026-09-01', { debutSerie: '2026-09-01', paliers: [7] }, '2026-09-15')).toBeNull();
  });

  it('celebrates again in a new streak', () => {
    expect(palierAFeter(7, '2026-10-01', { debutSerie: '2026-09-01', paliers: [7] }, '2026-10-07')?.palier).toBe(7);
  });

  it('celebrates only the highest milestone when several are crossed at once', () => {
    expect(palierAFeter(40, '2026-08-01', null, '2026-09-15')).toEqual({
      palier: 30,
      fetes: { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-15' },
    });
  });

  it('celebrates the next milestone later in the same streak', () => {
    expect(palierAFeter(30, '2026-08-01', { debutSerie: '2026-08-01', paliers: [7] }, '2026-08-30')?.palier).toBe(30);
  });

  it('does not celebrate again when the same streak’s first day moves', () => {
    // 40 jours fêtés à 30 le 5 septembre. Mettre en pause le skill des
    // trois premiers jours fait commencer la série le 4 août au lieu du 1er.
    const fetes = { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-05' };
    expect(palierAFeter(37, '2026-08-04', fetes, '2026-09-09')).toBeNull();
    // Et la remise en route le ramène au 1er : toujours la même série.
    expect(palierAFeter(40, '2026-08-01', fetes, '2026-09-09')).toBeNull();
  });

  it('celebrates again after a real break that followed the last celebration', () => {
    const fetes = { debutSerie: '2026-08-01', paliers: [7, 30], celebreLe: '2026-09-05' };
    expect(palierAFeter(7, '2026-09-10', fetes, '2026-09-16')?.palier).toBe(7);
  });

  it('estimates the celebration day of a record written before celebreLe existed', () => {
    // Fêté à 30 : au plus tôt le 30 août. Un début au 4 août est donc la
    // même série.
    expect(palierAFeter(37, '2026-08-04', { debutSerie: '2026-08-01', paliers: [7, 30] }, '2026-09-09')).toBeNull();
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
    // `celebreLe` relit quand il est présent, et une valeur d'un autre type
    // fait rejeter l'enregistrement plutôt que de fausser la règle.
    ecrirePaliersFetes({ debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-07' }, stockage);
    expect(lirePaliersFetes(stockage)).toEqual({ debutSerie: '2026-09-01', paliers: [7], celebreLe: '2026-09-07' });
    stockage.valeurs.set(CLE_PALIERS_FETES, JSON.stringify({ debutSerie: '2026-09-01', paliers: [7], celebreLe: 12 }));
    expect(lirePaliersFetes(stockage)).toBeNull();
  });
});

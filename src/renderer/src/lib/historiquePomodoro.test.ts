import { describe, expect, it } from 'vitest';
import {
  CLE_HISTORIQUE_POMODORO,
  JOURS_CONSERVES,
  ajouterCycle,
  derniersJours,
  ecrireHistorique,
  lireHistorique,
} from './historiquePomodoro';
import type { StockageLike } from './preferencesAffichage';

function stockageMemoire(): StockageLike & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>();
  return { valeurs, getItem: (c) => valeurs.get(c) ?? null, setItem: (c, v) => void valeurs.set(c, v) };
}

const stockageQuiLeve: StockageLike = {
  getItem: () => {
    throw new Error('refusé');
  },
  setItem: () => {
    throw new Error('refusé');
  },
};

describe('ajouterCycle', () => {
  const now = new Date(2026, 8, 10, 15);

  it('adds a cycle and its minutes to the local day', () => {
    const une = ajouterCycle({}, 25, now);
    const deux = ajouterCycle(une, 50, now);
    expect(deux).toEqual({ '2026-09-10': { cycles: 2, minutes: 75 } });
    expect(une).toEqual({ '2026-09-10': { cycles: 1, minutes: 25 } });
  });

  it('forgets days beyond the retention window', () => {
    const ancien = { '2026-01-01': { cycles: 3, minutes: 75 }, '2026-09-01': { cycles: 1, minutes: 25 } };
    const resultat = ajouterCycle(ancien, 25, now);
    expect(Object.keys(resultat).sort()).toEqual(['2026-09-01', '2026-09-10']);
    expect(JOURS_CONSERVES).toBeGreaterThanOrEqual(7);
  });
});

describe('derniersJours', () => {
  it('returns the last seven days oldest first, today flagged, missing days at zero', () => {
    const now = new Date(2026, 8, 10, 15);
    const jours = derniersJours({ '2026-09-10': { cycles: 2, minutes: 50 }, '2026-09-05': { cycles: 1, minutes: 25 } }, 7, now);
    expect(jours).toHaveLength(7);
    expect(jours[0].date.getDate()).toBe(4);
    expect(jours[1]).toMatchObject({ cycles: 1, minutes: 25, estAujourdhui: false });
    expect(jours[6]).toMatchObject({ cycles: 2, minutes: 50, estAujourdhui: true });
    expect(jours[3]).toMatchObject({ cycles: 0, minutes: 0 });
  });
});

describe('lireHistorique / ecrireHistorique', () => {
  it('reads back what was written', () => {
    const stockage = stockageMemoire();
    ecrireHistorique({ '2026-09-10': { cycles: 2, minutes: 50 } }, stockage);
    expect(lireHistorique(stockage)).toEqual({ '2026-09-10': { cycles: 2, minutes: 50 } });
  });

  it('drops malformed days but keeps the valid ones', () => {
    const stockage = stockageMemoire();
    stockage.valeurs.set(
      CLE_HISTORIQUE_POMODORO,
      JSON.stringify({ '2026-09-10': { cycles: 2, minutes: 50 }, hier: { cycles: 1, minutes: 5 }, '2026-09-09': { cycles: 'x' } })
    );
    expect(lireHistorique(stockage)).toEqual({ '2026-09-10': { cycles: 2, minutes: 50 } });
  });

  it('falls back to an empty history on unreadable values or refused storage', () => {
    const stockage = stockageMemoire();
    stockage.valeurs.set(CLE_HISTORIQUE_POMODORO, '{oups');
    expect(lireHistorique(stockage)).toEqual({});
    expect(lireHistorique(stockageQuiLeve)).toEqual({});
    expect(() => ecrireHistorique({}, stockageQuiLeve)).not.toThrow();
  });
});

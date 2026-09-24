import { describe, expect, it } from 'vitest';
import {
  CLE_RAIL_EPINGLE,
  ecrireRailEpingle,
  lireRailEpingle,
  type StockageLike,
} from './preferencesAffichage';

function stockageFactice(initial: Record<string, string> = {}): StockageLike & { donnees: Record<string, string> } {
  const donnees = { ...initial };
  return {
    donnees,
    getItem: (cle) => donnees[cle] ?? null,
    setItem: (cle, valeur) => {
      donnees[cle] = valeur;
    },
  };
}

const stockageQuiLeve: StockageLike = {
  getItem() {
    throw new DOMException('refusé');
  },
  setItem() {
    throw new DOMException('refusé');
  },
};

describe('lireRailEpingle', () => {
  it('lit un rail épinglé', () => {
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: 'true' }))).toBe(true);
  });

  it('rend « replié » quand la clé est absente', () => {
    // Le défaut compte : c'est l'état au tout premier lancement.
    expect(lireRailEpingle(stockageFactice())).toBe(false);
  });

  it('rend « replié » sur une valeur corrompue', () => {
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: 'oui' }))).toBe(false);
    expect(lireRailEpingle(stockageFactice({ [CLE_RAIL_EPINGLE]: '' }))).toBe(false);
  });

  it('rend « replié » quand le stockage lève', () => {
    // Un rail qui refuserait de se peindre parce qu'une lecture a levé
    // serait un échec absurde.
    expect(lireRailEpingle(stockageQuiLeve)).toBe(false);
  });

  it('rend « replié » sans stockage du tout', () => {
    expect(lireRailEpingle(null)).toBe(false);
  });
});

describe('ecrireRailEpingle', () => {
  it('écrit les deux états', () => {
    const s = stockageFactice();
    ecrireRailEpingle(true, s);
    expect(s.donnees[CLE_RAIL_EPINGLE]).toBe('true');
    ecrireRailEpingle(false, s);
    expect(s.donnees[CLE_RAIL_EPINGLE]).toBe('false');
  });

  it("n'explose pas quand le stockage lève", () => {
    // Perdre une préférence d'affichage ne mérite pas de faire tomber
    // l'écran qui la porte.
    expect(() => ecrireRailEpingle(true, stockageQuiLeve)).not.toThrow();
  });

  it("n'explose pas sans stockage du tout", () => {
    expect(() => ecrireRailEpingle(true, null)).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { depuisChampDateHeure, erreurSaisieSeance, versChampDateHeure, raccourcisQuand } from './seances';

describe('versChampDateHeure / depuisChampDateHeure', () => {
  it('round-trips a local date and time', () => {
    const iso = new Date(2026, 8, 28, 18, 5).toISOString();
    expect(versChampDateHeure(iso)).toBe('2026-09-28T18:05');
    expect(depuisChampDateHeure('2026-09-28T18:05')).toBe(iso);
  });

  it('rejects empty or malformed values', () => {
    expect(depuisChampDateHeure('')).toBeNull();
    expect(depuisChampDateHeure('28/09/2026 18:05')).toBeNull();
  });
});

describe('erreurSaisieSeance', () => {
  const now = new Date(2026, 8, 28, 20, 0);
  const ok = { duree: '30', dateHeure: '2026-09-28T18:05' };

  it('accepts a valid past session, and zero minutes (a ticked task)', () => {
    expect(erreurSaisieSeance(ok, now)).toBeNull();
    expect(erreurSaisieSeance({ ...ok, duree: '0' }, now)).toBeNull();
  });

  it('rejects negative, fractional or absurd durations', () => {
    expect(erreurSaisieSeance({ ...ok, duree: '-5' }, now)).toMatch(/entier/);
    expect(erreurSaisieSeance({ ...ok, duree: '12.5' }, now)).toMatch(/entier/);
    expect(erreurSaisieSeance({ ...ok, duree: '' }, now)).toMatch(/entier/);
    expect(erreurSaisieSeance({ ...ok, duree: '1500' }, now)).toMatch(/24 heures/);
  });

  it('rejects an invalid or future date', () => {
    expect(erreurSaisieSeance({ ...ok, dateHeure: 'demain' }, now)).toMatch(/invalides/);
    expect(erreurSaisieSeance({ ...ok, dateHeure: '2026-09-29T09:00' }, now)).toMatch(/futur/);
  });
});

describe('raccourcisQuand', () => {
  it('ne propose rien dans le futur', () => {
    const tot = raccourcisQuand(new Date(2026, 8, 28, 8, 0));
    expect(tot.map((r) => r.libelle)).toEqual(['Hier soir']);
    expect(tot[0].valeur).toBe('2026-09-27T20:00');
    const soir = raccourcisQuand(new Date(2026, 8, 28, 18, 30));
    expect(soir.map((r) => r.libelle)).toEqual(['Ce matin', 'Cet après-midi', 'Hier soir']);
  });
});

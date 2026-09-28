import { describe, expect, it } from 'vitest';
import {
  AUCUN_REPOS,
  CLE_JOURS_REPOS,
  ecrireJoursRepos,
  estJourDeRepos,
  estJourDeReposLocal,
  lireJoursRepos,
  normaliserJoursRepos,
} from './joursRepos';
import { calculateBestStreak, calculateStreak, currentStreakStart } from './streaks';
import type { StockageLike } from './preferencesAffichage';

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

// Lundi 31 août 2026 ; le 30 est un dimanche (0), le 29 un samedi (6).
const LUNDI = new Date('2026-08-31T18:00:00Z');
const seance = (jour: string) => ({ practicedAt: `${jour}T09:00:00Z` });

describe('estJourDeRepos', () => {
  it('reconnaît un jour de la semaine et une date ponctuelle', () => {
    const repos = { hebdo: [0], dates: ['2026-08-27'] };
    expect(estJourDeRepos(new Date('2026-08-30T12:00:00Z'), repos)).toBe(true);
    expect(estJourDeRepos(new Date('2026-08-27T23:59:00Z'), repos)).toBe(true);
    expect(estJourDeRepos(new Date('2026-08-28T00:00:00Z'), repos)).toBe(false);
  });
});

describe('estJourDeReposLocal', () => {
  it('lit le jour local, même à minuit', () => {
    const repos = { hebdo: [0], dates: ['2026-09-30'] };
    expect(estJourDeReposLocal(new Date(2026, 8, 27), repos)).toBe(true); // dimanche 27
    expect(estJourDeReposLocal(new Date(2026, 8, 28), repos)).toBe(false);
    expect(estJourDeReposLocal(new Date(2026, 8, 30), repos)).toBe(true);
  });
});

describe('séries et jours de repos', () => {
  it('un dimanche de repos ne casse pas la série', () => {
    const entries = [seance('2026-08-31'), seance('2026-08-29'), seance('2026-08-28')];
    expect(calculateStreak(entries, LUNDI)).toBe(1);
    expect(calculateStreak(entries, LUNDI, { hebdo: [0], dates: [] })).toBe(3);
    expect(currentStreakStart(entries, LUNDI, { hebdo: [0], dates: [] })).toBe('2026-08-28');
  });

  it('pratiquer un jour de repos compte normalement', () => {
    const entries = [seance('2026-08-31'), seance('2026-08-30'), seance('2026-08-29')];
    expect(calculateStreak(entries, LUNDI, { hebdo: [0], dates: [] })).toBe(3);
  });

  it('hier en repos et aujourd’hui pas encore pratiqué : la série tient', () => {
    const entries = [seance('2026-08-29'), seance('2026-08-28')];
    expect(calculateStreak(entries, LUNDI, { hebdo: [], dates: ['2026-08-30'] })).toBe(2);
    expect(calculateStreak(entries, LUNDI)).toBe(0);
  });

  it('un jour vide hors repos coupe toujours la série', () => {
    const entries = [seance('2026-08-31'), seance('2026-08-28')];
    expect(calculateStreak(entries, LUNDI, { hebdo: [0], dates: [] })).toBe(1);
  });

  it('pas de série en cours, même si tous les jours sont des repos', () => {
    const tous = { hebdo: [0, 1, 2, 3, 4, 5, 6], dates: [] };
    expect(calculateStreak([], LUNDI, tous)).toBe(0);
    expect(currentStreakStart([], LUNDI, tous)).toBeNull();
    // Des repos partout : la série couvre tous les jours pratiqués, et la
    // remontée s'arrête à la plus ancienne séance au lieu de boucler.
    expect(calculateStreak([seance('2026-08-01'), seance('2026-07-01')], LUNDI, tous)).toBe(2);
  });

  it('le record enjambe les jours de repos', () => {
    const entries = [seance('2026-08-24'), seance('2026-08-22'), seance('2026-08-21'), seance('2026-08-10')];
    expect(calculateBestStreak(entries)).toBe(2);
    expect(calculateBestStreak(entries, { hebdo: [0], dates: [] })).toBe(3);
  });
});

describe('stockage des jours de repos', () => {
  it('relit ce qui a été écrit, trié et sans doublon', () => {
    const stockage = stockageFactice();
    ecrireJoursRepos({ hebdo: [6, 0, 6], dates: ['2026-09-02', '2026-09-01'] }, LUNDI, stockage);
    expect(lireJoursRepos(stockage)).toEqual({ hebdo: [0, 6], dates: ['2026-09-01', '2026-09-02'] });
  });

  it('oublie les dates ponctuelles trop anciennes', () => {
    const stockage = stockageFactice();
    ecrireJoursRepos({ hebdo: [], dates: ['2024-01-01', '2026-08-01'] }, LUNDI, stockage);
    expect(lireJoursRepos(stockage).dates).toEqual(['2026-08-01']);
  });

  it('retombe sur aucun repos si la valeur est corrompue ou le stockage refusé', () => {
    expect(lireJoursRepos(stockageFactice({ [CLE_JOURS_REPOS]: '{pas du json' }))).toEqual(AUCUN_REPOS);
    expect(lireJoursRepos(null)).toEqual(AUCUN_REPOS);
    expect(normaliserJoursRepos({ hebdo: [9, -1, 1.5, 'x', 2], dates: ['hier', 3, '2026-08-30'] })).toEqual({
      hebdo: [2],
      dates: ['2026-08-30'],
    });
  });
});

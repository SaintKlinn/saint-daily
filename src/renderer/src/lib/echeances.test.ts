import { describe, expect, it } from 'vitest';
import {
  echeanceDepuisChamp,
  echeancesProches,
  echeanceVersChamp,
  joursAvantEcheance,
  jourDansLaSemaine,
  libelleEcheance,
  prochainesDates,
} from './echeances';

// Lundi 28 septembre 2026, 18 h, heure locale de la machine de test.
const NOW = new Date(2026, 8, 28, 18);

describe('champ date', () => {
  it('fait l’aller-retour sans changer de jour', () => {
    const iso = echeanceDepuisChamp('2026-10-05');
    expect(iso).not.toBeNull();
    expect(echeanceVersChamp(iso)).toBe('2026-10-05');
  });

  it('refuse une valeur vide ou impossible', () => {
    expect(echeanceDepuisChamp('')).toBeNull();
    expect(echeanceDepuisChamp('2026-02-30')).toBeNull();
    expect(echeanceVersChamp(null)).toBe('');
  });
});

describe('délai', () => {
  it('compte en jours locaux, quelle que soit l’heure', () => {
    expect(joursAvantEcheance(new Date(2026, 8, 28, 0, 5).toISOString(), NOW)).toBe(0);
    expect(joursAvantEcheance(new Date(2026, 8, 29, 23).toISOString(), NOW)).toBe(1);
    expect(joursAvantEcheance(new Date(2026, 8, 25, 12).toISOString(), NOW)).toBe(-3);
  });

  it('se lit en toutes lettres', () => {
    expect(libelleEcheance(-3)).toBe('En retard de 3 jours');
    expect(libelleEcheance(-1)).toBe('En retard depuis hier');
    expect(libelleEcheance(0)).toBe("Aujourd'hui");
    expect(libelleEcheance(1)).toBe('Demain');
    expect(libelleEcheance(9)).toBe('Dans 9 jours');
    expect(libelleEcheance(21)).toBe('Dans 3 semaines');
    expect(libelleEcheance(90)).toBe('Dans 3 mois');
  });
});

describe('echeancesProches', () => {
  const projet = (id: string, dueAt: string | null, extra = {}) => ({
    id,
    isProject: true,
    archivedAt: null as string | null,
    dueAt,
    ...extra,
  });

  it('garde les retards et l’horizon, les plus pressants d’abord', () => {
    const liste = [
      projet('loin', echeanceDepuisChamp('2026-11-30')),
      projet('semaine', echeanceDepuisChamp('2026-10-03')),
      projet('retard', echeanceDepuisChamp('2026-09-20')),
      projet('sans', null),
      projet('archive', echeanceDepuisChamp('2026-09-29'), { archivedAt: '2026-09-01T00:00:00Z' }),
      { id: 'tache', isProject: false, archivedAt: null, dueAt: echeanceDepuisChamp('2026-09-29') },
    ];
    expect(echeancesProches(liste, NOW).map(({ projet: p, jours }) => [p.id, jours])).toEqual([
      ['retard', -8],
      ['semaine', 5],
    ]);
  });
});

describe('prochainesDates', () => {
  it('garde les tâches à venir, sans les passées ni les sautées, dans l’ordre', () => {
    const t = (id: string, scheduledAt: string | null, extra = {}) => ({
      id,
      scheduledAt,
      skippedAt: null as string | null,
      archivedAt: null as string | null,
      ...extra,
    });
    const membres = [
      t('skill', null),
      t('demain', new Date(2026, 8, 29, 9).toISOString()),
      t('ce-matin', new Date(2026, 8, 28, 8).toISOString()),
      t('hier', new Date(2026, 8, 27, 9).toISOString()),
      t('sautee', new Date(2026, 8, 30, 9).toISOString(), { skippedAt: '2026-09-28T00:00:00Z' }),
    ];
    expect(prochainesDates(membres, NOW).map((m) => m.id)).toEqual(['ce-matin', 'demain']);
  });
});

describe('jourDansLaSemaine', () => {
  it('place l’échéance dans la semaine affichée', () => {
    const lundi = new Date(2026, 8, 28);
    expect(jourDansLaSemaine(echeanceDepuisChamp('2026-10-04') as string, lundi)).toBe(6);
    expect(jourDansLaSemaine(echeanceDepuisChamp('2026-10-05') as string, lundi)).toBeNull();
  });
});

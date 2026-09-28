import { describe, expect, it } from 'vitest';
import { filterJournalEntries, grouperParJour, libelleJour } from './journal';

const entries = [
  { id: '1', engagementName: 'Guitare', note: 'Travaillé les Barrés', tags: ['technique'], practicedAt: '2026-09-03T09:00:00Z' },
  { id: '2', engagementName: 'Cuir', note: null, tags: ['Atelier'], practicedAt: '2026-09-05T09:00:00Z' },
  { id: '3', engagementName: 'Guitare', note: 'Séance courte', tags: [], practicedAt: '2026-09-04T09:00:00Z' },
  { id: '4', engagementName: 'Echecs', note: 'Partie rejouee sans erreur', tags: ['decouverte'], practicedAt: '2026-09-06T09:00:00Z' },
];

describe('filterJournalEntries', () => {
  it('returns everything for an empty search', () => {
    expect(filterJournalEntries(entries, '')).toHaveLength(4);
    expect(filterJournalEntries(entries, '   ')).toHaveLength(4);
  });

  it('matches a note case-insensitively', () => {
    expect(filterJournalEntries(entries, 'barrés').map((e) => e.id)).toEqual(['1']);
  });

  it('matches a tag case-insensitively', () => {
    expect(filterJournalEntries(entries, 'atelier').map((e) => e.id)).toEqual(['2']);
  });

  it('matches the engagement name', () => {
    expect(filterJournalEntries(entries, 'guitare').map((e) => e.id).sort()).toEqual(['1', '3']);
  });

  it('survives an entry with no note', () => {
    expect(() => filterJournalEntries(entries, 'cuir')).not.toThrow();
    expect(filterJournalEntries(entries, 'cuir').map((e) => e.id)).toEqual(['2']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterJournalEntries(entries, 'zzz')).toEqual([]);
  });

  it('matches accented text with an unaccented query', () => {
    expect(filterJournalEntries(entries, 'seance').map((e) => e.id)).toEqual(['3']);
    expect(filterJournalEntries(entries, 'barres').map((e) => e.id)).toEqual(['1']);
  });

  it('matches unaccented text with an accented query', () => {
    expect(filterJournalEntries(entries, 'Échecs').map((e) => e.id)).toEqual(['4']);
    expect(filterJournalEntries(entries, 'rejouée').map((e) => e.id)).toEqual(['4']);
    expect(filterJournalEntries(entries, 'découverte').map((e) => e.id)).toEqual(['4']);
  });
});

describe('grouperParJour', () => {
  const at = (d: number, h: number) => ({ date: new Date(2026, 8, d, h) });

  it('groups consecutive rows by local day, keeping their order', () => {
    const lignes = [at(28, 20), at(28, 9), at(27, 23), at(25, 8)];
    const groupes = grouperParJour(lignes, (l) => l.date);
    expect(groupes.map((g) => [g.cle, g.lignes.length])).toEqual([
      ['2026-09-28', 2],
      ['2026-09-27', 1],
      ['2026-09-25', 1],
    ]);
    expect(groupes[0].lignes[0]).toBe(lignes[0]);
  });

  it('returns no group for no rows', () => {
    expect(grouperParJour([], () => new Date())).toEqual([]);
  });
});

describe('libelleJour', () => {
  const now = new Date(2026, 8, 28, 15);

  it('names today and yesterday', () => {
    expect(libelleJour(new Date(2026, 8, 28, 1), now)).toBe("Aujourd'hui");
    expect(libelleJour(new Date(2026, 8, 27, 23), now)).toBe('Hier');
  });

  it('spells out older days, with the year only when it differs', () => {
    expect(libelleJour(new Date(2026, 8, 22, 9), now)).toBe('mardi 22 septembre');
    expect(libelleJour(new Date(2025, 11, 31, 9), now)).toBe('mercredi 31 décembre 2025');
  });
});

import { describe, expect, it } from 'vitest';
import { filterJournalEntries } from './journal';

const entries = [
  { id: '1', engagementName: 'Guitare', note: 'Travaillé les Barrés', tags: ['technique'], practicedAt: '2026-09-03T09:00:00Z' },
  { id: '2', engagementName: 'Cuir', note: null, tags: ['Atelier'], practicedAt: '2026-09-05T09:00:00Z' },
  { id: '3', engagementName: 'Guitare', note: 'Séance courte', tags: [], practicedAt: '2026-09-04T09:00:00Z' },
];

describe('filterJournalEntries', () => {
  it('returns everything for an empty search', () => {
    expect(filterJournalEntries(entries, '')).toHaveLength(3);
    expect(filterJournalEntries(entries, '   ')).toHaveLength(3);
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
});

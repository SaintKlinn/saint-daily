import { describe, expect, it } from 'vitest';
import { toCsv, toJson, type ExportBundle } from './exportData';

const bundle: ExportBundle = {
  exportedAt: '2026-09-12T10:00:00.000Z',
  engagements: [
    {
      id: 'e1',
      name: 'Guitare',
      notes: null,
      tags: ['Musique', 'Perso'],
      genericLevel: 'debutant',
      archivedAt: null,
      scheduledAt: null,
      scheduledEndsAt: null,
      priority: 'aucune',
      recurrenceType: 'aucune',
      isProject: false,
      projectId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      milestones: [
        { id: 'm1', label: 'Premier morceau', completedAt: null, position: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      entries: [
        {
          id: 'p1',
          engagementId: 'e1',
          durationMinutes: 30,
          note: 'Bonne séance, gammes ; puis "Blackbird"',
          practicedAt: '2026-09-02T09:00:00.000Z',
          createdAt: '2026-09-02T09:00:00.000Z',
        },
        {
          id: 'p2',
          engagementId: 'e1',
          durationMinutes: 0,
          note: null,
          practicedAt: '2026-09-01T09:00:00.000Z',
          createdAt: '2026-09-01T09:00:00.000Z',
        },
      ],
    },
  ],
};

describe('toJson', () => {
  it('round-trips the whole bundle', () => {
    expect(JSON.parse(toJson(bundle))).toEqual(bundle);
  });

  it('keeps milestones nested under their engagement', () => {
    const parsed = JSON.parse(toJson(bundle));
    expect(parsed.engagements[0].milestones).toHaveLength(1);
  });
});

// Le BOM est écrit `\ufeff` partout dans ces tests, jamais collé
// littéralement : un caractère invisible ne survit pas fiablement à un
// copier-coller, et un test qui le perd passerait pour de mauvaises
// raisons.
const BOM = '\ufeff';

describe('toCsv', () => {
  it('starts with a BOM so Excel reads the accents', () => {
    expect(toCsv(bundle).startsWith(BOM)).toBe(true);
  });

  it('writes one row per entry, oldest first, under a header', () => {
    const lines = toCsv(bundle).split('\r\n');
    expect(lines[0]).toBe(`${BOM}Date;Engagement;Tags;Durée (min);Note`);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-09-01T09:00:00.000Z');
    expect(lines[2]).toContain('2026-09-02T09:00:00.000Z');
  });

  it('joins multiple tags with a comma so each stays readable', () => {
    const line = toCsv(bundle).split('\r\n')[1];
    expect(line).toContain('Musique, Perso');
  });

  it('quotes and escapes a note containing a semicolon and quotes', () => {
    const line = toCsv(bundle).split('\r\n')[2];
    expect(line).toContain('"Bonne séance, gammes ; puis ""Blackbird"""');
  });

  it('writes an empty cell for a missing note and keeps a zero duration', () => {
    const line = toCsv(bundle).split('\r\n')[1];
    expect(line.endsWith(';')).toBe(true);
    expect(line).toContain(';0;');
  });

  it('produces just the header when there is nothing to export', () => {
    const empty: ExportBundle = { exportedAt: bundle.exportedAt, engagements: [] };
    expect(toCsv(empty)).toBe(BOM + 'Date;Engagement;Tags;Durée (min);Note');
  });

  // `localeCompare` réordonnait ces deux lignes à l'envers : les règles
  // linguistiques qu'il applique ignorent la vraie chronologie ISO-8601
  // d'un timestamp à fraction de seconde.
  it('sorts fractional-second timestamps in true chronological order', () => {
    const withFraction: ExportBundle = {
      exportedAt: bundle.exportedAt,
      engagements: [
        {
          ...bundle.engagements[0],
          entries: [
            { id: 'p3', engagementId: 'e1', durationMinutes: 5, note: null, practicedAt: '2026-09-01T09:00:00.5+00:00', createdAt: '2026-09-01T09:00:00.5+00:00' },
            { id: 'p4', engagementId: 'e1', durationMinutes: 5, note: null, practicedAt: '2026-09-01T09:00:00+00:00', createdAt: '2026-09-01T09:00:00+00:00' },
          ],
        },
      ],
    };
    const lines = toCsv(withFraction).split('\r\n');
    expect(lines[1]).toContain('2026-09-01T09:00:00+00:00');
    expect(lines[2]).toContain('2026-09-01T09:00:00.5+00:00');
  });
});

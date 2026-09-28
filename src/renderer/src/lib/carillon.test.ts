import { describe, expect, it } from 'vitest';
import { jouerCarillon, notesCarillon } from './carillon';

describe('notesCarillon', () => {
  it('rises back to work and falls into a break', () => {
    const travail = notesCarillon('travail').map((n) => n.frequence);
    const pause = notesCarillon('pause').map((n) => n.frequence);
    expect(travail).toEqual([...travail].sort((a, b) => a - b));
    expect(pause).toEqual([...pause].sort((a, b) => b - a));
  });

  it('plays its notes in order, each starting after the previous one', () => {
    for (const type of ['travail', 'pause'] as const) {
      const debuts = notesCarillon(type).map((n) => n.debut);
      expect(debuts).toEqual([...debuts].sort((a, b) => a - b));
      expect(new Set(debuts).size).toBe(debuts.length);
    }
  });
});

describe('jouerCarillon', () => {
  it('stays silent without throwing when there is no audio (tests run without Web Audio)', () => {
    expect(() => jouerCarillon('travail')).not.toThrow();
  });
});

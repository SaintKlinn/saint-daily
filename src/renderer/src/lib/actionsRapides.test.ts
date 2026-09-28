import { describe, expect, it } from 'vitest';
import { choisirSkillsRapides } from './actionsRapides';

const SKILLS = [
  { id: 'a', name: 'Piano' },
  { id: 'b', name: 'Espagnol' },
  { id: 'c', name: 'Dessin' },
  { id: 'd', name: 'Code' },
];

describe('choisirSkillsRapides', () => {
  it('met les plus récents d’abord, sans doublon, et ignore les inconnus', () => {
    expect(choisirSkillsRapides(SKILLS, ['c', 'x', 'a', 'c', 'a'], 2).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('complète par ordre alphabétique', () => {
    expect(choisirSkillsRapides(SKILLS, ['a'], 3).map((s) => s.name)).toEqual(['Piano', 'Code', 'Dessin']);
  });

  it('sans skill, rien à proposer', () => {
    expect(choisirSkillsRapides([], ['a'])).toEqual([]);
  });
});

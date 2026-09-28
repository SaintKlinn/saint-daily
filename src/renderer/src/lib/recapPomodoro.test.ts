import { describe, expect, it } from 'vitest';
import { ajouterAuRecap, resumeRecap } from './recapPomodoro';

describe('ajouterAuRecap', () => {
  it('appends engagements in the order they were worked, merging a return to the same one', () => {
    let lignes = ajouterAuRecap([], 'Piano', 25);
    lignes = ajouterAuRecap(lignes, 'Dessin', 50);
    lignes = ajouterAuRecap(lignes, 'Piano', 10);
    expect(lignes).toEqual([
      { nom: 'Piano', minutes: 35 },
      { nom: 'Dessin', minutes: 50 },
    ]);
  });

  it('ignores zero minutes', () => {
    expect(ajouterAuRecap([], 'Piano', 0)).toEqual([]);
  });
});

describe('resumeRecap', () => {
  it('names the single engagement', () => {
    expect(resumeRecap({ cycles: 3, engagements: [{ nom: 'Piano', minutes: 75 }] })).toEqual({
      titre: '3 cycles terminés',
      detail: '1h 15 enregistrées sur Piano.',
    });
  });

  it('lists every engagement after a switch', () => {
    expect(
      resumeRecap({
        cycles: 1,
        engagements: [
          { nom: 'Piano', minutes: 25 },
          { nom: 'Dessin', minutes: 12 },
        ],
      })
    ).toEqual({ titre: '1 cycle terminé', detail: '37 min enregistrées : Piano 25 min, Dessin 12 min.' });
  });

  it('covers a session stopped before its first full cycle', () => {
    expect(resumeRecap({ cycles: 0, engagements: [{ nom: 'Piano', minutes: 1 }] })).toEqual({
      titre: 'Session terminée',
      detail: '1 min enregistrée sur Piano.',
    });
  });

  it('says nothing when nothing happened', () => {
    expect(resumeRecap({ cycles: 0, engagements: [] })).toBeNull();
  });
});

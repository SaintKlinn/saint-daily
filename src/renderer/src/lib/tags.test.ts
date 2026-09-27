import { describe, expect, it } from 'vitest';
import { analyserTags } from './tags';

describe('analyserTags', () => {
  it('rend une liste vide sur une saisie vide', () => {
    // Surtout pas `['']` : un tag vide se retrouverait en base et
    // apparaîtrait comme un filtre sans libellé dans la liste des tags.
    expect(analyserTags('')).toEqual([]);
  });

  it('taille les blancs autour des virgules', () => {
    // Le cas normal de la frappe.
    expect(analyserTags('Maison , Artisanat ,Bois')).toEqual(['Maison', 'Artisanat', 'Bois']);
  });

  it('ignore les virgules en trop, en tête, en fin et doublées', () => {
    expect(analyserTags(',Maison,,Bois,')).toEqual(['Maison', 'Bois']);
  });

  it("rend une liste vide quand la saisie n'est que virgules et blancs", () => {
    expect(analyserTags(' , ,, ')).toEqual([]);
  });

  it('dédoublonne le même tag saisi deux fois', () => {
    // C'est la raison d'être de cette fonction : un champ qu'on rouvre et
    // réenregistre accumule les doublons, là où un formulaire de création
    // rempli une fois ne le fait pas.
    expect(analyserTags('Maison, Bois, Maison')).toEqual(['Maison', 'Bois']);
  });

  it('dédoublonne sans tenir compte de la casse, en gardant la première orthographe', () => {
    // `filterByTag` (lib/streaks.ts) compare en minuscules, donc « Maison »
    // et « maison » sélectionnent déjà les mêmes éléments. Mais la liste de
    // tags de l'écran Skills les compte séparément, donc les deux
    // apparaîtraient comme deux filtres distincts menant au même résultat.
    expect(analyserTags('Maison, maison, MAISON')).toEqual(['Maison']);
  });
});

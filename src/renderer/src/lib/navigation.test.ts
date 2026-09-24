import { describe, expect, it } from 'vitest';
import { ENTREES_NAV, GROUPES_NAV } from './navigation';

describe('groupes de navigation', () => {
  it('range les entrées par horizon de temps', () => {
    // Aujourd'hui d'abord, puis ce qui revient, puis le long terme ; puis
    // le regard en arrière, où l'on consigne avant de relire ; puis
    // Réglages, qui n'appartient à aucun des deux.
    expect(ENTREES_NAV.map((e) => e.to)).toEqual([
      '/',
      '/calendrier',
      '/skills',
      '/projets',
      '/journal',
      '/bilan',
      '/reglages',
    ]);
  });

  it('découpe en trois groupes de 4, 2 et 1', () => {
    expect(GROUPES_NAV.map((g) => g.entrees.length)).toEqual([4, 2, 1]);
  });

  it('n’ancre en bas que le dernier groupe', () => {
    expect(GROUPES_NAV.filter((g) => g.ancreEnBas)).toHaveLength(1);
    expect(GROUPES_NAV.at(-1)?.ancreEnBas).toBe(true);
  });

  it('ne cite aucune route ni aucune clé d’icône deux fois', () => {
    // Deux entrées sur la même clé d'icône rendraient le rail illisible
    // exactement comme avant ce chantier — c'est le symptôme d'origine.
    const routes = ENTREES_NAV.map((e) => e.to);
    expect(new Set(routes).size).toBe(routes.length);
    const icones = ENTREES_NAV.map((e) => e.icone);
    expect(new Set(icones).size).toBe(icones.length);
  });

  it('ne marque `exact` que la racine', () => {
    // Sans `end` sur « / », la racine reste active sur toutes les routes
    // filles ; avec `end` sur une autre entrée, celle-ci s'éteint sur ses
    // propres sous-routes (/skills/:id, /projets/:id).
    expect(ENTREES_NAV.filter((e) => e.exact).map((e) => e.to)).toEqual(['/']);
  });

  it('donne un libellé non vide à chaque entrée', () => {
    // Le libellé est le nom accessible du lien : vide, l'entrée devient
    // inatteignable au lecteur d'écran.
    for (const e of ENTREES_NAV) expect(e.libelle.trim(), e.to).not.toBe('');
  });
});

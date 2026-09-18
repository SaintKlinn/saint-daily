import { describe, expect, it } from 'vitest';
import { espacement, fontSize } from './typographie';

describe('échelle typographique', () => {
  it('expose exactement les six rôles de la spec', () => {
    expect(Object.keys(fontSize)).toEqual([
      'libelle',
      'secondaire',
      'corps',
      'titre',
      'titre-ecran',
      'heros',
    ]);
  });

  it('porte les tailles de la spec', () => {
    expect(fontSize.libelle[0]).toBe('11px');
    expect(fontSize.secondaire[0]).toBe('13px');
    expect(fontSize.corps[0]).toBe('15px');
    expect(fontSize.titre[0]).toBe('20px');
    expect(fontSize['titre-ecran'][0]).toBe('28px');
    expect(fontSize.heros[0]).toBe('40px');
  });

  it('donne un interlignage explicite à chaque palier', () => {
    // C'est le point du correctif : aucun palier ne doit laisser la
    // hauteur de ligne à `normal`.
    for (const [role, [, meta]] of Object.entries(fontSize)) {
      expect(meta.lineHeight, role).toBeTruthy();
      expect(Number(meta.lineHeight), role).toBeGreaterThan(1);
    }
  });

  it('culmine sur le corps, puis resserre à mesure que la taille monte', () => {
    // La courbe n'est pas monotone et ne doit pas l'être : elle monte
    // jusqu'au corps, qui est le seul palier à porter du texte suivi et
    // donc celui qui a le plus besoin d'air entre ses lignes, puis
    // redescend — un titre de 40 px avec un rapport de 1,6 serait déchiré.
    const lh = (r: keyof typeof fontSize) => Number(fontSize[r][1].lineHeight);

    expect(lh('corps')).toBeGreaterThan(lh('secondaire'));
    expect(lh('secondaire')).toBeGreaterThan(lh('libelle'));

    // À partir du corps, strictement décroissant.
    expect(lh('titre')).toBeLessThan(lh('corps'));
    expect(lh('titre-ecran')).toBeLessThan(lh('titre'));
    expect(lh('heros')).toBeLessThan(lh('titre-ecran'));

    // Et aucun palier de petite taille ne descend sous 1,4 : c'est le
    // plancher qui produit « l'air » dans les textes courts.
    for (const r of ['libelle', 'secondaire', 'corps'] as const) {
      expect(lh(r), r).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('donne à chaque palier la graisse que la spec lui attribue', () => {
    // Épinglé rôle par rôle, et non « l'une des trois valeurs permises » :
    // cette seconde version laissait passer un échange de graisses entre
    // rôles — `heros` monté à 500, `titre` à 600 — qui aurait satisfait le
    // test tout en contredisant la spec (§1 et « Les graisses »).
    //
    // Les raisons de ces attributions, pour qui serait tenté d'en changer :
    // `libelle` est en 600 parce que des capitales mono à 11 px s'effacent
    // sans corps ; `heros` reste en 400 parce qu'à 40 px la graisse
    // n'ajoute rien et alourdit ; `corps` est en 400 pour qu'un
    // `font-semibold` explicite dans le balisage le distingue — c'est ce
    // qui porte les titres de section de carte.
    expect(fontSize.libelle[1].fontWeight).toBe('600');
    expect(fontSize.secondaire[1].fontWeight).toBe('400');
    expect(fontSize.corps[1].fontWeight).toBe('400');
    expect(fontSize.titre[1].fontWeight).toBe('500');
    expect(fontSize['titre-ecran'][1].fontWeight).toBe('500');
    expect(fontSize.heros[1].fontWeight).toBe('400');
  });
});

describe('échelle d’espacement', () => {
  it('expose les sept valeurs de la spec, toutes multiples de 4', () => {
    const px = Object.values(espacement).map((e) => e.px);
    expect(px).toEqual([4, 8, 12, 16, 24, 32, 48]);
    for (const v of px) expect(v % 4).toBe(0);
  });

  it('garde un écart entre groupes valant trois fois l’écart interne', () => {
    // La règle centrale de la spec : 8 dedans contre 24 dehors. Si
    // quelqu’un rapproche ces deux valeurs, le groupement disparaît et
    // les deux symptômes d’origine reviennent.
    expect(espacement.entreGroupes.px).toBe(espacement.interne.px * 3);
  });
});

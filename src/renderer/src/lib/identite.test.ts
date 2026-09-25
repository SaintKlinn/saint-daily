import { describe, expect, it } from 'vitest';
import { pseudonyme, salutation } from './identite';

describe('pseudonyme', () => {
  it('préfère username quand il est présent', () => {
    expect(pseudonyme({ email: 'dev@saintgym.local', user_metadata: { username: 'dev' } })).toBe('dev');
  });

  it('retombe sur la partie locale de l’e-mail sans username', () => {
    expect(pseudonyme({ email: 'jason@example.com', user_metadata: {} })).toBe('jason');
  });

  it('ignore un username vide ou fait d’espaces', () => {
    expect(pseudonyme({ email: 'jason@example.com', user_metadata: { username: '   ' } })).toBe('jason');
  });

  it('rogne les espaces autour du username', () => {
    expect(pseudonyme({ email: 'a@b.c', user_metadata: { username: '  dev  ' } })).toBe('dev');
  });

  it('ignore un username qui n’est pas une chaîne', () => {
    expect(pseudonyme({ email: 'jason@example.com', user_metadata: { username: 42 } })).toBe('jason');
  });

  it('renvoie l’adresse entière quand elle commence par une arobase', () => {
    expect(pseudonyme({ email: '@bizarre.com' })).toBe('@bizarre.com');
  });

  it('renvoie l’adresse entière quand il n’y a pas d’arobase', () => {
    expect(pseudonyme({ email: 'pasuneadresse' })).toBe('pasuneadresse');
  });

  it('renvoie null sans utilisateur, ou sans rien d’affichable', () => {
    expect(pseudonyme(null)).toBeNull();
    expect(pseudonyme(undefined)).toBeNull();
    expect(pseudonyme({})).toBeNull();
    expect(pseudonyme({ email: '   ', user_metadata: null })).toBeNull();
  });
});

describe('salutation', () => {
  it('insère le pseudonyme entre les deux morceaux', () => {
    const s = salutation({ user_metadata: { username: 'Jason' } });
    expect(s).toEqual({ avant: 'Bon retour ', pseudo: 'Jason', apres: '.' });
    expect(s.avant + s.pseudo + s.apres).toBe('Bon retour Jason.');
  });

  it('rend exactement « Bon retour. » quand il n’y a rien d’affichable', () => {
    const s = salutation(null);
    expect(s.pseudo).toBeNull();
    expect(s.avant + s.apres).toBe('Bon retour.');
  });

  it('ne laisse jamais d’espace orphelin sans pseudonyme', () => {
    // Le piège que ce test garde : un `avant` resté à « Bon retour » (sans
    // point) laisserait la phrase inachevée, et « Bon retour » suivi d'une
    // espace laisserait un blanc avant le point.
    const s = salutation({});
    expect(s.avant.endsWith(' ')).toBe(false);
    expect(s.apres).toBe('');
    expect(s.avant + s.apres).toBe('Bon retour.');
  });

  it('retombe sur la partie locale de l’e-mail', () => {
    expect(salutation({ email: 'jason@example.com' }).pseudo).toBe('jason');
  });

  it('rend « Bon retour. » avant que la session soit chargée', () => {
    // `session?.user` vaut `undefined` au premier rendu : c'est le cas réel,
    // pas une hypothèse — la phrase doit déjà être correcte à ce moment-là.
    const s = salutation(undefined);
    expect(s.pseudo).toBeNull();
    expect(s.avant + s.apres).toBe('Bon retour.');
  });
});

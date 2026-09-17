import { describe, expect, it } from 'vitest';
import { initiale, pseudonyme } from './identite';

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

describe('initiale', () => {
  it('met la première lettre en majuscule', () => {
    expect(initiale('dev')).toBe('D');
  });

  it('gère les lettres accentuées', () => {
    expect(initiale('élodie')).toBe('É');
  });

  it('ne coupe pas un caractère hors du plan multilingue de base', () => {
    // Un `[0]` nu rendrait ici une demi-paire de substitution.
    expect(initiale('🚀fusée')).toBe('🚀');
  });

  it('ignore les espaces de tête', () => {
    expect(initiale('  dev')).toBe('D');
  });

  it('renvoie une chaîne vide plutôt que de planter sur une entrée vide', () => {
    expect(initiale('')).toBe('');
    expect(initiale('   ')).toBe('');
  });
});

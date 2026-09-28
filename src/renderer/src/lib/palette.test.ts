import { describe, expect, it } from 'vitest';
import { filtrerCommandes, normaliser, scoreTerme, type Commande } from './palette';

const COMMANDES: Commande[] = [
  { id: 'ecran-accueil', groupe: 'Écrans', libelle: 'Accueil' },
  { id: 'ecran-bilan', groupe: 'Écrans', libelle: 'Bilan', motsCles: ['statistiques', 'stats'] },
  { id: 'ecran-reglages', groupe: 'Écrans', libelle: 'Réglages' },
  { id: 'skill-piano', groupe: 'Skills', libelle: 'Piano' },
  { id: 'pomodoro-piano', groupe: 'Skills', libelle: 'Piano', detail: 'Démarrer un pomodoro', surRecherche: true },
  { id: 'skill-espagnol', groupe: 'Skills', libelle: 'Espagnol' },
];

const ids = (liste: Commande[]) => liste.map((c) => c.id);

describe('normaliser', () => {
  it('retire accents, majuscules et apostrophes', () => {
    expect(normaliser('  Réglages d’Été ')).toBe('reglages d ete');
  });
});

describe('scoreTerme', () => {
  it('préfère le début, puis un début de mot, puis le milieu, puis les lettres dans l’ordre', () => {
    const debut = scoreTerme('pomodoro', 'pom')!;
    const mot = scoreTerme('demarrer un pomodoro', 'pom')!;
    const milieu = scoreTerme('grapomme', 'pom')!;
    const lettres = scoreTerme('piano ouvert matin', 'pom')!;
    expect(debut).toBeGreaterThan(mot);
    expect(mot).toBeGreaterThan(milieu);
    expect(milieu).toBeGreaterThan(lettres);
    expect(scoreTerme('piano', 'z')).toBeNull();
  });
});

describe('filtrerCommandes', () => {
  it('sans recherche, masque les commandes réservées à la recherche', () => {
    expect(ids(filtrerCommandes(COMMANDES, '  '))).not.toContain('pomodoro-piano');
  });

  it('trouve sans accents et par mots clés', () => {
    expect(ids(filtrerCommandes(COMMANDES, 'reglag'))).toEqual(['ecran-reglages']);
    expect(ids(filtrerCommandes(COMMANDES, 'stats'))).toEqual(['ecran-bilan']);
  });

  it('lettres dispersées acceptées dans le libellé, pas dans les mots clés', () => {
    expect(ids(filtrerCommandes(COMMANDES, 'rglg'))).toEqual(['ecran-reglages']);
    expect(ids(filtrerCommandes(COMMANDES, 'sttq'))).toEqual([]);
  });

  it('exige chaque mot, dans le libellé ou le détail', () => {
    expect(ids(filtrerCommandes(COMMANDES, 'piano pomo'))).toEqual(['pomodoro-piano']);
  });

  it('classe le libellé avant le détail, et garde l’ordre à égalité', () => {
    expect(ids(filtrerCommandes(COMMANDES, 'piano'))).toEqual(['skill-piano', 'pomodoro-piano']);
  });
});

import { describe, expect, it } from 'vitest';
import { membresDuProjet, projetPrincipal, projetsDeLEngagement } from './projets';
import type { Engagement, LiaisonProjet } from './types';

// Fabriques locales : `Engagement` a vingt-trois champs dont un seul ou deux
// comptent par test. Les épingler tous à chaque fois noierait ce qui est
// réellement sous test.
function unEngagement(partiel: Partial<Engagement> & { id: string }): Engagement {
  return {
    userId: 'u1',
    name: partiel.id,
    notes: null,
    tags: [],
    genericLevel: 'debutant',
    archivedAt: null,
    deletedAt: null,
    skippedAt: null,
    scheduledAt: null,
    scheduledEndsAt: null,
    priority: 'aucune',
    recurrenceSeriesId: null,
    recurrenceType: 'aucune',
    recurrenceInterval: null,
    recurrenceWeekdays: null,
    isProject: false,
    projectId: null,
    goalPeriod: null,
    goalMetric: null,
    goalTarget: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

function uneLiaison(partiel: Partial<LiaisonProjet> & { engagementId: string; projectId: string }): LiaisonProjet {
  return {
    id: `${partiel.engagementId}-${partiel.projectId}`,
    userId: 'u1',
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

const maison = unEngagement({ id: 'maison', isProject: true });
const atelier = unEngagement({ id: 'atelier', isProject: true });
const menuiserie = unEngagement({ id: 'menuiserie' });
const plomberie = unEngagement({ id: 'plomberie' });
const engagements = [maison, atelier, menuiserie, plomberie];

describe('membresDuProjet', () => {
  it('rend les engagements liés quand la liaison fait autorité', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison' }),
      uneLiaison({ engagementId: 'plomberie', projectId: 'maison' }),
    ];
    expect(membresDuProjet(engagements, liaisons, 'maison').map((e) => e.id)).toEqual([
      'menuiserie',
      'plomberie',
    ]);
  });

  it('rend une liste vide quand la liaison existe mais ne dit rien de ce projet', () => {
    // Distinct du cas indisponible : ici la table a répondu, et sa réponse
    // est « personne ». Retomber sur `project_id` ici ressusciterait un
    // rattachement que l'utilisateur vient de retirer.
    const liaisons = [uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier' })];
    expect(membresDuProjet(engagements, liaisons, 'maison')).toEqual([]);
  });

  it('retombe sur `project_id` quand la liaison est indisponible', () => {
    // `null` veut dire « la table n'existe pas encore ». Les rattachements
    // hérités doivent rester visibles jusqu'à ce que le SQL soit collé.
    const avecColonne = [maison, unEngagement({ id: 'menuiserie', projectId: 'maison' })];
    expect(membresDuProjet(avecColonne, null, 'maison').map((e) => e.id)).toEqual(['menuiserie']);
  });

  it('ignore `project_id` dès que la liaison est disponible, même s’il la contredit', () => {
    // Le cas qui arrive pour tout engagement modifié par une version
    // antérieure de l'application. La précédence est totale, jamais une
    // fusion : réunir les deux sources ressusciterait un rattachement retiré.
    const perime = [maison, unEngagement({ id: 'plomberie', projectId: 'maison' })];
    const liaisons = [uneLiaison({ engagementId: 'plomberie', projectId: 'atelier' })];
    expect(membresDuProjet(perime, liaisons, 'maison')).toEqual([]);
  });
});

describe('projetsDeLEngagement', () => {
  it('rend les plusieurs projets d’un même skill', () => {
    // C'est le cas qui motive tout le chantier : « menuiserie » sert la
    // maison ET l'atelier, ce que le `project_id` unique ne pouvait pas dire.
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison' }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier' }),
    ];
    expect(projetsDeLEngagement(engagements, liaisons, 'menuiserie').map((e) => e.id)).toEqual([
      'maison',
      'atelier',
    ]);
  });

  it('ne rend que des projets, jamais un skill', () => {
    const liaisons = [uneLiaison({ engagementId: 'menuiserie', projectId: 'plomberie' })];
    expect(projetsDeLEngagement(engagements, liaisons, 'menuiserie')).toEqual([]);
  });

  it('retombe sur `project_id` quand la liaison est indisponible', () => {
    const avecColonne = [maison, atelier, unEngagement({ id: 'menuiserie', projectId: 'atelier' })];
    expect(projetsDeLEngagement(avecColonne, null, 'menuiserie').map((e) => e.id)).toEqual(['atelier']);
  });
});

describe('projetPrincipal', () => {
  it('prend la plus petite position', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', position: 2 }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', position: 1 }),
    ];
    expect(projetPrincipal(liaisons, 'menuiserie')).toBe('maison');
  });

  it('départage deux positions égales par la plus ancienne', () => {
    // Le tri est explicite parce qu'un tri implicite ferait dépendre
    // `project_id` de l'ordre de retour de PostgREST : un défaut
    // impossible à reproduire.
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', createdAt: '2026-05-01T00:00:00.000Z' }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(projetPrincipal(liaisons, 'menuiserie')).toBe('maison');
  });

  it('rend null quand l’engagement n’est lié à rien', () => {
    // C'est ce `null` qui remettra `project_id` à vide pour l'application
    // installée quand on détache le dernier projet.
    expect(projetPrincipal([], 'menuiserie')).toBeNull();
  });

  it('ne modifie pas le tableau reçu', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', position: 2 }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', position: 1 }),
    ];
    projetPrincipal(liaisons, 'menuiserie');
    expect(liaisons.map((l) => l.projectId)).toEqual(['atelier', 'maison']);
  });
});

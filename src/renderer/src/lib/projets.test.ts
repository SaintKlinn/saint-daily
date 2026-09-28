import { describe, expect, it } from 'vitest';
import {
  avancementProjet,
  entreesDuProjet,
  formatDormance,
  membresDuProjet,
  projetAffiche,
  projetPrincipal,
  projetsDeLEngagement,
  tempsCumuleMinutes,
  trierProjets,
} from './projets';
import type { LigneProjet } from './projets';
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
    dueAt: null,
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

  it('rend une liste vide sur une liaison vide, sans retomber sur `project_id`', () => {
    // Le cas que les autres tests laissaient passer : `[]` veut dire « la
    // table a répondu, et sa réponse est personne ». Une implémentation qui
    // traiterait `[]` comme `null` retomberait sur la colonne et
    // ressusciterait un rattachement que l'utilisateur vient de retirer.
    const perime = [maison, unEngagement({ id: 'plomberie', projectId: 'maison' })];
    expect(membresDuProjet(perime, [], 'maison')).toEqual([]);
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

  it('rend une liste vide sur une liaison vide, sans retomber sur `project_id`', () => {
    // Même garde que pour membresDuProjet, dans l'autre sens de lecture.
    const perime = [maison, unEngagement({ id: 'menuiserie', projectId: 'maison' })];
    expect(projetsDeLEngagement(perime, [], 'menuiserie')).toEqual([]);
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

describe('projetAffiche', () => {
  it('rend le projet principal quand la liaison est disponible et peuplée', () => {
    const liaisons = [
      uneLiaison({ engagementId: 'menuiserie', projectId: 'atelier', position: 1 }),
      uneLiaison({ engagementId: 'menuiserie', projectId: 'maison', position: 0 }),
    ];
    expect(projetAffiche(engagements, liaisons, 'menuiserie')).toBe('maison');
  });

  it('rend null quand la liaison est disponible mais vide pour cet engagement', () => {
    // Distinct du repli sur `project_id` : la table a répondu « personne »,
    // ce qui doit rester « Aucun » à l'affichage même si `project_id` traîne
    // encore une ancienne valeur.
    const perime = [maison, unEngagement({ id: 'menuiserie', projectId: 'maison' })];
    expect(projetAffiche(perime, [], 'menuiserie')).toBeNull();
  });

  it('retombe sur `project_id` quand la liaison est indisponible', () => {
    // Le cas que Fix 2 corrige : `liaisons ?? []` ferait disparaître un
    // `project_id` pourtant posé, et le sélecteur afficherait « Aucun » à
    // tort.
    const avecColonne = unEngagement({ id: 'menuiserie', projectId: 'maison' });
    expect(projetAffiche([maison, avecColonne], null, 'menuiserie')).toBe('maison');
  });
});

describe('entreesDuProjet', () => {
  it('réunit les entrées des membres et celles du projet lui-même', () => {
    // La règle qui compte : un projet EST un engagement et peut porter des
    // entrées directement — ce que fera la « session de chantier ». Ne
    // compter que les membres rendrait ce temps-là invisible dans le total
    // de son propre projet.
    const parEngagement = {
      menuiserie: [{ durationMinutes: 30 }],
      maison: [{ durationMinutes: 90 }],
    };
    const membres = [unEngagement({ id: 'menuiserie' })];
    const resultat = entreesDuProjet(parEngagement, membres, 'maison');
    expect(resultat.map((e) => e.durationMinutes).sort((a, b) => a - b)).toEqual([30, 90]);
  });

  it('rend une liste vide pour un projet sans membre ni entrée propre', () => {
    // Surtout pas les entrées de tout le monde : le `Record` contient celles
    // d'engagements qui ne le concernent pas.
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    expect(entreesDuProjet(parEngagement, [], 'maison')).toEqual([]);
  });

  it('tolère un membre absent du Record', () => {
    // Le hook n'indexe que les engagements qui ONT des entrées : l'absence
    // est la normale, pas une anomalie.
    const membres = [unEngagement({ id: 'menuiserie' }), unEngagement({ id: 'plomberie' })];
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 30 }]);
  });

  it('ne compte pas deux fois si le projet figure parmi ses propres membres', () => {
    // La contrainte `check (engagement_id <> project_id)` de la migration
    // 0016 l'interdit en base, mais la fonction ne doit pas dépendre d'une
    // garantie posée ailleurs pour rester juste.
    const parEngagement = { maison: [{ durationMinutes: 90 }] };
    const membres = [unEngagement({ id: 'maison', isProject: true })];
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 90 }]);
  });

  it('compte le temps d\'un skill partagé dans chacun de ses deux projets', () => {
    // Le cas qui justifie tout le modèle du chantier A : « menuiserie » sert
    // la maison ET l'atelier, et ses 30 minutes comptent des deux côtés.
    const parEngagement = { menuiserie: [{ durationMinutes: 30 }] };
    const membres = [unEngagement({ id: 'menuiserie' })];
    expect(entreesDuProjet(parEngagement, membres, 'maison')).toEqual([{ durationMinutes: 30 }]);
    expect(entreesDuProjet(parEngagement, membres, 'atelier')).toEqual([{ durationMinutes: 30 }]);
  });
});

describe('tempsCumuleMinutes', () => {
  it('somme les durées', () => {
    expect(tempsCumuleMinutes([{ durationMinutes: 30 }, { durationMinutes: 90 }])).toBe(120);
  });

  it('rend zéro sur une liste vide', () => {
    expect(tempsCumuleMinutes([])).toBe(0);
  });
});

describe('formatDormance', () => {
  it('distingue « aucune activité » de « aujourd\'hui »', () => {
    // `daysSinceLastPractice` rend `null` quand il n'y a aucune entrée, et
    // `0` quand la dernière est du jour. Les confondre dirait d'un chantier
    // jamais commencé qu'on y a touché aujourd'hui.
    expect(formatDormance(null)).toBe('Aucune activité');
    expect(formatDormance(0)).toBe("Aujourd'hui");
  });

  it('dit « hier » au singulier', () => {
    expect(formatDormance(1)).toBe('Hier');
  });

  it('compte en jours jusqu\'à 13', () => {
    expect(formatDormance(2)).toBe('Il y a 2 jours');
    expect(formatDormance(13)).toBe('Il y a 13 jours');
  });

  it('bascule en semaines à 14 jours', () => {
    expect(formatDormance(14)).toBe('Il y a 2 semaines');
    expect(formatDormance(55)).toBe('Il y a 7 semaines');
  });

  it('bascule en mois à 56 jours, sans jamais paraître reculer', () => {
    // Le piège que ce test garde : avec `Math.floor(jours / 30)`, 56 jours
    // donnerait « 1 mois » juste après « 7 semaines » — une valeur qui se
    // lit comme PLUS PETITE que la précédente alors que le temps a avancé.
    // L'arrondi évite cette marche arrière apparente.
    expect(formatDormance(56)).toBe('Il y a 2 mois');
    expect(formatDormance(200)).toBe('Il y a 7 mois');
  });
});

describe('avancementProjet', () => {
  it('rend un total nul sur une liste vide, sans diviser par zéro', () => {
    // `total: 0` est le signal que l'écran lit pour ne rien afficher du
    // tout : « 0 sur 0 » dirait faussement qu'un chantier sans jalon n'a
    // pas avancé, alors qu'il n'a rien à mesurer.
    expect(avancementProjet([])).toEqual({ franchis: 0, total: 0, ratio: 0 });
  });

  it('compte zéro franchi sur trois', () => {
    const jalons = [{ completedAt: null }, { completedAt: null }, { completedAt: null }];
    expect(avancementProjet(jalons)).toEqual({ franchis: 0, total: 3, ratio: 0 });
  });

  it('compte trois franchis sur trois', () => {
    const jalons = [
      { completedAt: '2026-09-01T10:00:00Z' },
      { completedAt: '2026-09-02T10:00:00Z' },
      { completedAt: '2026-09-03T10:00:00Z' },
    ];
    expect(avancementProjet(jalons)).toEqual({ franchis: 3, total: 3, ratio: 1 });
  });

  it('rend la fraction brute, sans arrondir', () => {
    // L'arrondi appartient à l'affichage. La fonction qui rend 0.333… ne
    // doit pas décider à la place de la barre ni du libellé.
    const jalons = [{ completedAt: '2026-09-01T10:00:00Z' }, { completedAt: null }, { completedAt: null }];
    const { ratio } = avancementProjet(jalons);
    expect(ratio).toBeCloseTo(1 / 3, 10);
  });
});

describe('trierProjets', () => {
  function uneLigne(partiel: Partial<LigneProjet> & { id: string }): LigneProjet {
    return { nom: partiel.id, minutes: 0, jours: null, avancement: null, ...partiel };
  }

  it('met le plus dormant en haut', () => {
    const lignes = [
      uneLigne({ id: 'recent', jours: 2 }),
      uneLigne({ id: 'oublie', jours: 40 }),
      uneLigne({ id: 'moyen', jours: 10 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['oublie', 'moyen', 'recent']);
  });

  it('met le plus investi en haut', () => {
    const lignes = [
      uneLigne({ id: 'petit', minutes: 30 }),
      uneLigne({ id: 'gros', minutes: 600 }),
      uneLigne({ id: 'moyen', minutes: 120 }),
    ];
    expect(trierProjets(lignes, 'temps').map((l) => l.id)).toEqual(['gros', 'moyen', 'petit']);
  });

  it('met le moins avancé en haut', () => {
    const lignes = [
      uneLigne({ id: 'presque', avancement: 0.9 }),
      uneLigne({ id: 'debut', avancement: 0.1 }),
      uneLigne({ id: 'moitie', avancement: 0.5 }),
    ];
    expect(trierProjets(lignes, 'avancement').map((l) => l.id)).toEqual(['debut', 'moitie', 'presque']);
  });

  it('trie par nom en tenant compte des accents', () => {
    // `localeCompare` en français, sinon « Élagage » passerait après
    // « Zinguerie » parce que son point de code est plus haut.
    const lignes = [
      uneLigne({ id: 'z', nom: 'Zinguerie' }),
      uneLigne({ id: 'e', nom: 'Élagage' }),
      uneLigne({ id: 'a', nom: 'Atelier' }),
    ];
    expect(trierProjets(lignes, 'nom').map((l) => l.id)).toEqual(['a', 'e', 'z']);
  });

  it('range les projets sans aucune activité en bas, pas en tête', () => {
    // LA règle de cette tranche. Un chantier jamais commencé n'est pas le
    // plus négligé — il n'a pas commencé — et le mettre en tête
    // enterrerait sous lui le chantier réellement abandonné, c'est-à-dire
    // le signal que tout ce tri existe pour montrer.
    const lignes = [
      uneLigne({ id: 'jamais', jours: null }),
      uneLigne({ id: 'oublie', jours: 40 }),
      uneLigne({ id: 'recent', jours: 2 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['oublie', 'recent', 'jamais']);
  });

  it('range les projets sans aucun jalon en bas', () => {
    const lignes = [
      uneLigne({ id: 'sansJalon', avancement: null }),
      uneLigne({ id: 'presque', avancement: 0.9 }),
      uneLigne({ id: 'debut', avancement: 0.1 }),
    ];
    expect(trierProjets(lignes, 'avancement').map((l) => l.id)).toEqual(['debut', 'presque', 'sansJalon']);
  });

  it("garde l'ordre d'origine entre deux valeurs égales", () => {
    // Sans stabilité, deux rendus successifs échangeraient deux lignes
    // sans qu'aucune donnée n'ait bougé.
    const lignes = [
      uneLigne({ id: 'premier', jours: 5 }),
      uneLigne({ id: 'second', jours: 5 }),
      uneLigne({ id: 'troisieme', jours: 5 }),
    ];
    expect(trierProjets(lignes, 'dormance').map((l) => l.id)).toEqual(['premier', 'second', 'troisieme']);
  });

  it("ne modifie pas le tableau qu'on lui passe", () => {
    // L'appelant passe le résultat d'un `useMemo` dont React réutilise
    // l'identité : le muter ferait diverger l'affichage de l'état.
    const lignes = [uneLigne({ id: 'b', jours: 1 }), uneLigne({ id: 'a', jours: 9 })];
    trierProjets(lignes, 'dormance');
    expect(lignes.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('ne jette pas sur une liste vide', () => {
    expect(trierProjets([], 'dormance')).toEqual([]);
  });
});

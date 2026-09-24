// La liste des entrées du rail vit ici plutôt que dans le JSX d'AppShell :
// c'est ce qui rend l'ordre et les groupes vérifiables par un test, dans un
// dépôt qui n'a aucun socle de test de composants (voir la spec, §6).
//
// L'icône est désignée par une CLÉ et non par le composant lui-même. Deux
// raisons : ce module reste libre de tout import React, donc testable sans
// moteur de rendu ; et le `Record<CleIcone, …>` d'AppShell rend la
// correspondance exhaustive par le typage — oublier une icône devient une
// erreur de compilation, pas un trou découvert à l'exécution.

export type CleIcone =
  | 'accueil'
  | 'calendrier'
  | 'skill'
  | 'projets'
  | 'journal'
  | 'bilan'
  | 'reglages';

export interface EntreeNav {
  to: string;
  /** Nom accessible du lien ET texte affiché quand le rail est déplié. */
  libelle: string;
  icone: CleIcone;
  /** Passe `end` à NavLink. Seule la racine en a besoin : sans lui, « / »
   *  resterait actif sur toutes les routes filles. */
  exact?: boolean;
}

export interface GroupeNav {
  entrees: EntreeNav[];
  /** Pousse le groupe au bas du rail. Réglages seul : il n'appartient ni
   *  au travail du jour ni au regard en arrière. */
  ancreEnBas?: boolean;
}

// L'ordre suit l'horizon de temps. L'ordre précédent — Skills avant
// Calendrier, Bilan avant Journal — ne suivait aucun raisonnement d'usage :
// une journée commence par ce qu'il y a à faire, et l'on consigne avant de
// relire.
export const GROUPES_NAV: GroupeNav[] = [
  {
    entrees: [
      { to: '/', libelle: 'Accueil', icone: 'accueil', exact: true },
      { to: '/calendrier', libelle: 'Calendrier', icone: 'calendrier' },
      { to: '/skills', libelle: 'Skills', icone: 'skill' },
      { to: '/projets', libelle: 'Projets', icone: 'projets' },
    ],
  },
  {
    entrees: [
      { to: '/journal', libelle: 'Journal', icone: 'journal' },
      { to: '/bilan', libelle: 'Bilan', icone: 'bilan' },
    ],
  },
  {
    entrees: [{ to: '/reglages', libelle: 'Réglages', icone: 'reglages' }],
    ancreEnBas: true,
  },
];

/** À plat, dans l'ordre d'affichage. Sert au test et à toute vérification
 *  qui raisonne sur les entrées sans se soucier des groupes. */
export const ENTREES_NAV: EntreeNav[] = GROUPES_NAV.flatMap((g) => g.entrees);

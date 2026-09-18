// Source unique des échelles typographique et d'espacement — consommée par
// tailwind.config.ts, sur le modèle de theme/colors.ts. Les deux échelles
// vivent dans le même fichier parce qu'elles forment un seul système :
// séparées, elles dérivent l'une de l'autre, ce qui est précisément ce qui
// est arrivé à l'application avant cette refonte.
//
// Le diagnostic, pour que personne ne rouvre le débat sans les chiffres :
// sept tailles distinctes entre 9 et 15 px portaient 259 des 292 usages de
// texte, soit 89 %. Sept paliers dans une bande de six pixels sont
// perceptuellement indistinguables — rien ne ressortait, donc rien ne
// hiérarchisait.

// Chaque palier est un tuple [taille, { lineHeight, fontWeight }], la forme
// attendue par `theme.fontSize` de Tailwind.
//
// Poser la hauteur de ligne ici est la moitié du correctif : les valeurs
// arbitraires (`text-[13px]`) ne fixent QUE la taille, et `index.css` ne
// pose aucune base, donc tout le texte de l'application héritait d'un
// `line-height: normal` voisin de 1,2.
//
// La graisse y est posée aussi, pour que le rôle porte son poids sans
// qu'on ait à l'écrire à chaque usage. Tailwind émet les utilitaires de
// `fontSize` avant ceux de `fontWeight`, donc un `font-semibold` explicite
// dans le balisage l'emporte sur la valeur du tuple — c'est ce qui permet
// aux titres de section de carte d'être du `corps` en 600. Cette priorité
// est vérifiée à l'étape 4 plutôt que supposée.
export const fontSize = {
  libelle: ['11px', { lineHeight: '1.45', fontWeight: '600' }],
  secondaire: ['13px', { lineHeight: '1.55', fontWeight: '400' }],
  corps: ['15px', { lineHeight: '1.6', fontWeight: '400' }],
  titre: ['20px', { lineHeight: '1.35', fontWeight: '500' }],
  'titre-ecran': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
  heros: ['40px', { lineHeight: '1.05', fontWeight: '400' }],
} as const;

// Les sept valeurs d'espacement autorisées, en pixels, avec le cran
// Tailwind correspondant.
//
// Elles ne sont PAS câblées dans tailwind.config.ts : `1`, `2`, `3`, `4`,
// `6`, `8` et `12` existent déjà dans l'échelle Tailwind par défaut, il n'y
// a donc rien à étendre. Et remplacer `theme.spacing` serait nuisible :
// il pilote aussi `w-`, `h-`, `inset-` et une dizaine d'autres familles
// dont les besoins sont géométriques et non rythmiques — la grille horaire
// du calendrier, les 72 px du rail, les cases de la heatmap.
//
// Ce tableau sert donc de référence pour la relecture et pour le test, pas
// de configuration. La discipline sur les espacements est tenue par les
// trois `grep` de vérification de la tâche 7.
export const espacement = {
  serre: { px: 4, cran: '1' },
  interne: { px: 8, cran: '2' },
  interneLarge: { px: 12, cran: '3' },
  carte: { px: 16, cran: '4' },
  entreGroupes: { px: 24, cran: '6' },
  entreSections: { px: 32, cran: '8' },
  page: { px: 48, cran: '12' },
} as const;

// Source unique du vocabulaire de mouvement de l'app, sur le modèle de
// colors.ts et typographie.ts. La courbe 0,16/1/0,3/1 était déjà recopiée
// à la main dans une dizaine d'écrans (Accueil, EmptyState, AppShell,
// logo-ray-reveal) : la nommer ici évite qu'un nouvel écran en invente une
// cinquième variante.
//
// <MotionConfig reducedMotion="user"> (App.tsx) ne neutralise que les
// TRANSFORMATIONS (y, scale…) et le layout ; l'opacité, la largeur et les
// animations impératives (`animate()`) continuent de tourner. Ces variantes
// s'en contentent — il ne reste qu'un fondu. Tout ce qui anime autre chose
// qu'une transformation vérifie `useReducedMotion` lui-même (ChiffreAnime,
// BarreProgression).

/** Sortie franche puis longue décélération : l'élément arrive vite et se pose. */
export const EASE_SORTIE = [0.16, 1, 0.3, 1] as const;

/** Conteneur d'une cascade : chaque enfant part 60 ms après le précédent. */
export const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

/** Enfant d'une cascade : monte de 10 px en apparaissant. */
export const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

/** Transition d'un enfant de cascade. */
export const itemTransition = { duration: 0.4, ease: EASE_SORTIE };

// Source unique des tokens de couleur — consommée par tailwind.config.ts
// ET par LogoMark.tsx, pour que le rendu in-app et les icônes générées
// (tâche 13) ne divergent jamais. Emerald Ink (#064E3B) et Champagne
// (#F8E7C9) sont des ancrages de marque fixes ; les nuances ink/muted et
// l'accent doré viennent du canvas de maquettes validé avec l'utilisateur.
export const colors = {
  ink: {
    950: '#03231A',
    900: '#064E3B', // Emerald Ink — ancrage, ne change pas
    800: '#0B5F49',
    700: '#146856',
  },
  champagne: '#F8E7C9', // ancrage, ne change pas
  // #8FA396 (canvas d'origine) passait sous 4.5:1 sur ink-900 ET ink-800
  // (form cards, cartes skill, chips) — éclairci pour rester AA sur les
  // deux fonds sans changer sa teinte (audit ui-ux-pro-max). Vérifié :
  // 5.81:1 sur ink-900, 4.57:1 sur ink-800.
  muted: '#BCCCC2',
  accent: {
    bright: '#E7B94E',
    hover: '#F3CE73',
    mid: '#C08A2A',
    deep: '#8A5F1B',
  },
  danger: '#F87171',
} as const;

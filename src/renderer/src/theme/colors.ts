// Source unique des tokens de couleur — consommée par tailwind.config.ts
// ET par LogoMark.tsx, pour que le rendu in-app et les icônes générées
// (tâche 13) ne divergent jamais. Emerald Ink (#064E3B) et Champagne
// (#F8E7C9) sont des ancrages de marque fixes ; les nuances ink/muted et
// l'accent doré viennent du canvas de maquettes validé avec l'utilisateur.

// Extrait en const nommée (plutôt qu'inline dans `colors`) pour que la
// rampe `heatmap` ci-dessous puisse réutiliser ces mêmes valeurs sans les
// recopier — un objet ne peut pas se référencer lui-même pendant sa propre
// initialisation.
const accent = {
  bright: '#E7B94E',
  hover: '#F3CE73',
  mid: '#C08A2A',
  deep: '#8A5F1B',
} as const;

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
  accent,
  danger: '#F87171',
  // La palette d'origine (élevée = `danger`, moyenne #D2894A, basse #6FA8A3)
  // passait sous 3:1 (WCAG 1.4.11, contraste non-textuel) sur le fond
  // ink-800 du Calendrier — vérifiée uniquement sur ink-900 à l'origine
  // (audit ui-ux-pro-max, 2026-09-11). Nouvelles valeurs, avec marge au-dessus
  // de 3:1 sur les DEUX fonds où la palette s'affiche réellement :
  //   élevée  4.59:1 sur ink-900 / 3.61:1 sur ink-800
  //   moyenne 4.89:1 sur ink-900 / 3.85:1 sur ink-800
  //   basse   4.91:1 sur ink-900 / 3.86:1 sur ink-800
  // `elevee` ne réutilise plus `danger` : `danger` sert aussi au texte
  // d'erreur (role="alert") ailleurs dans l'app, l'éclaircir aurait changé
  // ce rendu partout — `elevee` reçoit sa propre valeur, même famille de
  // rouge. `moyenne`/`basse` évitent volontairement accent.bright, qui
  // signale déjà "actif/primaire" ailleurs dans l'app (nav, boutons).
  priority: {
    elevee: '#FF9494',
    moyenne: '#E6AD70',
    basse: '#8FC2BC',
  },
  // Rampe dédiée à la heatmap du Bilan (HeatmapCalendrier.tsx). La rampe
  // d'origine (case vide = ink-700, niveaux 1-3 = accent.deep/mid/bright)
  // ne donnait que 1.19:1 entre "aucune séance" et "une séance" sur le
  // fond ink-800 de la carte — le signal principal du widget était
  // invisible pour un utilisateur qui pratique tous les jours.
  //
  // Le niveau 0 est un puits volontairement plus sombre que la carte : il
  // porte l'information "case vide mais existante", pas une donnée, donc
  // il n'a pas besoin d'atteindre 3:1 lui-même — seulement d'être visible.
  // Les niveaux 1 à 3 réutilisent tels quels accent.deep/mid/bright — déjà
  // la rampe or de l'app — pour rester dans le monde émeraude/or plutôt
  // que d'introduire une teinte étrangère, et parce que accent.bright au
  // niveau 3 prolonge son usage existant de signal "actif/maximal".
  //
  // Contrastes (luminance relative WCAG 2.x), validés en reproduisant
  // d'abord les deux ratios ci-dessus (muted 4.57:1, priority.elevee
  // 3.61:1, tous deux sur ink-800) pour confirmer la formule :
  //   niveau 0 (#02130E)       vs carte ink-800 : 2.49:1 (distinct, non-textuel)
  //   niveau 1 (accent.deep)   vs niveau 0       : 3.39:1
  //   niveau 2 (accent.mid)    vs niveau 0       : 6.27:1
  //   niveau 3 (accent.bright) vs niveau 0       : 10.39:1
  heatmap: {
    0: '#02130E',
    1: accent.deep,
    2: accent.mid,
    3: accent.bright,
  },
} as const;

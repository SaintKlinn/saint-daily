import { colors } from '../theme/colors';

// Ambiance du fond de l'app selon le moment de la journée : le halo qui
// éclaire le haut de chaque écran (AppShell) change de teinte et
// d'intensité, pour que l'app ne soit pas la même à 8 h et à 22 h. Les
// changements restent dans la famille or / champagne de la marque.

export type Moment = 'aube' | 'jour' | 'soir' | 'nuit';

export interface Ambiance {
  teinte: string;
  // Opacité du halo principal (0 à 1) ; le halo secondaire en prend la moitié.
  intensite: number;
}

// Heures de début, locales. La nuit couvre 21 h → 5 h en passant minuit.
export function momentDeLaJournee(date: Date = new Date()): Moment {
  const h = date.getHours();
  if (h >= 5 && h < 9) return 'aube';
  if (h >= 9 && h < 17) return 'jour';
  if (h >= 17 && h < 21) return 'soir';
  return 'nuit';
}

export const AMBIANCES: Record<Moment, Ambiance> = {
  // Lumière claire et fraîche : le champagne plutôt que l'or.
  aube: { teinte: colors.champagne, intensite: 0.11 },
  // La valeur historique du halo d'AppShell (`1a` ≈ 0,10), inchangée.
  jour: { teinte: colors.accent.bright, intensite: 0.1 },
  // Plus chaud et un peu plus présent : l'ambre de la priorité moyenne.
  soir: { teinte: colors.priority.moyenne, intensite: 0.17 },
  // Plus sombre et plus discret : l'or foncé, à peine perceptible.
  nuit: { teinte: colors.accent.mid, intensite: 0.045 },
};

/** Suffixe alpha hexadécimal (#RRGGBB + AA) pour une opacité 0 à 1. */
export function alphaHex(opacite: number): string {
  const borne = Math.min(1, Math.max(0, opacite));
  return Math.round(borne * 255)
    .toString(16)
    .padStart(2, '0');
}

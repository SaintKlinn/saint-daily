import type { StockageLike } from './preferencesAffichage';

// Paliers de série (jours consécutifs de pratique) fêtés sur l'Accueil. Les
// badges de lib/motivation.ts disent déjà « 7 jours d'affilée » débloqué,
// mais rien ne marquait le MOMENT où on l'atteint : c'est ce que ce module
// décide — quel palier fêter, et une seule fois par série.

export const PALIERS = [7, 30, 100, 365] as const;

export interface PaliersFetes {
  // Premier jour de la série concernée (voir currentStreakStart). Une
  // nouvelle série repart de zéro : l'avoir fêté une fois ne dispense pas
  // de le refêter après une interruption.
  debutSerie: string;
  paliers: number[];
}

/**
 * Le palier à fêter maintenant, ou null. Si plusieurs sont franchis d'un
 * coup (première ouverture après la mise à jour avec une série de 40 jours),
 * seul le plus haut est fêté, et tous ceux en dessous sont comptés comme
 * fêtés : pas une salve de trois célébrations à la suite.
 */
export function palierAFeter(
  serie: number,
  debutSerie: string | null,
  dejaFetes: PaliersFetes | null
): { palier: number; fetes: PaliersFetes } | null {
  if (!debutSerie) return null;
  const deja = dejaFetes?.debutSerie === debutSerie ? dejaFetes.paliers : [];
  const atteints = PALIERS.filter((p) => p <= serie);
  const nouveaux = atteints.filter((p) => !deja.includes(p));
  if (nouveaux.length === 0) return null;
  return { palier: Math.max(...nouveaux), fetes: { debutSerie, paliers: [...atteints] } };
}

export function messagePalier(palier: number): { titre: string; detail: string } {
  switch (palier) {
    case 7:
      return { titre: '7 jours d’affilée', detail: 'Une semaine entière sans interruption.' };
    case 30:
      return { titre: '30 jours d’affilée', detail: 'Un mois complet. C’est devenu une habitude.' };
    case 100:
      return { titre: '100 jours d’affilée', detail: 'Cent jours. Peu de gens tiennent jusque-là.' };
    case 365:
      return { titre: 'Un an d’affilée', detail: '365 jours sans en manquer un seul.' };
    default:
      return { titre: `${palier} jours d’affilée`, detail: 'Continue sur cette lancée.' };
  }
}

export const CLE_PALIERS_FETES = 'saint-daily.paliers-fetes';

function stockageParDefaut(): StockageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function lirePaliersFetes(stockage: StockageLike | null = stockageParDefaut()): PaliersFetes | null {
  try {
    const brut = stockage?.getItem(CLE_PALIERS_FETES);
    if (!brut) return null;
    const v = JSON.parse(brut) as Record<string, unknown>;
    if (
      typeof v?.debutSerie !== 'string' ||
      !Array.isArray(v.paliers) ||
      !v.paliers.every((p) => typeof p === 'number')
    ) {
      return null;
    }
    return { debutSerie: v.debutSerie, paliers: v.paliers as number[] };
  } catch {
    return null;
  }
}

export function ecrirePaliersFetes(fetes: PaliersFetes, stockage: StockageLike | null = stockageParDefaut()): void {
  try {
    stockage?.setItem(CLE_PALIERS_FETES, JSON.stringify(fetes));
  } catch {
    // Sans stockage, le palier sera simplement refêté à la prochaine visite.
  }
}

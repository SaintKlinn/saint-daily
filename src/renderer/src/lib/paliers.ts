import type { StockageLike } from './preferencesAffichage';

// Paliers de série (jours consécutifs de pratique) fêtés sur l'Accueil. Les
// badges de lib/motivation.ts disent déjà « 7 jours d'affilée » débloqué,
// mais rien ne marquait le MOMENT où on l'atteint : c'est ce que ce module
// décide — quel palier fêter, et une seule fois par série.

export const PALIERS = [7, 30, 100, 365] as const;

export interface PaliersFetes {
  // Premier jour de la série concernée (voir currentStreakStart).
  debutSerie: string;
  paliers: number[];
  // Jour UTC (`YYYY-MM-DD`) de la dernière célébration. Absent des
  // enregistrements écrits avant lui : voir finDeLaSerieFetee.
  celebreLe?: string;
}

function ajouterJours(cle: string, n: number): string {
  const d = new Date(`${cle}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dernier jour où la série fêtée était sûrement encore en cours. Sans
 *  `celebreLe`, son plus haut palier a été atteint au plus tôt
 *  `debutSerie + palier − 1`. */
function finDeLaSerieFetee(fetes: PaliersFetes): string {
  if (fetes.celebreLe) return fetes.celebreLe;
  return ajouterJours(fetes.debutSerie, Math.max(1, ...fetes.paliers) - 1);
}

/**
 * Le palier à fêter maintenant, ou null. Si plusieurs sont franchis d'un
 * coup, seul le plus haut est fêté, et tous ceux en dessous sont comptés
 * comme fêtés : pas une salve de trois célébrations à la suite.
 *
 * Deux séries sont la même si l'actuelle a commencé au plus tard le jour de
 * la dernière célébration : une vraie interruption ne peut survenir
 * qu'après, donc une série neuve commence forcément après. Exiger le même
 * premier jour exact refêtait un palier dès que ce jour bougeait — un skill
 * mis en pause, une séance du premier jour modifiée, une date de repos
 * ajoutée.
 */
export function palierAFeter(
  serie: number,
  debutSerie: string | null,
  dejaFetes: PaliersFetes | null,
  aujourdhui: string
): { palier: number; fetes: PaliersFetes } | null {
  if (!debutSerie) return null;
  const deja = dejaFetes && debutSerie <= finDeLaSerieFetee(dejaFetes) ? dejaFetes.paliers : [];
  const atteints = PALIERS.filter((p) => p <= serie);
  const nouveaux = atteints.filter((p) => !deja.includes(p));
  if (nouveaux.length === 0) return null;
  const paliers = [...new Set([...deja, ...atteints])].sort((a, b) => a - b);
  return { palier: Math.max(...nouveaux), fetes: { debutSerie, paliers, celebreLe: aujourdhui } };
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
      !v.paliers.every((p) => typeof p === 'number') ||
      (v.celebreLe !== undefined && typeof v.celebreLe !== 'string')
    ) {
      return null;
    }
    return {
      debutSerie: v.debutSerie,
      paliers: v.paliers as number[],
      ...(typeof v.celebreLe === 'string' ? { celebreLe: v.celebreLe } : {}),
    };
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

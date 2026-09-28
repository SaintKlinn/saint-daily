import { useSyncExternalStore } from 'react';
import type { StockageLike } from './preferencesAffichage';

// Jours de repos : prévus à l'avance, ils ne cassent pas une série. Un jour
// de repos sans pratique est transparent (ni compté, ni rupture) ; pratiquer
// un jour de repos compte normalement.
//
// Même statut que le son ou l'épinglage du rail : une préférence locale, pas
// une colonne de `settings` — une colonne coûterait une migration manuelle,
// et l'app casserait tant qu'elle n'est pas collée dans Supabase.
//
// Les jours sont comparés en UTC, comme toute la logique de série
// (lib/streaks.ts) : un jour de repos désigne le même jour que celui où une
// séance compterait.

export interface JoursRepos {
  // Jours de la semaine, 0 = dimanche … 6 = samedi (`getUTCDay`).
  hebdo: number[];
  // Jours ponctuels, `YYYY-MM-DD`.
  dates: string[];
}

export const AUCUN_REPOS: JoursRepos = { hebdo: [], dates: [] };

export const CLE_JOURS_REPOS = 'saint-daily.jours-repos';

// Les dates ponctuelles passées depuis plus longtemps que ça sont oubliées à
// l'écriture : au-delà, elles ne changent plus aucune série en cours, et la
// liste ne grossirait sans fin. Les records (meilleure série) peuvent
// perdre un jour de repos très ancien ; c'est le prix d'un stockage borné.
const CONSERVATION_JOURS = 400;

/** Clé `YYYY-MM-DD` du jour UTC d'une date. */
export function cleJourUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function estJourDeRepos(date: Date, repos: JoursRepos): boolean {
  return repos.hebdo.includes(date.getUTCDay()) || repos.dates.includes(cleJourUtc(date));
}

/** Valide et normalise ce qui sort du stockage : toute valeur inattendue
 *  retombe sur « aucun repos » plutôt que de fausser les séries. */
export function normaliserJoursRepos(brut: unknown): JoursRepos {
  if (!brut || typeof brut !== 'object') return AUCUN_REPOS;
  const { hebdo, dates } = brut as Partial<Record<keyof JoursRepos, unknown>>;
  return {
    hebdo: Array.isArray(hebdo)
      ? [...new Set(hebdo.filter((j): j is number => Number.isInteger(j) && j >= 0 && j <= 6))].sort()
      : [],
    dates: Array.isArray(dates)
      ? [...new Set(dates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
      : [],
  };
}

function stockageParDefaut(): StockageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function lireJoursRepos(stockage: StockageLike | null = stockageParDefaut()): JoursRepos {
  try {
    const brut = stockage?.getItem(CLE_JOURS_REPOS);
    return brut ? normaliserJoursRepos(JSON.parse(brut)) : AUCUN_REPOS;
  } catch {
    return AUCUN_REPOS;
  }
}

export function ecrireJoursRepos(
  repos: JoursRepos,
  now: Date = new Date(),
  stockage: StockageLike | null = stockageParDefaut()
): JoursRepos {
  const limite = cleJourUtc(new Date(now.getTime() - CONSERVATION_JOURS * 86_400_000));
  const propre = normaliserJoursRepos(repos);
  propre.dates = propre.dates.filter((d) => d >= limite);
  try {
    stockage?.setItem(CLE_JOURS_REPOS, JSON.stringify(propre));
  } catch {
    // Sans persistance, le choix vaut pour la session en cours.
  }
  instantane = propre;
  for (const ecouteur of ecouteurs) ecouteur();
  return propre;
}

// Magasin partagé : un changement dans les Réglages recalcule tout de suite
// les séries de l'Accueil, de la fiche et du Bilan déjà montés.
let instantane: JoursRepos | null = null;
const ecouteurs = new Set<() => void>();

function sAbonner(ecouteur: () => void) {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

function lireInstantane(): JoursRepos {
  if (!instantane) instantane = lireJoursRepos();
  return instantane;
}

export function useJoursRepos(): JoursRepos {
  return useSyncExternalStore(sAbonner, lireInstantane);
}

/** Clé `YYYY-MM-DD` du jour **local** : c'est ce que l'utilisateur appelle
 *  « aujourd'hui », et ce qu'un champ `<input type="date">` renvoie. Elle
 *  désigne ensuite le jour UTC de même libellé, comme le reste des séries. */
export function cleJourLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ajoute la date si elle n'y est pas, la retire sinon. */
export function basculerDateRepos(repos: JoursRepos, cle: string): JoursRepos {
  return repos.dates.includes(cle)
    ? { ...repos, dates: repos.dates.filter((d) => d !== cle) }
    : { ...repos, dates: [...repos.dates, cle] };
}

export function basculerJourHebdo(repos: JoursRepos, jour: number): JoursRepos {
  return repos.hebdo.includes(jour)
    ? { ...repos, hebdo: repos.hebdo.filter((j) => j !== jour) }
    : { ...repos, hebdo: [...repos.hebdo, jour] };
}

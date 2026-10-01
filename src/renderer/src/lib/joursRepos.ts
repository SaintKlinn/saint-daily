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
// séance compterait. Le réglage hebdomadaire est daté et ne vaut que pour
// l'avenir : le modifier ne réécrit jamais une série déjà vécue.

/** Un réglage hebdomadaire et le jour où il a pris effet. */
export interface PeriodeHebdo {
  // `YYYY-MM-DD`, inclus. `DEPUIS_TOUJOURS` pour le réglage d'avant tout
  // historique.
  depuis: string;
  jours: number[];
}

/** Antérieur à toute date réelle : vaut « depuis toujours ». */
export const DEPUIS_TOUJOURS = '0000-01-01';

export interface JoursRepos {
  // Le réglage hebdomadaire en vigueur aujourd'hui — ce que l'écran affiche.
  // 0 = dimanche … 6 = samedi (`getUTCDay`).
  hebdo: number[];
  // Les réglages successifs, du plus ancien au plus récent : chacun vaut de
  // `depuis` (inclus) jusqu'au suivant. Absent, `hebdo` vaut depuis
  // toujours — le comportement d'avant cet historique, ce qui garde valides
  // les valeurs déjà stockées. Sans lui, décocher un jour aujourd'hui
  // réécrivait toutes les séries passées.
  historique?: PeriodeHebdo[];
  // Jours ponctuels, `YYYY-MM-DD`.
  dates: string[];
}

export const AUCUN_REPOS: JoursRepos = { hebdo: [], dates: [] };

export const CLE_JOURS_REPOS = 'saint-daily.jours-repos';

/** Clé `YYYY-MM-DD` du jour UTC d'une date. */
export function cleJourUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Les jours de la semaine en repos à la date de clé `cle` (`YYYY-MM-DD`). */
export function joursHebdoAu(repos: JoursRepos, cle: string): number[] {
  if (!repos.historique || repos.historique.length === 0) return repos.hebdo;
  let jours: number[] = [];
  for (const periode of repos.historique) {
    if (periode.depuis > cle) break;
    jours = periode.jours;
  }
  return jours;
}

export function estJourDeRepos(date: Date, repos: JoursRepos): boolean {
  const cle = cleJourUtc(date);
  return joursHebdoAu(repos, cle).includes(date.getUTCDay()) || repos.dates.includes(cle);
}

const CLE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function nettoyerJours(brut: unknown): number[] {
  return Array.isArray(brut)
    ? [...new Set(brut.filter((j): j is number => Number.isInteger(j) && j >= 0 && j <= 6))].sort()
    : [];
}

/** Valide et normalise ce qui sort du stockage : toute valeur inattendue
 *  retombe sur « aucun repos » plutôt que de fausser les séries. */
export function normaliserJoursRepos(brut: unknown): JoursRepos {
  if (!brut || typeof brut !== 'object') return AUCUN_REPOS;
  const { hebdo, dates, historique } = brut as Partial<Record<keyof JoursRepos, unknown>>;
  const datesPropres = Array.isArray(dates)
    ? [...new Set(dates.filter((d): d is string => typeof d === 'string' && CLE_JOUR.test(d)))].sort()
    : [];
  const periodes = Array.isArray(historique)
    ? historique
        .filter(
          (p): p is { depuis: string; jours: unknown } =>
            !!p && typeof p === 'object' && typeof (p as PeriodeHebdo).depuis === 'string' && CLE_JOUR.test((p as PeriodeHebdo).depuis)
        )
        .map((p) => ({ depuis: p.depuis, jours: nettoyerJours(p.jours) }))
        .sort((a, b) => (a.depuis < b.depuis ? -1 : a.depuis > b.depuis ? 1 : 0))
    : [];
  if (periodes.length === 0) {
    return { hebdo: nettoyerJours(hebdo), dates: datesPropres };
  }
  return { hebdo: periodes[periodes.length - 1].jours, historique: periodes, dates: datesPropres };
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
  stockage: StockageLike | null = stockageParDefaut()
): JoursRepos {
  const propre = normaliserJoursRepos(repos);
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

/** Le même test pour un jour **affiché** (calendrier, heatmap), donné par
 *  sa date locale : minuit local à Paris tombe la veille en UTC, et
 *  `estJourDeRepos` y lirait le mauvais jour. */
export function estJourDeReposLocal(jour: Date, repos: JoursRepos): boolean {
  const cle = cleJourLocal(jour);
  return joursHebdoAu(repos, cle).includes(jour.getDay()) || repos.dates.includes(cle);
}

/** Ajoute la date si elle n'y est pas, la retire sinon. */
export function basculerDateRepos(repos: JoursRepos, cle: string): JoursRepos {
  return repos.dates.includes(cle)
    ? { ...repos, dates: repos.dates.filter((d) => d !== cle) }
    : { ...repos, dates: [...repos.dates, cle] };
}

/** Ajoute ou retire un jour de la semaine **à partir d'`aujourdhui`**
 *  (`YYYY-MM-DD`, jour local) : les jours passés gardent le réglage qui
 *  valait alors. Plusieurs bascules le même jour ne laissent qu'une
 *  période pour ce jour. */
export function basculerJourHebdo(repos: JoursRepos, jour: number, aujourdhui: string): JoursRepos {
  const nouveau = repos.hebdo.includes(jour)
    ? repos.hebdo.filter((j) => j !== jour)
    : [...repos.hebdo, jour].sort();
  const passe = repos.historique && repos.historique.length > 0
    ? repos.historique.filter((p) => p.depuis < aujourdhui)
    : repos.hebdo.length > 0
      ? [{ depuis: DEPUIS_TOUJOURS, jours: repos.hebdo }]
      : [];
  return { ...repos, hebdo: nouveau, historique: [...passe, { depuis: aujourdhui, jours: nouveau }] };
}

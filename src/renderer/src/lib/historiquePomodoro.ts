import { addDays, startOfDay } from './calendarLayout';
import { toLocalDayKey } from './retrospective';
import type { StockageLike } from './preferencesAffichage';

// Historique des cycles de travail terminés, jour par jour, gardé sur la
// machine. Il ne peut pas être dérivé des séances en base : une fois la
// session soldée, l'entrée consolidée ne dit plus qu'elle vient d'un
// Pomodoro. Un champ `source` sur `practice_entry` le permettrait, mais au
// prix d'une migration manuelle dont l'absence ferait échouer TOUTE
// insertion de séance — on ne prend pas ce risque pour un compteur.
//
// Conséquence assumée, écrite telle quelle à l'écran : c'est un décompte
// « sur cet ordinateur ».

export const CLE_HISTORIQUE_POMODORO = 'saint-daily.pomodoro-historique';
export const JOURS_CONSERVES = 120;

export interface JourPomodoro {
  cycles: number;
  minutes: number;
}

/** Clé : jour LOCAL au format YYYY-MM-DD, comme la heatmap du Bilan. */
export type HistoriquePomodoro = Record<string, JourPomodoro>;

/** Ajoute un cycle terminé à `date`, et oublie les jours au-delà de la
 *  fenêtre de conservation. Ne modifie pas l'objet reçu. */
export function ajouterCycle(historique: HistoriquePomodoro, minutes: number, date: Date = new Date()): HistoriquePomodoro {
  const cle = toLocalDayKey(date);
  const limite = toLocalDayKey(addDays(startOfDay(date), -(JOURS_CONSERVES - 1)));
  const suivant: HistoriquePomodoro = {};
  for (const [jour, valeur] of Object.entries(historique)) {
    // Les clés YYYY-MM-DD se comparent dans l'ordre chronologique.
    if (jour >= limite) suivant[jour] = valeur;
  }
  const actuel = suivant[cle] ?? { cycles: 0, minutes: 0 };
  suivant[cle] = { cycles: actuel.cycles + 1, minutes: actuel.minutes + minutes };
  return suivant;
}

export interface JourAffiche extends JourPomodoro {
  date: Date;
  estAujourdhui: boolean;
}

/** Les `jours` derniers jours, du plus ancien à aujourd'hui inclus. */
export function derniersJours(historique: HistoriquePomodoro, jours = 7, now: Date = new Date()): JourAffiche[] {
  const aujourdhui = startOfDay(now);
  const resultat: JourAffiche[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    const date = addDays(aujourdhui, -i);
    const valeur = historique[toLocalDayKey(date)] ?? { cycles: 0, minutes: 0 };
    resultat.push({ ...valeur, date, estAujourdhui: i === 0 });
  }
  return resultat;
}

function estJour(v: unknown): v is JourPomodoro {
  if (typeof v !== 'object' || v === null) return false;
  const j = v as Record<string, unknown>;
  return (
    typeof j.cycles === 'number' && Number.isFinite(j.cycles) && typeof j.minutes === 'number' && Number.isFinite(j.minutes)
  );
}

function stockageParDefaut(): StockageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Historique vide dans tous les cas dégradés : rien d'écrit, valeur
 *  illisible, stockage refusé. Les jours mal formés sont ignorés un à un
 *  plutôt que de tout jeter. */
export function lireHistorique(stockage: StockageLike | null = stockageParDefaut()): HistoriquePomodoro {
  try {
    const brut = stockage?.getItem(CLE_HISTORIQUE_POMODORO);
    if (!brut) return {};
    const v = JSON.parse(brut) as unknown;
    if (typeof v !== 'object' || v === null) return {};
    const historique: HistoriquePomodoro = {};
    for (const [jour, valeur] of Object.entries(v)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(jour) && estJour(valeur)) historique[jour] = valeur;
    }
    return historique;
  } catch {
    return {};
  }
}

export function ecrireHistorique(historique: HistoriquePomodoro, stockage: StockageLike | null = stockageParDefaut()): void {
  try {
    stockage?.setItem(CLE_HISTORIQUE_POMODORO, JSON.stringify(historique));
  } catch {
    // Le compteur n'avance simplement pas ; la séance, elle, est en base.
  }
}

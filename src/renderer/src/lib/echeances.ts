// L'échéance d'un projet (`engagement.due_at`, posée par la 0016). Une
// échéance est un JOUR, pas un instant : on la saisit dans un champ date et
// on la compare en jours locaux. Elle est stockée à midi, heure locale, pour
// que le décalage horaire d'un `timestamptz` ne la fasse jamais changer de
// jour à la relecture (minuit local serait la veille en UTC).

import type { Engagement } from './types';

/** Horizon des rappels : une échéance entre dans l'Accueil une semaine avant. */
export const HORIZON_ECHEANCE_JOURS = 7;

const MS_JOUR = 86_400_000;

/** Valeur ISO à stocker pour un champ `<input type="date">`, ou null s'il
 *  est vide ou invalide. */
export function echeanceDepuisChamp(valeur: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (!m) return null;
  const [, a, mo, j] = m.map(Number);
  const date = new Date(a, mo - 1, j, 12);
  if (date.getMonth() !== mo - 1 || date.getDate() !== j) return null;
  return date.toISOString();
}

/** Valeur d'un champ `<input type="date">` pour une échéance stockée. */
export function echeanceVersChamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function debutJourLocal(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Jours locaux entre aujourd'hui et l'échéance : 0 le jour même, négatif
 *  en retard. `Math.round` absorbe les journées de 23 ou 25 heures des
 *  changements d'heure. */
export function joursAvantEcheance(iso: string, now: Date = new Date()): number {
  return Math.round((debutJourLocal(new Date(iso)) - debutJourLocal(now)) / MS_JOUR);
}

/** Le délai en toutes lettres, sur le modèle de `formatDormance`. */
export function libelleEcheance(jours: number): string {
  if (jours < -1) return `En retard de ${-jours} jours`;
  if (jours === -1) return 'En retard depuis hier';
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Demain';
  if (jours < 14) return `Dans ${jours} jours`;
  if (jours < 56) return `Dans ${Math.floor(jours / 7)} semaines`;
  return `Dans ${Math.round(jours / 30)} mois`;
}

/** Format court commun aux listes de dates (« mar. 29 sept. », suivi de
 *  « · 12:00 » quand l'heure compte) : un seul format par colonne, quelle
 *  que soit la nature de la ligne. */
export function dateCourte(iso: string, avecHeure = false): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return avecHeure ? `${jour} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : jour;
}

/** La date seule, pour l'afficher à côté du délai. */
export function dateEcheance(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Les projets à rappeler : actifs, avec une échéance en retard ou dans
 * l'horizon, la plus pressante d'abord. Un projet en retard le reste
 * jusqu'à ce qu'on change son échéance ou qu'on l'archive : c'est le seul
 * moyen de ne pas le laisser disparaître en silence.
 */
export function echeancesProches<T extends Pick<Engagement, 'isProject' | 'archivedAt' | 'dueAt'>>(
  engagements: T[],
  now: Date = new Date(),
  horizon = HORIZON_ECHEANCE_JOURS
): { projet: T; jours: number }[] {
  return engagements
    .filter((e) => e.isProject && !e.archivedAt && e.dueAt)
    .map((projet) => ({ projet, jours: joursAvantEcheance(projet.dueAt as string, now) }))
    .filter(({ jours }) => jours <= horizon)
    .sort((a, b) => a.jours - b.jours);
}

/**
 * Les prochaines dates d'un projet : les tâches planifiées parmi ses
 * membres, à partir d'aujourd'hui, ni passées ni sautées, dans l'ordre.
 */
export function prochainesDates<
  T extends Pick<Engagement, 'scheduledAt' | 'skippedAt' | 'archivedAt'>,
>(membres: T[], now: Date = new Date(), limite = 5): T[] {
  const aujourdhui = debutJourLocal(now);
  return membres
    .filter((m) => m.scheduledAt && !m.skippedAt && !m.archivedAt && new Date(m.scheduledAt).getTime() >= aujourdhui)
    .sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string))
    .slice(0, limite);
}

/** L'index du jour (0 à 6) d'une échéance dans la semaine qui commence à
 *  `debutSemaine`, ou null si elle tombe ailleurs. */
export function jourDansLaSemaine(iso: string, debutSemaine: Date): number | null {
  const index = Math.round((debutJourLocal(new Date(iso)) - debutJourLocal(debutSemaine)) / MS_JOUR);
  return index >= 0 && index < 7 ? index : null;
}

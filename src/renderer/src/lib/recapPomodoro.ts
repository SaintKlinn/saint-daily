import { formatMinutes } from './retrospective';

// Récapitulatif affiché à l'arrêt d'une session Pomodoro : ce qui vient
// d'être fait et enregistré, pour clore la session sur un résultat plutôt
// que sur un écran de démarrage vide.

export interface LigneRecap {
  nom: string;
  minutes: number;
}

export interface RecapSession {
  cycles: number;
  // Une ligne par engagement soldé pendant la session, dans l'ordre où il
  // a été travaillé — plusieurs quand on a enchaîné sur un autre engagement.
  engagements: LigneRecap[];
}

/** Ajoute le temps soldé sur un engagement, en fusionnant avec une ligne
 *  existante du même nom (on peut revenir sur un engagement déjà quitté). */
export function ajouterAuRecap(lignes: LigneRecap[], nom: string, minutes: number): LigneRecap[] {
  if (minutes <= 0) return lignes;
  const existante = lignes.find((l) => l.nom === nom);
  if (!existante) return [...lignes, { nom, minutes }];
  return lignes.map((l) => (l === existante ? { ...l, minutes: l.minutes + minutes } : l));
}

/** Titre et détail du récapitulatif, ou null s'il n'y a rien à dire (session
 *  arrêtée avant la première minute). */
export function resumeRecap(recap: RecapSession): { titre: string; detail: string } | null {
  const total = recap.engagements.reduce((s, l) => s + l.minutes, 0);
  if (total === 0 && recap.cycles === 0) return null;
  const titre =
    recap.cycles === 0
      ? 'Session terminée'
      : `${recap.cycles} cycle${recap.cycles > 1 ? 's' : ''} terminé${recap.cycles > 1 ? 's' : ''}`;
  if (total === 0) return { titre, detail: 'Aucune minute enregistrée.' };
  const enregistre = `${formatMinutes(total)} enregistrée${total > 1 ? 's' : ''}`;
  const detail =
    recap.engagements.length === 1
      ? `${enregistre} sur ${recap.engagements[0].nom}.`
      : `${enregistre} : ${recap.engagements.map((l) => `${l.nom} ${formatMinutes(l.minutes)}`).join(', ')}.`;
  return { titre, detail };
}

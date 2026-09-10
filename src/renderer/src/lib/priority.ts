import { colors } from '../theme/colors';
import type { Priority } from './types';

export const PRIORITY_LEVELS: Priority[] = ['aucune', 'basse', 'moyenne', 'elevee'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  aucune: 'Aucune',
  basse: 'Basse',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
};

// `aucune` n'a pas de couleur : ça laisse l'UI dans son état actuel
// (pas de pastille, pas de liseré) plutôt que d'introduire une couleur
// "neutre" qui ajouterait un élément visuel qui n'existe pas aujourd'hui.
export const PRIORITY_COLORS: Record<Priority, string | null> = {
  aucune: null,
  basse: colors.priority.basse,
  moyenne: colors.priority.moyenne,
  elevee: colors.priority.elevee,
};

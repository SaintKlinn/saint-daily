// Premier usage de `localStorage` dans le renderer : isolé ici avec ses
// tests pour que le deuxième ne le recopie pas mal.
//
// Ce n'est délibérément PAS une colonne de `settings`. C'est une préférence
// d'affichage propre à la machine, pas au compte ; et une colonne coûterait
// une migration manuelle en tombant sous la règle « jamais de nouvelle
// colonne dans l'INSERT des réglages par défaut », dont l'échec rendrait
// tout l'écran Réglages inaccessible pour toujours.
//
// Toute lecture et toute écriture sont gardées : l'accès au stockage peut
// lever (stockage désactivé, quota, contexte sans origine), et jusqu'à
// l'accès à la propriété elle-même.

export const CLE_RAIL_EPINGLE = 'saint-daily.rail-epingle';

/** Le sous-ensemble de `Storage` réellement utilisé. Le déclarer permet
 *  d'injecter un double dans les tests, qui tournent sans jsdom — il n'y a
 *  donc aucun `localStorage` global à y fabriquer. */
export interface StockageLike {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

function stockageParDefaut(): StockageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** `false` — replié — est le défaut, et le repli de tous les cas dégradés :
 *  clé absente, valeur corrompue, stockage refusé. La comparaison stricte à
 *  `'true'` suffit à couvrir les trois. */
export function lireRailEpingle(stockage: StockageLike | null = stockageParDefaut()): boolean {
  try {
    return stockage?.getItem(CLE_RAIL_EPINGLE) === 'true';
  } catch {
    return false;
  }
}

export function ecrireRailEpingle(
  epingle: boolean,
  stockage: StockageLike | null = stockageParDefaut()
): void {
  try {
    stockage?.setItem(CLE_RAIL_EPINGLE, String(epingle));
  } catch {
    // Sans persistance, le rail garde simplement son état pour la session
    // en cours. Rien à remonter à l'utilisateur.
  }
}

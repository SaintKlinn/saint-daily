// Palette de commandes (Ctrl+K) : ce module décide seulement quoi proposer
// et dans quel ordre. Le composant (components/PaletteCommandes.tsx) se
// charge de l'affichage et de l'exécution.

export type GroupeCommande = 'Actions' | 'Écrans' | 'Skills' | 'Projets';

export interface Commande {
  id: string;
  groupe: GroupeCommande;
  libelle: string;
  // Complément affiché en retrait (« Nouvelle entrée », « Pomodoro »…) et
  // cherché avec le libellé : « piano pomo » trouve « Piano · Pomodoro ».
  detail?: string;
  // Mots cherchés en plus, jamais affichés (« stats » pour le Bilan).
  motsCles?: string[];
  // Proposée seulement quand on tape quelque chose : sans elle, trois
  // lignes par skill noieraient la liste vide.
  surRecherche?: boolean;
}

/** Minuscules, sans accents ni ponctuation superflue : « Réglages » et
 *  « reglages » doivent se trouver l'un l'autre. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .trim();
}

/**
 * Score d'un texte pour un terme, ou null s'il ne correspond pas. Du
 * meilleur au moins bon : début du texte, début d'un mot, n'importe où,
 * puis lettres dans l'ordre (« dtl » trouve « détail »), pénalisées par
 * leur dispersion. `flou: false` s'arrête aux correspondances exactes.
 */
export function scoreTerme(texte: string, terme: string, flou = true): number | null {
  if (!terme) return 0;
  if (texte.startsWith(terme)) return 100;
  const index = texte.indexOf(terme);
  if (index > 0 && texte[index - 1] === ' ') return 80;
  if (index > 0) return 60;
  if (!flou) return null;
  let position = -1;
  let ecart = 0;
  for (const lettre of terme) {
    const suivante = texte.indexOf(lettre, position + 1);
    if (suivante === -1) return null;
    if (position >= 0) ecart += suivante - position - 1;
    position = suivante;
  }
  return Math.max(1, 40 - ecart);
}

/**
 * Les commandes qui correspondent à la recherche, les meilleures d'abord.
 * Chaque mot tapé doit se retrouver dans le libellé (même en lettres
 * dispersées), le détail ou les mots clés (tel quel) ; le score est la
 * somme des scores des mots, le libellé comptant double. À score égal,
 * l'ordre d'origine est conservé.
 */
export function filtrerCommandes(commandes: Commande[], recherche: string, limite = 50): Commande[] {
  const termes = normaliser(recherche).split(/\s+/).filter(Boolean);
  if (termes.length === 0) return commandes.filter((c) => !c.surRecherche).slice(0, limite);
  const notees: { commande: Commande; score: number; rang: number }[] = [];
  commandes.forEach((commande, rang) => {
    const libelle = normaliser(commande.libelle);
    const autres = normaliser([commande.detail ?? '', ...(commande.motsCles ?? [])].join(' '));
    let total = 0;
    for (const terme of termes) {
      const surLibelle = scoreTerme(libelle, terme);
      // Pas de flou sur le détail et les mots clés : sur une longue liste
      // de synonymes, presque tout terme y trouverait ses lettres dans
      // l'ordre (« repos » dans « paramètres préférences options »).
      const surAutres = scoreTerme(autres, terme, false);
      const meilleur = Math.max(surLibelle === null ? -1 : surLibelle * 2, surAutres ?? -1);
      if (meilleur < 0) return;
      total += meilleur;
    }
    notees.push({ commande, score: total, rang });
  });
  notees.sort((a, b) => b.score - a.score || a.rang - b.rang);
  return notees.slice(0, limite).map((n) => n.commande);
}

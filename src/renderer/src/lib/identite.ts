// Le pseudonyme vient de `user_metadata.username`, que la session porte
// déjà : aucune requête, donc rien à casser quand la base est injoignable
// ou que le schéma a bougé — précisément les moments où savoir sur quel
// compte on est compte le plus. L'autre source possible, `public.profile`
// (table de Saint Gym, restée dans `public`), donnerait la même valeur au
// prix d'une requête vers l'autre app.

interface UtilisateurLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Renvoie le pseudonyme à afficher, ou `null` s'il n'y a rien d'affichable.
 *
 * Replis successifs : un compte créé sans `username` ne doit pas afficher
 * un vide — la partie locale de l'e-mail identifie déjà le compte, et
 * l'e-mail entier reste préférable à rien.
 */
export function pseudonyme(utilisateur: UtilisateurLike | null | undefined): string | null {
  if (!utilisateur) return null;

  const brut = utilisateur.user_metadata?.username;
  if (typeof brut === 'string' && brut.trim()) return brut.trim();

  const email = typeof utilisateur.email === 'string' ? utilisateur.email.trim() : '';
  if (!email) return null;

  const arobase = email.indexOf('@');
  // `> 0` et non `!== -1` : une adresse commençant par « @ » donnerait une
  // partie locale vide, auquel cas l'adresse entière vaut mieux que rien.
  if (arobase > 0) return email.slice(0, arobase);
  return email;
}

/**
 * Les trois morceaux du salut d'accueil, le pseudonyme isolé parce qu'il
 * est le seul à être cliquable.
 *
 * Le cas sans pseudonyme n'est pas un état dégradé à rattraper dans le
 * balisage : la phrase doit alors valoir exactement « Bon retour. ». C'est
 * pour cela que `avant` porte déjà son propre point dans ce cas, plutôt que
 * de laisser l'appelant recoller une ponctuation — ce qui produirait soit
 * une phrase sans point, soit une espace orpheline devant lui.
 */
export function salutation(utilisateur: UtilisateurLike | null | undefined): {
  avant: string;
  pseudo: string | null;
  apres: string;
} {
  const pseudo = pseudonyme(utilisateur);
  if (!pseudo) return { avant: 'Bon retour.', pseudo: null, apres: '' };
  return { avant: 'Bon retour ', pseudo, apres: '.' };
}

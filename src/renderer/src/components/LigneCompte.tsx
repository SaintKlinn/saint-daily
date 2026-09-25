import { Link } from 'react-router-dom';
import { initiale, pseudonyme } from '../lib/identite';
import { useAuth } from '../lib/auth';

// Le compte en bas du rail. Replié, c'est l'initiale seule — la pastille
// d'origine, inchangée, y compris ses contrastes déjà vérifiés. Déplié, le
// pseudonyme entier s'affiche à côté.
//
// Contrastes sur le bas du rail, où le dégradé finit sur ink-950 :
// `border-ink-700` seul n'y donne que 2.50:1, sous le seuil de 3:1 des
// éléments non textuels — d'où le fond plein plutôt qu'une simple bordure.
// Sur ce fond ink-800, la lettre en `muted` est à 4.57:1, au-dessus du
// seuil de 4.5:1 des textes (valeur documentée dans theme/colors.ts).
// `accent-bright` est volontairement évité : il signale l'élément de nav
// actif juste au-dessus, et une pastille dorée lui disputerait ce rôle.
//
// C'est désormais un lien : il mène à la section Compte, placée en tête de
// Réglages. Pas d'ancre dans l'URL — l'application est en HashRouter, où
// le fragment porte déjà la route ; un second `#` n'y a aucun sens.
export default function LigneCompte({ deplie }: { deplie: boolean }) {
  const { session } = useAuth();
  const pseudo = pseudonyme(session?.user);
  if (!pseudo) return null;

  const libelle = `Connecté en tant que ${pseudo}`;

  return (
    // `relative` pour passer devant RailFlare, qui est en `absolute` et
    // vient après dans le DOM — même raison que le bloc des liens de nav.
    // `px-4` autour d'une case de 40 donne exactement les 72 px repliés,
    // comme les liens de nav : les deux colonnes d'icônes s'alignent.
    <Link
      to="/reglages"
      aria-label={libelle}
      title={deplie ? undefined : libelle}
      className="group relative mb-2 flex h-10 w-full shrink-0 items-center rounded-[10px] px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:ring-inset"
    >
      {/* Pas de `tracking` sur l'initiale : sur une seule lettre,
          l'interlettrage n'ajoute qu'une chasse à droite et décentre le
          glyphe. */}
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-ink-700 bg-ink-800 font-data text-corps text-muted"
      >
        {initiale(pseudo)}
      </span>
      {/* Monté dans les deux états et seulement estompé — même raison que
          les libellés de nav. `aria-hidden` parce que l'`aria-label` du
          lien porte déjà le nom accessible complet. */}
      <span
        aria-hidden="true"
        className={`ml-3 truncate text-secondaire text-muted transition-colors group-hover:text-champagne transition-opacity duration-200 ${
          deplie ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {pseudo}
      </span>
    </Link>
  );
}

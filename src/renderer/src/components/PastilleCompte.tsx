import { initiale, pseudonyme } from '../lib/identite';
import { useAuth } from '../lib/auth';

// Pastille d'identité en bas du rail : le rail est en icônes sans texte
// (maquette V2), donc le pseudonyme entier n'y tiendrait pas — on montre
// l'initiale, et le nom complet arrive par l'infobulle et par le texte
// lecteur d'écran.
//
// Contrastes sur le bas du rail, où le dégradé finit sur ink-950 :
// `border-ink-700` seul n'y donne que 2.50:1, sous le seuil de 3:1 des
// éléments non textuels — d'où le fond plein plutôt qu'une simple bordure.
// Sur ce fond ink-800, la lettre en `muted` est à 4.57:1, au-dessus du
// seuil de 4.5:1 des textes (valeur déjà documentée dans theme/colors.ts).
// `accent-bright` est volontairement évité : il signale l'élément de nav
// actif juste au-dessus, et une pastille dorée lui disputerait ce rôle.
export default function PastilleCompte() {
  const { session } = useAuth();
  const pseudo = pseudonyme(session?.user);
  if (!pseudo) return null;

  const libelle = `Connecté en tant que ${pseudo}`;

  return (
    // `relative` pour passer devant RailFlare, qui est en `absolute` et
    // vient après dans le DOM — même raison que le bloc des liens de nav.
    // Plus de `mt-auto` ici : c'est le bloc de nav qui porte `flex-1`, donc
    // la poussée vers le bas, depuis que Réglages s'ancre en bas de ce bloc.
    // `rounded-[10px]` : le rail a sa propre grammaire d'arrondi, celle des
    // pastilles de nav de 40×40 juste au-dessus ; des angles vifs y
    // jureraient, même si le reste de l'app n'a aucun rayon.
    <div
      title={libelle}
      className="relative mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-ink-700 bg-ink-800 font-data text-corps text-muted"
    >
      {/* Pas de `tracking` ici : sur une seule lettre, l'interlettrage
          n'ajoute qu'une chasse à droite et décentre le glyphe. */}
      <span aria-hidden="true">{initiale(pseudo)}</span>
      <span className="sr-only">{libelle}</span>
    </div>
  );
}

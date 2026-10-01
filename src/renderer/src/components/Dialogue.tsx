import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { EASE_SORTIE } from '../theme/mouvement';

interface DialogueProps {
  onFermer: () => void;
  children: ReactNode;
  // Nom accessible : l'id d'un titre visible, ou à défaut un libellé.
  titreId?: string;
  libelle?: string;
  // Faux pendant un enregistrement : ni Échap ni clic à côté ne ferment,
  // pour ne pas laisser croire que l'action a été annulée.
  fermable?: boolean;
  // `haut` pour la palette, qui s'ouvre sous le haut de l'écran comme une
  // barre de recherche ; `centre` pour tout le reste.
  placement?: 'centre' | 'haut';
  className?: string;
}

const FOCUSABLES =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Fenêtres ouvertes, de la plus ancienne à la plus récente. Seule celle du
// dessus réagit à Échap et à Tab : sans pile, chacune écoutait `window`, et
// un Échap dans la palette ouverte par-dessus l'éditeur fermait les deux —
// en perdant la saisie de l'éditeur.
const pile: symbol[] = [];

/**
 * La fenêtre commune de l'app : éditeur de séance, palette de commandes.
 *
 * Elle est rendue hors de `#root` (portail) et rend `#root` inerte tant
 * qu'elle est ouverte : le navigateur exclut alors toute la page du parcours
 * au clavier et des lecteurs d'écran, et Tab boucle à l'intérieur. Avant
 * elle, 9 appuis sur Tab sur 15 sortaient de l'éditeur vers le Journal grisé
 * derrière (audit graphique, H2).
 *
 * À la fermeture, le focus revient à l'élément qui l'avait avant
 * l'ouverture : un clavier ne se retrouve pas au début de la page.
 *
 * Seule la fenêtre du dessus réagit au clavier (Échap et Tab).
 */
export default function Dialogue({
  onFermer,
  children,
  titreId,
  libelle,
  fermable = true,
  placement = 'centre',
  className = '',
}: DialogueProps) {
  const fermableRef = useRef(fermable);
  fermableRef.current = fermable;
  const onFermerRef = useRef(onFermer);
  onFermerRef.current = onFermer;
  const panneauRef = useRef<HTMLDivElement>(null);

  // Capturé pendant le premier rendu, AVANT que React n'applique l'autoFocus
  // d'un enfant (phase de commit). Dans l'effet, c'était déjà le champ de la
  // fenêtre elle-même, détaché à la fermeture : le focus tombait sur la page.
  const [avant] = useState(() => document.activeElement as HTMLElement | null);
  const [jeton] = useState(() => Symbol('dialogue'));

  useEffect(() => {
    pile.push(jeton);
    const racine = document.getElementById('root');
    // Deux fenêtres peuvent se superposer (Ctrl+K depuis l'éditeur) : on ne
    // relâche `inert` que si c'est cette fenêtre qui l'a posé.
    const posee = racine && !racine.inert;
    if (posee) racine.inert = true;
    function onKeyDown(e: KeyboardEvent) {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === 'Escape' && fermableRef.current) {
        e.preventDefault();
        onFermerRef.current();
        return;
      }
      // `inert` sort la page du parcours, mais après le dernier élément de
      // la fenêtre Tab quitterait le document. On boucle donc du dernier
      // au premier, et l'inverse avec Maj.
      if (e.key !== 'Tab' || !panneauRef.current) return;
      const focusables = [...panneauRef.current.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0
      );
      if (focusables.length === 0) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      const actif = document.activeElement;
      const dedans = panneauRef.current.contains(actif);
      if (e.shiftKey && (actif === premier || !dedans)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actif === dernier || !dedans)) {
        e.preventDefault();
        premier.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    // Focus initial : un champ `autoFocus` passe en premier ; sinon le
    // premier élément de la fenêtre, pour qu'un clavier n'y entre pas à
    // l'aveugle depuis un bouton désormais inerte.
    const idFocus = requestAnimationFrame(() => {
      const panneau = panneauRef.current;
      if (!panneau || panneau.contains(document.activeElement)) return;
      panneau.querySelector<HTMLElement>(FOCUSABLES)?.focus();
    });
    return () => {
      const position = pile.lastIndexOf(jeton);
      if (position >= 0) pile.splice(position, 1);
      cancelAnimationFrame(idFocus);
      window.removeEventListener('keydown', onKeyDown);
      if (posee) racine.inert = false;
      avant?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-ink-950/70 backdrop-blur-[2px] ${placement === 'haut' ? 'items-start px-6 pt-[12vh]' : 'items-center p-6'}`}
      onClick={() => fermable && onFermer()}
    >
      <motion.div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        aria-label={titreId ? undefined : libelle}
        initial={placement === 'haut' ? { opacity: 0, y: -8, scale: 0.98 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: placement === 'haut' ? 0.18 : 0.3, ease: EASE_SORTIE }}
        className={`relative border border-ink-700 bg-ink-900 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
}

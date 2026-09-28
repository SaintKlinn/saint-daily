import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';
import { buttonClassName } from './Button';
import { EASE_SORTIE } from '../theme/mouvement';

// Extrait d'Accueil.tsx (EmptyReminders) pour être réutilisé partout où un
// écran a un état vide/chargement — plutôt qu'un <p> nu (audit ui-ux-pro-max).
//
// `titre` et `action` sont optionnels : un chargement ou un résultat de
// recherche vide n'a rien à proposer, mais un écran vide au premier
// lancement doit dire ce qu'il contiendra et comment y arriver, plutôt que
// de constater une absence (audit visuel du 2026-09-28).
export default function EmptyState({
  children,
  role,
  titre,
  action,
}: {
  children: ReactNode;
  role?: 'status' | 'alert';
  titre?: string;
  action?: { libelle: string; vers: string };
}) {
  return (
    <motion.div
      role={role}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_SORTIE }}
      className="flex flex-col items-center gap-3 border border-dashed border-ink-700 px-6 py-8 text-center"
    >
      <LogoMark size={titre ? 34 : 26} className={titre ? 'opacity-80' : 'opacity-50'} />
      {titre && <p className="font-serif text-titre text-champagne">{titre}</p>}
      <p className={`max-w-md text-corps text-muted ${titre ? '-mt-1' : ''}`}>{children}</p>
      {action && (
        <Link to={action.vers} className={`${buttonClassName('accent-outline', 'sm')} mt-1`}>
          {action.libelle}
        </Link>
      )}
    </motion.div>
  );
}

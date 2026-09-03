import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import LogoMark from './LogoMark';

// Extrait d'Accueil.tsx (EmptyReminders) pour être réutilisé partout où un
// écran a un état vide/chargement — plutôt qu'un <p> nu (audit ui-ux-pro-max).
export default function EmptyState({ children, role }: { children: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <motion.div
      role={role}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-2.5 border border-dashed border-ink-700 px-6 py-9 text-center"
    >
      <LogoMark size={26} className="opacity-50" />
      <p className="text-sm text-muted">{children}</p>
    </motion.div>
  );
}

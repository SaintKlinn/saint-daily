import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from '../components/LogoMark';
import { buttonClassName } from '../components/Button';

export default function Introuvable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col items-center justify-center gap-5 text-champagne"
    >
      <LogoMark size={80} className="opacity-30" animated />
      <h1 className="font-serif text-[32px] text-champagne">Introuvable</h1>
      <p className="max-w-[360px] text-center text-sm leading-relaxed text-muted">
        Ce skill n'existe plus, ou a été supprimé. Le lien qui vous a mené ici n'est plus valide.
      </p>
      <Link to="/" className={`mt-1 ${buttonClassName('primary')}`}>
        Retour à l'accueil
      </Link>
    </motion.div>
  );
}

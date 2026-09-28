import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from '../components/LogoMark';
import { buttonClassName } from '../components/Button';
import { EASE_SORTIE } from '../theme/mouvement';

type Sujet = 'skill' | 'projet';

// Trois situations, trois messages : une adresse inconnue n'a rien à voir
// avec un skill supprimé, et un élément encore dans la corbeille n'est pas
// « perdu » — le dire, et y mener, évite de croire à une perte de données.
// Le texte d'origine parlait d'un skill pour toute adresse inconnue, et
// vouvoyait dans une app qui tutoie partout ailleurs.
function message(sujet: Sujet | undefined, enCorbeille: boolean): { titre: string; texte: string } {
  const nom = sujet === 'projet' ? 'Ce projet' : 'Ce skill';
  if (sujet && enCorbeille) {
    return {
      titre: 'Dans la corbeille',
      texte: `${nom} a été supprimé, mais il est toujours dans la corbeille : tu peux le restaurer.`,
    };
  }
  if (sujet) {
    return {
      titre: 'Introuvable',
      texte: `${nom} n'existe plus : il a été supprimé définitivement, ou le lien qui t'a mené ici n'est plus valide.`,
    };
  }
  return { titre: 'Page introuvable', texte: 'Cette adresse ne mène nulle part dans Saint Daily.' };
}

export default function Introuvable({ sujet, enCorbeille = false }: { sujet?: Sujet; enCorbeille?: boolean }) {
  const { titre, texte } = message(sujet, enCorbeille);
  const versCorbeille = Boolean(sujet && enCorbeille);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_SORTIE }}
      className="flex h-full flex-col items-center justify-center gap-6 text-champagne"
    >
      <LogoMark size={80} className="opacity-30" animation="revelation" />
      <h1 className="font-serif text-titre-ecran text-champagne">{titre}</h1>
      <p className="max-w-[360px] text-center text-corps text-muted">{texte}</p>
      <div className="mt-1 flex items-center gap-3">
        {versCorbeille && (
          <Link to="/corbeille" className={buttonClassName('primary')}>
            Ouvrir la corbeille
          </Link>
        )}
        <Link to="/" className={buttonClassName(versCorbeille ? 'secondary' : 'primary')}>
          Retour à l'accueil
        </Link>
      </div>
    </motion.div>
  );
}

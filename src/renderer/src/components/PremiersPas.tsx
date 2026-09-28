import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import RayCorner from './RayCorner';
import { buttonClassName } from './Button';
import { colors } from '../theme/colors';
import { EASE_SORTIE, itemTransition, itemVariants, listVariants } from '../theme/mouvement';

// Les trois gestes de base, dans l'ordre où ils se débloquent : sans skill,
// ni séance ni pomodoro ne sont possibles (les deux écrans demandent un
// skill). Seule la première étape porte donc un bouton ; les deux autres
// disent ce qui vient ensuite.
const ETAPES = [
  {
    titre: 'Crée ton premier skill',
    detail: 'Une compétence que tu veux pratiquer régulièrement : piano, espagnol, dessin…',
  },
  {
    titre: 'Logge une séance',
    detail: 'Sa durée, ton humeur, une note si tu veux. La série et le Bilan partent de là.',
  },
  {
    titre: 'Lance un pomodoro',
    detail: 'Quand tu veux t’y mettre sans compter : le temps est enregistré pour toi.',
  },
];

/**
 * Accueil d'un compte neuf, à la place des chiffres (tous à zéro) et des
 * rappels (forcément vides) : au premier lancement, l'Accueil dit par où
 * commencer au lieu d'aligner des zéros.
 */
export default function PremiersPas() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE_SORTIE }}
      aria-labelledby="premiers-pas-titre"
      className="relative flex flex-col gap-6 overflow-hidden border border-accent-bright/35 px-8 py-8"
      style={{
        background: `linear-gradient(160deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 65%, ${colors.accent.bright}14 100%)`,
        boxShadow: `inset 0 1px 0 ${colors.accent.bright}14, 0 18px 34px -26px rgba(0, 0, 0, 0.8)`,
      }}
    >
      <RayCorner variant={0} />
      <div className="relative flex items-center gap-4">
        <LogoMark size={44} animation="revelation" />
        <div>
          <h2 id="premiers-pas-titre" className="font-serif text-titre-ecran text-champagne">
            Bienvenue dans Saint Daily
          </h2>
          <p className="mt-1 text-corps text-muted">Trois gestes pour démarrer.</p>
        </div>
      </div>
      <motion.ol
        initial="hidden"
        animate="visible"
        variants={listVariants}
        transition={{ delayChildren: 0.3 }}
        className="relative grid grid-cols-3 gap-6"
      >
        {ETAPES.map((etape, index) => {
          const active = index === 0;
          return (
            <motion.li key={etape.titre} variants={itemVariants} transition={itemTransition} className="flex flex-col gap-2">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 items-center justify-center rounded-full border font-data text-libelle ${
                  active ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted'
                }`}
              >
                {index + 1}
              </span>
              <p className={`font-sans text-corps font-semibold ${active ? 'text-champagne' : 'text-muted'}`}>
                {etape.titre}
              </p>
              <p className="text-secondaire text-muted">{etape.detail}</p>
              {active && (
                <Link to="/skills/nouveau" className={`${buttonClassName('primary', 'sm')} mt-1 w-fit`}>
                  Créer mon premier skill
                </Link>
              )}
            </motion.li>
          );
        })}
      </motion.ol>
    </motion.section>
  );
}

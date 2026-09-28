import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AMBIANCES, alphaHex, momentDeLaJournee, type Moment } from '../lib/ambiance';

// Le moment change quatre fois par jour : une vérification toutes les
// cinq minutes suffit largement, et ne coûte rien.
const VERIFICATION_MS = 5 * 60_000;

/**
 * Fond d'ambiance de l'app, derrière le contenu de <main> (AppShell).
 *
 * - Il respire : le calque dérive très lentement, sur 40 s, en aller-retour
 *   (`.fond-derive`, index.css). Une transformation seulement, donc peu
 *   coûteuse, et coupée par `prefers-reduced-motion`.
 * - Il suit l'heure : teinte et intensité du halo changent selon le moment
 *   de la journée (lib/ambiance.ts), en fondu enchaîné de 3 s — le seul
 *   moyen de passer d'un dégradé à un autre, que CSS ne sait pas interpoler.
 *
 * Posé hors de la zone qui défile : le halo reste en haut de la fenêtre au
 * lieu de partir avec le contenu.
 */
export default function FondAmbiant() {
  const [moment, setMoment] = useState<Moment>(() => momentDeLaJournee());

  useEffect(() => {
    const id = window.setInterval(() => setMoment(momentDeLaJournee()), VERIFICATION_MS);
    return () => window.clearInterval(id);
  }, []);

  const { teinte, intensite } = AMBIANCES[moment];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={moment}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* Déborde de 10 % de chaque côté : la dérive ne doit jamais
              découvrir un bord du calque. */}
          <div
            className="fond-derive absolute -inset-[10%]"
            style={{
              backgroundImage: `radial-gradient(ellipse 1100px 560px at 60% 4%, ${teinte}${alphaHex(
                intensite
              )}, transparent 62%), radial-gradient(ellipse 700px 420px at 14% 76%, ${teinte}${alphaHex(
                intensite / 2
              )}, transparent 68%)`,
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

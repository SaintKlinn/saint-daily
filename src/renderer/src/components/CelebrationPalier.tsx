import { motion, useReducedMotion } from 'motion/react';
import LogoMark from './LogoMark';
import RayCorner from './RayCorner';
import Button from './Button';
import { messagePalier } from '../lib/paliers';
import { colors } from '../theme/colors';
import { EASE_SORTIE } from '../theme/mouvement';

// Gerbe de rayons autour du logo : seize traits qui jaillissent du centre
// une seule fois, dans l'esprit des rayons de la marque, puis s'effacent.
const RAYONS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const long = i % 2 === 0 ? 46 : 34;
  return {
    x1: 50 + Math.cos(angle) * 16,
    y1: 50 + Math.sin(angle) * 16,
    x2: 50 + Math.cos(angle) * long,
    y2: 50 + Math.sin(angle) * long,
  };
});

/**
 * Célébration d'un palier de série sur l'Accueil (7, 30, 100, 365 jours).
 * Reste affichée jusqu'au clic sur « Merci » : c'est ce clic qui marque le
 * palier comme fêté (voir Accueil), pour qu'un passage éclair sur l'écran
 * ne la fasse pas manquer pour de bon.
 */
export default function CelebrationPalier({ palier, onFermer }: { palier: number; onFermer: () => void }) {
  const reduire = useReducedMotion();
  const { titre, detail } = messagePalier(palier);
  return (
    <motion.section
      role="status"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_SORTIE }}
      className="relative flex items-center gap-6 overflow-hidden border border-accent-bright/40 px-6 py-6"
      style={{
        background: `linear-gradient(120deg, ${colors.accent.bright}24 0%, ${colors.ink[800]} 45%, ${colors.ink[900]} 100%)`,
        boxShadow: `inset 0 1px 0 ${colors.accent.bright}24, 0 18px 34px -26px rgba(0, 0, 0, 0.8)`,
      }}
    >
      <RayCorner variant={0} />
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
        {/* La gerbe et le halo sont purement décoratifs, et coupés quand
            l'OS demande moins d'animations : il reste le logo et le texte. */}
        {!reduire && (
          <>
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{ background: `radial-gradient(circle, ${colors.accent.bright}66, transparent 70%)` }}
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.4, ease: EASE_SORTIE, delay: 0.25 }}
            />
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
              {RAYONS.map((r, i) => (
                <motion.line
                  key={i}
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  stroke={colors.accent.bright}
                  strokeWidth={2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: 0 }}
                  transition={{ duration: 1.1, ease: EASE_SORTIE, delay: 0.3 + (i % 4) * 0.04 }}
                />
              ))}
            </svg>
          </>
        )}
        <LogoMark size={56} animation="revelation" className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Palier atteint</p>
        <p className="mt-1 font-serif text-titre-ecran text-accent-bright">{titre}</p>
        <p className="mt-1 text-corps text-champagne">{detail}</p>
      </div>
      <Button variant="accent-outline" size="sm" onClick={onFermer} className="relative shrink-0">
        Merci
      </Button>
    </motion.section>
  );
}

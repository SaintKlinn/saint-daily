import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import LogoMark from './LogoMark';
import RayCorner from './RayCorner';
import Button from './Button';
import { messagePalier } from '../lib/paliers';
import { jouerCarillon } from '../lib/carillon';
import { lireSonPomodoro } from '../lib/preferencesAffichage';
import { colors } from '../theme/colors';
import { EASE_SORTIE } from '../theme/mouvement';

// Éclat autour du logo, en deux temps APRÈS son dessin (voir le composant).
// Il ne reprend volontairement ni la forme ni la couleur du logo : des
// rayons dorés partant du centre se confondaient avec les siens, qui sont
// exactement cela. Ici : un anneau fin qui s'élargit et de courtes
// étincelles champagne, qui naissent au bord du logo et s'en éloignent sans
// jamais le traverser.
const DEBUT_ECLAT = 0.9; // s — le dessin du logo (revelation) est alors presque fini
const ETINCELLES = Array.from({ length: 12 }, (_, i) => {
  // Décalées d'un demi-pas pour ne pas s'aligner sur les rayons du logo.
  const angle = ((i + 0.5) / 12) * Math.PI * 2;
  const point = (r: number) => ({ x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r });
  return { depart: [point(38), point(42)], arrivee: [point(50), point(57)], retard: (i % 3) * 0.05 };
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

  // Le carillon part avec l'éclat, pas à l'apparition du bandeau : le son
  // souligne le moment fort. Sans animation (moins de mouvement demandé),
  // il n'y a pas d'éclat à attendre, il joue tout de suite. Le nettoyage
  // annule un son pas encore parti si le bandeau disparaît avant — et évite
  // aussi le double son du double montage de StrictMode en développement.
  useEffect(() => {
    if (!lireSonPomodoro()) return;
    const id = window.setTimeout(() => jouerCarillon('palier'), reduire ? 0 : DEBUT_ECLAT * 1000);
    return () => window.clearTimeout(id);
  }, [reduire]);
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
        {/* L'éclat est purement décoratif, et coupé quand l'OS demande
            moins d'animations : il reste le logo et le texte. */}
        {!reduire && (
          <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
            <motion.circle
              cx={50}
              cy={50}
              fill="none"
              stroke={colors.champagne}
              strokeWidth={1}
              initial={{ r: 34, opacity: 0 }}
              animate={{ r: 58, opacity: [0, 0.7, 0] }}
              transition={{ duration: 1.1, ease: EASE_SORTIE, delay: DEBUT_ECLAT }}
            />
            {ETINCELLES.map(({ depart, arrivee, retard }, i) => (
              <motion.line
                key={i}
                stroke={colors.champagne}
                strokeWidth={1.6}
                strokeLinecap="round"
                initial={{ x1: depart[0].x, y1: depart[0].y, x2: depart[1].x, y2: depart[1].y, opacity: 0 }}
                animate={{
                  x1: arrivee[0].x,
                  y1: arrivee[0].y,
                  x2: arrivee[1].x,
                  y2: arrivee[1].y,
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 0.9, ease: EASE_SORTIE, delay: DEBUT_ECLAT + 0.08 + retard }}
              />
            ))}
          </svg>
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

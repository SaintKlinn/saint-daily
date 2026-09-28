import { motion, useReducedMotion } from 'motion/react';
import type { PomodoroPhase } from '../lib/pomodoroLogic';

interface PointsCyclesProps {
  // 0-based, comme `session.cycleIndex`.
  cycleIndex: number;
  total: number;
  phase: PomodoroPhase;
  taille?: 'normale' | 'petite';
}

/**
 * Où en est la série avant la pause longue, en points plutôt qu'en « cycle
 * 2/4 » : pleins pour les cycles faits, cerclé et pulsant pour le cycle en
 * cours, vides pour ceux qui restent.
 *
 * Pendant une pause, le cycle qui vient de se terminer est déjà plein :
 * `cycleIndex` n'avance qu'au retour au travail (voir nextPhase), donc sans
 * ce cas le point du cycle achevé resterait « en cours » toute la pause.
 */
export default function PointsCycles({ cycleIndex, total, phase, taille = 'normale' }: PointsCyclesProps) {
  const reduire = useReducedMotion();
  const faits = phase === 'work' ? cycleIndex : cycleIndex + 1;
  const dimension = taille === 'petite' ? 'h-[7px] w-[7px]' : 'h-[9px] w-[9px]';
  return (
    <div
      role="img"
      aria-label={`Cycle ${Math.min(cycleIndex + 1, total)} sur ${total}${phase === 'work' ? '' : ', terminé'}`}
      className="flex items-center gap-2"
    >
      {Array.from({ length: total }, (_, i) => {
        const fait = i < faits;
        const enCours = phase === 'work' && i === cycleIndex;
        return (
          <span key={i} className={`relative ${dimension}`}>
            <span
              className={`absolute inset-0 rounded-full border ${
                fait ? 'border-accent-bright bg-accent-bright' : enCours ? 'border-accent-bright' : 'border-muted/50'
              }`}
            />
            {/* Halo qui respire autour du cycle en cours. Une opacité et
                non une transformation : `reducedMotion="user"` ne l'arrêterait
                pas, d'où la vérification explicite. */}
            {enCours && !reduire && (
              <motion.span
                aria-hidden="true"
                className="absolute -inset-1 rounded-full bg-accent-bright/30"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

import type { GoalProgress as GoalProgressValue } from '../lib/motivation';
import BarreProgression from './BarreProgression';

export default function GoalProgress({ progress }: { progress: GoalProgressValue }) {
  const reached = progress.current >= progress.target;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Objectif</span>
        {/* Le libellé porte l'information ; la couleur ne fait que la
            souligner, elle ne la remplace jamais. */}
        <span className={`font-data text-libelle tabular-nums ${reached ? 'text-accent-bright' : 'text-champagne'}`}>
          {progress.label}
          {reached ? ' · atteint' : ''}
        </span>
      </div>
      <BarreProgression
        ratio={progress.ratio}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-valuenow={Math.round(progress.current * 10) / 10}
        aria-label="Progression de l'objectif"
      />
    </div>
  );
}

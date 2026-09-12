import type { TimeOfDayBucket } from '../lib/retrospective';

interface MeilleureHeureProductiviteProps {
  buckets: TimeOfDayBucket[];
}

// Hauteur de barre calculée en pixels plutôt qu'en pourcentage : une
// hauteur en % dépendrait de la hauteur résolue du parent flex, fragile
// ici puisque chaque colonne contient aussi son compteur.
const BAR_MAX_PX = 96;

export default function MeilleureHeureProductivite({ buckets }: MeilleureHeureProductiviteProps) {
  const max = Math.max(...buckets.map((bucket) => bucket.sessions), 0);
  const total = buckets.reduce((sum, bucket) => sum + bucket.sessions, 0);
  if (total === 0) {
    return <p className="text-[13px] text-muted">Pas encore de séance enregistrée.</p>;
  }
  const bestKey = buckets.reduce((best, bucket) => (bucket.sessions > best.sessions ? bucket : best)).key;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        {buckets.map((bucket) => {
          const isBest = bucket.key === bestKey;
          const height = max === 0 ? 0 : Math.round((bucket.sessions / max) * BAR_MAX_PX);
          return (
            <div key={bucket.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-data text-[11px] tabular-nums text-muted">{bucket.sessions}</span>
              <div
                className={`w-full ${isBest ? 'bg-accent-bright' : 'bg-ink-700'}`}
                style={{ height: Math.max(height, bucket.sessions > 0 ? 3 : 1) }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[12px] text-champagne">{bucket.label}</span>
            <span className="font-data text-[10px] text-muted">
              {bucket.sessions === 0 ? '—' : `${bucket.averageMinutes} min moy.`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

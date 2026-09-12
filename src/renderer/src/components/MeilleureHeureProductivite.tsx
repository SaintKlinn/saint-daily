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
  // Toutes les périodes à égalité du maximum sont "meilleures" — un
  // `reduce` avec `>` ne garderait que la première rencontrée (toujours
  // "Nuit", en tête de liste) et ferait croire à un gagnant qui n'existe
  // pas. `isBest` ci-dessous suit la même règle : `sessions === max`.
  const bestBuckets = buckets.filter((bucket) => bucket.sessions === max);
  const isTie = bestBuckets.length > 1;
  // La couleur seule ne doit pas porter l'info du gagnant : une phrase
  // l'énonce, formulée au neutre en cas d'égalité plutôt que de trancher
  // arbitrairement.
  const summary = isTie
    ? `Aucune période ne se détache : ${bestBuckets.map((bucket) => bucket.label).join(', ')} sont à égalité.`
    : `${bestBuckets[0].label} est ta période la plus active.`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        {buckets.map((bucket) => {
          const isBest = bucket.sessions === max && bucket.sessions > 0;
          const height = max === 0 ? 0 : Math.round((bucket.sessions / max) * BAR_MAX_PX);
          return (
            <div key={bucket.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-data text-[11px] tabular-nums text-muted">{bucket.sessions}</span>
              <div
                className={`w-full ${isBest ? 'bg-accent-bright' : 'bg-muted'}`}
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
      <p className="text-[13px] text-muted">{summary}</p>
    </div>
  );
}

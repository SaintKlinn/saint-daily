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
      {/* Toutes les barres sont `accent-bright` : la donnée est la donnée.
          L'ancien `bg-muted` pour les non-gagnantes ne se distinguait de
          l'or qu'à 1.10:1 — un signal illisible, et de toute façon
          redondant, puisque la barre la plus haute EST le maximum. La
          période gagnante est désignée par sa pastille de libellé (bordure
          + texte accent, l'idiome des badges de DetailSkill), qui ne
          repose ni sur la couleur seule ni sur une comparaison de teintes
          quasi identiques. */}
      <div className="flex items-end gap-3">
        {buckets.map((bucket) => {
          const height = max === 0 ? 0 : Math.round((bucket.sessions / max) * BAR_MAX_PX);
          return (
            <div key={bucket.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-data text-[11px] tabular-nums text-muted">{bucket.sessions}</span>
              {/* Rien du tout à zéro séance, plutôt qu'un filet de 1 px :
                  maintenant que les barres sont toutes de la couleur des
                  données, un trait d'or sous un « 0 » se lirait comme une
                  activité minuscule au lieu d'une absence. Le compteur
                  au-dessus et le « — » en dessous le disent déjà. Les
                  périodes non vides gardent leur minimum de 3 px, sans
                  quoi une séance isolée face à un maximum élevé
                  n'afficherait aucune barre. */}
              {bucket.sessions > 0 && (
                <div className="w-full bg-accent-bright" style={{ height: Math.max(height, 3) }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        {buckets.map((bucket) => {
          const isBest = bucket.sessions === max && bucket.sessions > 0;
          return (
            <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={`max-w-full truncate border px-2 py-0.5 font-data text-[10px] uppercase tracking-[0.08em] ${
                  isBest ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted'
                }`}
              >
                {bucket.label}
              </span>
              <span className="font-data text-[10px] text-muted">
                {bucket.sessions === 0 ? '—' : `${bucket.averageMinutes} min moy.`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-muted">{summary}</p>
    </div>
  );
}

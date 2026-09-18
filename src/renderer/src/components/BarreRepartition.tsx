import { formatMinutes, type BreakdownRow } from '../lib/retrospective';
import BarreProgression from './BarreProgression';

interface BarreRepartitionProps {
  rows: BreakdownRow[];
  emptyLabel: string;
}

export default function BarreRepartition({ rows, emptyLabel }: BarreRepartitionProps) {
  if (rows.length === 0) {
    return <p className="text-secondaire text-muted">{emptyLabel}</p>;
  }
  // Le max sert d'échelle relative ; jamais 0 pour ne pas diviser par zéro
  // quand toutes les lignes sont à 0 minute (que des tâches cochées).
  const max = Math.max(...rows.map((row) => row.minutes), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-secondaire text-champagne">{row.label}</span>
            <span className="shrink-0 font-data text-libelle tabular-nums text-muted">
              {formatMinutes(row.minutes)} · {row.sessions} séance{row.sessions > 1 ? 's' : ''}
            </span>
          </div>
          {/* Le rail passe par BarreProgression : la piste `bg-muted`
              qu'il y avait ici rendait bien l'étendue visible, mais
              laissait le remplissage or à 1.10:1 sur elle — la barre qui
              porte la donnée était indistinguable de sa piste. */}
          <BarreProgression ratio={row.minutes / max} />
        </li>
      ))}
    </ul>
  );
}

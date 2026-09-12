import { formatMinutes, type BreakdownRow } from '../lib/retrospective';

interface BarreRepartitionProps {
  rows: BreakdownRow[];
  emptyLabel: string;
}

export default function BarreRepartition({ rows, emptyLabel }: BarreRepartitionProps) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted">{emptyLabel}</p>;
  }
  // Le max sert d'échelle relative ; jamais 0 pour ne pas diviser par zéro
  // quand toutes les lignes sont à 0 minute (que des tâches cochées).
  const max = Math.max(...rows.map((row) => row.minutes), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-champagne">{row.label}</span>
            <span className="shrink-0 font-data text-[11px] tabular-nums text-muted">
              {formatMinutes(row.minutes)} · {row.sessions} séance{row.sessions > 1 ? 's' : ''}
            </span>
          </div>
          {/* `bg-ink-700` (1.14:1 sur la carte ink-800) rendait le rail
              invisible ; `bg-muted` est déjà vérifié à 4.57:1 sur ink-800
              (theme/colors.ts) et sert déjà de couleur secondaire lisible
              ailleurs dans l'app. */}
          <div className="h-1.5 w-full bg-muted">
            <div className="h-full bg-accent-bright" style={{ width: `${(row.minutes / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

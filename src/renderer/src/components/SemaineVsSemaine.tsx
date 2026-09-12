import { formatMinutes, type WeekComparison } from '../lib/retrospective';

interface SemaineVsSemaineProps {
  comparison: WeekComparison;
}

function Bloc({ titre, minutes, sessions, accent }: { titre: string; minutes: number; sessions: number; accent: boolean }) {
  // `bg-ink-800` ici, dans une `Section` déjà `bg-ink-800`/`border-ink-700`,
  // se fondait totalement dans son parent — aucun conteneur perceptible.
  // `bg-ink-950` (plus sombre que la section) donne un puits visiblement
  // en retrait, avec `border-ink-700` (plus clair que ce fond-là) pour le
  // délimiter — même logique que le "puits" du niveau 0 de la heatmap.
  return (
    <div className="flex flex-1 flex-col gap-1 border border-ink-700 bg-ink-950 px-5 py-4">
      <p className="font-data text-[10px] uppercase tracking-[0.1em] text-muted">{titre}</p>
      <p className={`font-serif text-[26px] tabular-nums ${accent ? 'text-accent-bright' : 'text-champagne'}`}>
        {formatMinutes(minutes)}
      </p>
      <p className="text-[12px] text-muted">
        {sessions} séance{sessions > 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default function SemaineVsSemaine({ comparison }: SemaineVsSemaineProps) {
  const { thisWeek, lastWeek } = comparison;
  const delta = thisWeek.minutes - lastWeek.minutes;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <Bloc titre="Cette semaine" minutes={thisWeek.minutes} sessions={thisWeek.sessions} accent />
        <Bloc titre="Semaine dernière" minutes={lastWeek.minutes} sessions={lastWeek.sessions} accent={false} />
      </div>
      {/* Le signe est écrit en toutes lettres plutôt que rendu par une
          flèche colorée seule : l'information ne doit pas reposer sur la
          couleur ou sur un glyphe non lu par un lecteur d'écran. */}
      <p className="text-[13px] text-muted">
        {delta === 0
          ? 'Autant que la semaine dernière.'
          : delta > 0
            ? `${formatMinutes(delta)} de plus que la semaine dernière.`
            : `${formatMinutes(-delta)} de moins que la semaine dernière.`}
      </p>
    </div>
  );
}

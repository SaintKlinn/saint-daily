import { useMemo } from 'react';
import { buildHeatmapGrid, countEntriesByDay, type HeatmapCell, type HeatmapLevel, type PracticeEntryLike } from '../lib/retrospective';

interface SelectableEngagement {
  id: string;
  name: string;
}

interface HeatmapCalendrierProps {
  entries: PracticeEntryLike[];
  engagements: SelectableEngagement[];
  selectedEngagementId: string;
  onSelectEngagement: (id: string) => void;
}

// Rampe d'intensité : ink-700 pour "case vide mais existante" (visible sur
// le fond ink-800 de la carte, contrairement à ink-800 qui s'y fondrait),
// puis les trois nuances d'or de la palette.
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: 'bg-ink-700',
  1: 'bg-accent-deep',
  2: 'bg-accent-mid',
  3: 'bg-accent-bright',
};

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function cellTitle(cell: HeatmapCell): string {
  const date = cell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (cell.count === 0) return `${date} — aucune entrée`;
  return `${date} — ${cell.count} entrée${cell.count > 1 ? 's' : ''}`;
}

export default function HeatmapCalendrier({
  entries,
  engagements,
  selectedEngagementId,
  onSelectEngagement,
}: HeatmapCalendrierProps) {
  const grid = useMemo(() => buildHeatmapGrid(countEntriesByDay(entries)), [entries]);

  return (
    <div className="flex flex-col gap-4">
      <select
        aria-label="Engagement affiché dans la heatmap"
        value={selectedEngagementId}
        onChange={(event) => onSelectEngagement(event.target.value)}
        className="w-fit border border-ink-700 bg-ink-800 px-3 py-1.5 text-[13px] text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
      >
        <option value="tous">Tous les engagements</option>
        {engagements.map((engagement) => (
          <option key={engagement.id} value={engagement.id}>
            {engagement.name}
          </option>
        ))}
      </select>

      {/* La grille dépasse la largeur disponible : elle défile dans son
          propre conteneur, jamais la page entière. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5">
          <div className="flex shrink-0 flex-col gap-[3px] pr-1">
            {DAY_LABELS.map((label, index) => (
              // Un jour sur deux seulement : sept libellés sur 11px de
              // haut chacun seraient illisibles.
              <span key={label} className="h-[11px] font-data text-[9px] leading-[11px] text-muted">
                {index % 2 === 1 ? label : ''}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {grid.map((column) => (
              <div key={column[0].dayKey} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <div
                    key={cell.dayKey}
                    title={cell.isFuture ? undefined : cellTitle(cell)}
                    className={`h-[11px] w-[11px] ${cell.isFuture ? 'bg-ink-800' : LEVEL_CLASS[cell.level]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-data text-[10px] text-muted">Moins</span>
        {([0, 1, 2, 3] as HeatmapLevel[]).map((level) => (
          <div key={level} className={`h-[11px] w-[11px] ${LEVEL_CLASS[level]}`} />
        ))}
        <span className="font-data text-[10px] text-muted">Plus</span>
      </div>
    </div>
  );
}

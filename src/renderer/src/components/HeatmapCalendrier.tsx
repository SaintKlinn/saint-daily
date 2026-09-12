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

// Rampe dédiée (theme/colors.ts `heatmap`) : le niveau 0 est un puits
// visiblement plus sombre que la carte ink-800 mais ne porte aucune
// donnée, donc pas soumis au seuil 3:1 ; les niveaux 1 à 3 reprennent les
// nuances d'or de l'app et atteignent chacun au moins 3:1 sur le niveau 0
// (voir le commentaire de `colors.heatmap` pour le détail des contrastes).
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: 'bg-heatmap-0',
  1: 'bg-heatmap-1',
  2: 'bg-heatmap-2',
  3: 'bg-heatmap-3',
};

// Ce que chaque niveau représente en nombre de séances — sert à la fois de
// texte visible (légende) et de secours pour qui ne perçoit pas la couleur.
const LEVEL_RANGE_LABEL: Record<HeatmapLevel, string> = {
  0: '0 séance',
  1: '1 séance',
  2: '2 à 3 séances',
  3: '4 séances ou plus',
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

  // Résumé unique pour les lecteurs d'écran : `role="img"` traite toute la
  // grille comme une seule image décrite par cet `aria-label`, plutôt que
  // de laisser un lecteur d'écran parcourir 371 `title` individuels. Le
  // `title` par case reste pour la souris (survol).
  const totalSessions = useMemo(
    () => grid.reduce((sum, column) => sum + column.reduce((s, cell) => s + (cell.isFuture ? 0 : cell.count), 0), 0),
    [grid]
  );
  const gridLabel = `Calendrier d'activité sur les douze derniers mois : ${totalSessions} séance${totalSessions > 1 ? 's' : ''} enregistrée${totalSessions > 1 ? 's' : ''}.`;

  return (
    <div className="flex flex-col gap-4">
      <select
        aria-label="Engagement affiché dans la heatmap"
        value={selectedEngagementId}
        onChange={(event) => onSelectEngagement(event.target.value)}
        className="w-full max-w-[240px] truncate border border-ink-700 bg-ink-800 px-3 py-1.5 text-[13px] text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
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
        <div className="flex gap-1.5" role="img" aria-label={gridLabel}>
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
          <div
            key={level}
            role="img"
            aria-label={LEVEL_RANGE_LABEL[level]}
            title={LEVEL_RANGE_LABEL[level]}
            className={`h-[11px] w-[11px] ${LEVEL_CLASS[level]}`}
          />
        ))}
        <span className="font-data text-[10px] text-muted">Plus</span>
      </div>
    </div>
  );
}

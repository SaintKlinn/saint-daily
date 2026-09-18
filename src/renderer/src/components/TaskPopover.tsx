import { Link } from 'react-router-dom';
import RayCorner from './RayCorner';
import Button, { buttonClassName } from './Button';
import BoutonSuppression from './BoutonSuppression';
import RecurrenceEditor from './RecurrenceEditor';
import MilestoneChecklist from './MilestoneChecklist';
import { useMilestones } from '../hooks/useMilestones';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import type { RecurrenceRule } from '../lib/recurrence';
import type { Engagement, Priority } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${day} · ${time(start)} – ${time(end)}`;
}

export default function TaskPopover({
  task,
  onClose,
  onComplete,
  completing,
  onPriorityChange,
  onSnooze,
  canEditRecurrence,
  onRecurrenceChange,
  recurrenceBusy,
  projects,
  onProjectChange,
  onToggleSkip,
  skipping,
  onDelete,
  deleting,
  error,
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
  onPriorityChange: (priority: Priority) => void;
  onSnooze: (mode: 'aujourdhui' | 'demain') => void;
  canEditRecurrence: boolean;
  onRecurrenceChange: (rule: RecurrenceRule) => void;
  recurrenceBusy: boolean;
  projects: Engagement[];
  onProjectChange: (projectId: string | null) => void;
  onToggleSkip: () => void;
  skipping?: boolean;
  onDelete: () => void;
  deleting: boolean;
  error: string | null;
}) {
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60" onClick={onClose}>
      <div
        className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <RayCorner variant={1} />
        <div className="relative">
          <p className="font-serif text-titre text-champagne">{task.name}</p>
          {task.tags.length > 0 && (
            <p className="mt-1 text-secondaire text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <p className="relative font-data text-secondaire text-muted">
          {formatSlot(task.scheduledAt as string, task.scheduledEndsAt as string)}
        </p>
        <div className="relative flex flex-col gap-2">
          <p className="text-libelle font-semibold uppercase tracking-[0.04em] text-muted">Priorité</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRIORITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onPriorityChange(level)}
                aria-pressed={task.priority === level}
                className={`font-data text-secondaire px-3 py-2 transition-colors duration-150 ${FOCUS_RING} ${task.priority === level ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {PRIORITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
        <div className="relative flex flex-col gap-2">
          <p className="text-libelle font-semibold uppercase tracking-[0.04em] text-muted">Reporter</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSnooze('aujourdhui')}
              className={`font-data text-secondaire px-3 py-2 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Plus tard aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => onSnooze('demain')}
              className={`font-data text-secondaire px-3 py-2 border border-ink-700 text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
            >
              Demain
            </button>
          </div>
        </div>
        <MilestoneChecklist
          milestones={milestones}
          onToggle={toggleMilestone}
          onAdd={addMilestone}
          error={milestonesError}
        />
        <div className="relative flex flex-col gap-2">
          <p className="text-libelle font-semibold uppercase tracking-[0.04em] text-muted">Projet</p>
          <select
            value={task.projectId ?? ''}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className={`border border-ink-700 bg-ink-800 px-3 py-2 text-corps text-champagne ${FOCUS_RING}`}
          >
            <option value="">Aucun</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {canEditRecurrence && (
          <RecurrenceEditor
            type={task.recurrenceType}
            interval={task.recurrenceInterval}
            weekdays={task.recurrenceWeekdays}
            onChange={onRecurrenceChange}
            disabled={recurrenceBusy}
          />
        )}
        {error && (
          <p role="alert" className="relative text-corps text-danger">
            {error}
          </p>
        )}
        <div className="relative mt-2 flex flex-wrap justify-end gap-3">
          <BoutonSuppression onConfirm={onDelete} busy={deleting} />
          {task.recurrenceSeriesId && (
            <Button variant="secondary" size="sm" onClick={onToggleSkip} disabled={skipping}>
              {task.skippedAt ? 'Ne plus passer' : 'Passer cette occurrence'}
            </Button>
          )}
          <Link to={`/pomodoro?skillId=${task.id}`} className={buttonClassName('secondary', 'sm')}>
            Démarrer un pomodoro
          </Link>
          <Link to={`/focus/${task.id}`} className={buttonClassName('secondary', 'sm')}>
            Focus
          </Link>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" variant="primary" onClick={onComplete} disabled={completing}>
            {completing ? 'Marquage…' : 'Marquer comme faite'}
          </Button>
        </div>
      </div>
    </div>
  );
}

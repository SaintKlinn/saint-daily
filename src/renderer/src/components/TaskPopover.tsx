import RayCorner from './RayCorner';
import Button from './Button';
import type { Engagement } from '../lib/types';

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
}: {
  task: Engagement;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60" onClick={onClose}>
      <div
        className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <RayCorner variant={1} />
        <div className="relative">
          <p className="font-serif text-xl text-champagne">{task.name}</p>
          {task.tags.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <p className="relative font-data text-[13px] text-muted">
          {formatSlot(task.scheduledAt as string, task.scheduledEndsAt as string)}
        </p>
        <div className="relative mt-2 flex justify-end gap-3">
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

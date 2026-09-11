import { useState } from 'react';
import type { EngagementMilestone } from '../lib/types';
import { CheckIcon } from './icons';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function MilestoneChecklist({
  milestones,
  onToggle,
  onAdd,
  error,
}: {
  milestones: EngagementMilestone[];
  onToggle: (id: string, completed: boolean) => void;
  onAdd: (label: string) => Promise<{ error: string | null }>;
  error: string | null;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Sous-tâches</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-0 border-l border-ink-700 pl-[14px]">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center py-1.5">
              <label className="flex cursor-pointer items-center gap-2">
                <span className="relative -ml-[21px] flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={!!m.completedAt}
                    onChange={(e) => onToggle(m.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                  >
                    {m.completedAt && <CheckIcon size={10} />}
                  </span>
                </span>
                <span className={`text-sm ${m.completedAt ? 'text-muted line-through' : 'text-champagne'}`}>
                  {m.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <NewMilestoneForm onAdd={onAdd} />
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        setSubmitting(true);
        setError(null);
        const { error: addError } = await onAdd(label);
        setSubmitting(false);
        if (addError) {
          setError(addError);
          return;
        }
        input.value = '';
      }}
      className="mt-1 flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input
          name="label"
          aria-label="Nouvelle sous-tâche"
          placeholder="Nouvelle sous-tâche"
          disabled={submitting}
          className={`flex-1 border border-ink-700 bg-ink-900 px-2.5 py-1 text-xs text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

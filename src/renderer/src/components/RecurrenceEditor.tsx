import type { RecurrenceRule } from '../lib/recurrence';
import type { RecurrenceType } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'tous_les_n_jours', label: 'Tous les N jours' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
];

export default function RecurrenceEditor({
  type,
  interval,
  weekdays,
  onChange,
  disabled,
}: {
  type: RecurrenceType;
  interval: number | null;
  weekdays: number[] | null;
  onChange: (rule: RecurrenceRule) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Récurrence</p>
      <div className="flex flex-wrap items-center gap-2">
        {RECURRENCE_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                type: option.value,
                interval: option.value === 'tous_les_n_jours' ? interval ?? 2 : null,
                weekdays: option.value === 'hebdomadaire' ? weekdays ?? [] : null,
              })
            }
            aria-pressed={type === option.value}
            className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${type === option.value ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {type === 'hebdomadaire' && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {WEEKDAY_OPTIONS.map((day) => {
            const selected = (weekdays ?? []).includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    type,
                    interval,
                    weekdays: selected ? (weekdays ?? []).filter((d) => d !== day.value) : [...(weekdays ?? []), day.value],
                  })
                }
                aria-pressed={selected}
                className={`font-data text-xs px-2.5 py-1 transition-colors duration-150 ${FOCUS_RING} ${selected ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      )}
      {type === 'tous_les_n_jours' && (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={2}
            value={interval ?? 2}
            disabled={disabled}
            onChange={(e) => onChange({ type, interval: Math.max(2, Number(e.target.value) || 2), weekdays })}
            className={`w-16 border border-ink-700 bg-ink-800 px-2 py-1 font-data text-xs text-champagne ${FOCUS_RING}`}
          />
          <span className="text-xs text-muted">jours</span>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { PRIORITY_LEVELS, PRIORITY_LABELS } from '../lib/priority';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, detectConflicts, generateOccurrences, nextAnchorDate, type RecurrenceRule } from '../lib/recurrence';
import type { Priority, RecurrenceType } from '../lib/types';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField, SelectField } from '../components/FormField';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const DURATION_PRESETS = [15, 30, 45, 60, 90];
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

// datetime-local exige "YYYY-MM-DDTHH:mm" en heure locale, sans le "Z" ni le
// décalage qu'a un ISO string — cette conversion n'est nécessaire que quand
// on arrive ici via un clic sur un créneau du calendrier (Task 4).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NouvelleTache() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { engagements, createEngagement, createEngagements } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const preselectedScheduledAt = searchParams.get('scheduledAt');
  const [scheduledAt, setScheduledAt] = useState(
    preselectedScheduledAt ? toDatetimeLocalValue(preselectedScheduledAt) : ''
  );
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('aucune');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('aucune');
  const [recurrenceInterval, setRecurrenceInterval] = useState(2);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const [projectId, setProjectId] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (created) return;
    if (!name.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    if (!scheduledAt) {
      setError('La planification est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setConflictMessage(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const startDate = new Date(scheduledAt);
    const durationMs = durationMinutes * 60_000;
    const scheduledEndsAt = new Date(startDate.getTime() + durationMs).toISOString();
    const recurrenceSeriesId = recurrenceType !== 'aucune' ? crypto.randomUUID() : null;
    const rule: RecurrenceRule = {
      type: recurrenceType,
      interval: recurrenceType === 'tous_les_n_jours' ? recurrenceInterval : null,
      weekdays: recurrenceType === 'hebdomadaire' ? recurrenceWeekdays : null,
    };
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: startDate.toISOString(),
      scheduledEndsAt,
      priority,
      recurrenceSeriesId,
      recurrenceType,
      recurrenceInterval: rule.interval,
      recurrenceWeekdays: rule.weekdays,
      projectId: projectId || null,
    });
    if (createError) {
      setSubmitting(false);
      setError(createError);
      return;
    }
    setCreated(true);

    if (recurrenceType !== 'aucune' && recurrenceSeriesId) {
      const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
      const anchor = nextAnchorDate(rule, startDate);
      const dates = generateOccurrences(rule, anchor, windowEnd);
      const occurrenceSlots = dates.map((date) => ({
        seriesId: recurrenceSeriesId,
        scheduledAt: date.toISOString(),
        scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
      }));
      const conflicts = detectConflicts(occurrenceSlots, engagements.filter((e) => !e.archivedAt));
      if (occurrenceSlots.length > 0) {
        await createEngagements(
          occurrenceSlots.map((slot) => ({
            name: name.trim(),
            tags,
            scheduledAt: slot.scheduledAt,
            scheduledEndsAt: slot.scheduledEndsAt,
            priority,
            recurrenceSeriesId,
            recurrenceType,
            recurrenceInterval: rule.interval,
            recurrenceWeekdays: rule.weekdays,
            projectId: projectId || null,
          }))
        );
      }
      if (conflicts.length > 0) {
        setSubmitting(false);
        setConflictMessage(
          `${conflicts.length} occurrence${conflicts.length > 1 ? 's' : ''} en conflit avec une autre tâche déjà planifiée.`
        );
        return;
      }
    }

    setSubmitting(false);
    navigate('/');
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={2} />
      <div className="relative">
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouvelle tâche</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Ajouter une tâche</h1>
      </div>
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        <FormField label="Titre" required value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Tags (optionnels, séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Perso, Urgent"
        />
        <FormField
          label="Planification"
          required
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Durée</p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDurationMinutes(preset)}
                aria-pressed={durationMinutes === preset}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${durationMinutes === preset ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Priorité</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRIORITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(level)}
                aria-pressed={priority === level}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${priority === level ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {PRIORITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Récurrence</p>
          <div className="flex flex-wrap items-center gap-2">
            {RECURRENCE_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRecurrenceType(option.value)}
                aria-pressed={recurrenceType === option.value}
                className={`font-data text-xs px-3 py-1.5 transition-colors duration-150 ${FOCUS_RING} ${recurrenceType === option.value ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {recurrenceType === 'hebdomadaire' && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = recurrenceWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() =>
                      setRecurrenceWeekdays((current) =>
                        selected ? current.filter((d) => d !== day.value) : [...current, day.value]
                      )
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
          {recurrenceType === 'tous_les_n_jours' && (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={2}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Math.max(2, Number(e.target.value) || 2))}
                className={`w-16 border border-ink-700 bg-ink-800 px-2 py-1 font-data text-xs text-champagne ${FOCUS_RING}`}
              />
              <span className="text-xs text-muted">jours</span>
            </div>
          )}
        </div>
        <SelectField label="Projet (optionnel)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Aucun</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {conflictMessage && (
          <p role="alert" className="text-sm text-danger">
            {conflictMessage}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || created}>
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </form>
    </div>
  );
}

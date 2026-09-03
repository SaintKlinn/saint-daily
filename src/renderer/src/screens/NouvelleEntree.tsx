import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { SelectField, TextAreaField } from '../components/FormField';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function NouvelleEntree() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');

  const { skills } = useSkills();
  const { logEntry } = usePracticeEntries(null);

  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  const [duration, setDuration] = useState('30');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const durationMinutes = Number(duration);
    if (!skillId) {
      setError('Choisis un skill.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('La durée doit être un nombre de minutes positif.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: logError } = await logEntry({ skillId, durationMinutes, note: note || null });
    setSubmitting(false);
    if (logError) {
      // La saisie reste dans le formulaire — pas de perte, retry manuel.
      setError(logError);
      return;
    }
    navigate(`/skills/${skillId}`);
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={0} />
      <div className="relative">
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouvelle entrée</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Journal de pratique</h1>
      </div>
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        <SelectField label="Skill" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Choisir…</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Durée
          <div className="flex items-baseline gap-2.5 border border-ink-700 bg-ink-800 px-3.5 py-3">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-label="Durée en minutes"
              className={`w-16 bg-transparent font-data text-xl normal-case tracking-normal text-champagne ${FOCUS_RING}`}
            />
            <span className="font-sans text-[13px] normal-case tracking-normal text-muted">minutes</span>
          </div>
        </label>
        <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  );
}

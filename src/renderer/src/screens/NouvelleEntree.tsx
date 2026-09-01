import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { usePracticeEntries } from '../hooks/usePracticeEntries';

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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-serif text-2xl text-champagne">Nouvelle entrée</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Skill
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          >
            <option value="">Choisir…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Durée (minutes)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 font-data text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}

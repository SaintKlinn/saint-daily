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
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 border border-ink-700 bg-ink-900 p-9">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouvelle entrée</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Journal de pratique</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Skill
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne"
          >
            <option value="">Choisir…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Durée
          <div className="flex items-baseline gap-2.5 border border-ink-700 bg-ink-800 px-3.5 py-3">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-16 bg-transparent font-data text-xl normal-case tracking-normal text-champagne focus:outline-none"
            />
            <span className="font-sans text-[13px] normal-case tracking-normal text-muted">minutes</span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-champagne placeholder:text-muted focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="border border-ink-700 px-5 py-2.5 font-sans text-sm font-semibold text-muted hover:text-champagne"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent-bright px-5 py-2.5 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

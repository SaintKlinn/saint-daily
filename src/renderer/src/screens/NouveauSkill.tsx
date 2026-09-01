import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import type { GenericLevel } from '../lib/types';

export default function NouveauSkill() {
  const navigate = useNavigate();
  const { createSkill } = useSkills();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [genericLevel, setGenericLevel] = useState<GenericLevel>('debutant');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const { error: createError } = await createSkill({ name: name.trim(), tags, genericLevel, notes: notes || null });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/skills');
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 border border-ink-700 bg-ink-900 p-9">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouveau skill</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Commencer à suivre</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Nom
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Tags (séparés par des virgules)
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Musique, Créatif"
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne placeholder:text-muted focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Niveau de départ
          <select
            value={genericLevel}
            onChange={(e) => setGenericLevel(e.target.value as GenericLevel)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne"
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
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
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

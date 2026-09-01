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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-serif text-2xl text-champagne">Nouveau skill</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Nom
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tags (séparés par des virgules)
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Musique, Créatif"
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Niveau de départ
          <select
            value={genericLevel}
            onChange={(e) => setGenericLevel(e.target.value as GenericLevel)}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Création…' : 'Créer'}
        </button>
      </form>
    </div>
  );
}

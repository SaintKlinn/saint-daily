import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import type { GenericLevel } from '../lib/types';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField, SelectField, TextAreaField } from '../components/FormField';

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
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 overflow-hidden border border-ink-700 bg-ink-900 p-9">
      <RayCorner variant={2} />
      <div className="relative">
        <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Nouveau skill</p>
        <h1 className="mt-1.5 font-serif text-2xl text-champagne">Commencer à suivre</h1>
      </div>
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        <FormField label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Tags (séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Musique, Créatif"
        />
        <SelectField label="Niveau de départ" value={genericLevel} onChange={(e) => setGenericLevel(e.target.value as GenericLevel)}>
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
          <option value="expert">Expert</option>
        </SelectField>
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
            {submitting ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </form>
    </div>
  );
}

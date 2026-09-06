import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField } from '../components/FormField';

export default function NouvelleTache() {
  const navigate = useNavigate();
  const { createEngagement } = useEngagements();
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const { error: createError } = await createEngagement({
      name: name.trim(),
      tags,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
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
        <FormField label="Titre" value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Tags (séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Perso, Urgent"
        />
        <FormField
          label="Planification (optionnelle)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
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

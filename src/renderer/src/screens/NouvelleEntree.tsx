import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { useNoteTemplates } from '../hooks/useNoteTemplates';
import RayCorner from '../components/RayCorner';
import Button from '../components/Button';
import { FormField, SelectField, TextAreaField } from '../components/FormField';
import type { Mood } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function NouvelleEntree() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');

  const { engagements } = useEngagements();
  const skills = engagements.filter((e) => !e.scheduledAt && !e.isProject);
  const { logEntry } = usePracticeEntries(null);
  // L'erreur du hook n'est délibérément pas affichée ici : elle signifie
  // « pas de modèles disponibles », ce que l'absence de chips dit déjà, et
  // un message d'erreur en travers du formulaire central pour une
  // commodité absente serait disproportionné.
  const { templates } = useNoteTemplates();

  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  const [duration, setDuration] = useState('30');
  const [mood, setMood] = useState<Mood | ''>('');
  const [tagsInput, setTagsInput] = useState('');
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
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const { error: logError } = await logEntry({
      engagementId: skillId,
      durationMinutes,
      note: note || null,
      mood: mood || null,
      tags,
    });
    setSubmitting(false);
    if (logError) {
      // La saisie reste dans le formulaire — pas de perte, retry manuel.
      setError(logError);
      return;
    }
    navigate(`/skills/${skillId}`);
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-8">
      <RayCorner variant={0} />
      <div className="relative">
        <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Nouvelle entrée</p>
        <h1 className="mt-2 font-serif text-titre-ecran text-champagne">Journal de pratique</h1>
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
        <label className="flex flex-col gap-2 text-libelle font-semibold uppercase tracking-[0.04em] text-muted">
          Durée
          <div className="flex items-baseline gap-3 border border-ink-700 bg-ink-800 px-4 py-3">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-label="Durée en minutes"
              className={`w-16 bg-transparent font-data text-titre normal-case tracking-normal text-champagne ${FOCUS_RING}`}
            />
            <span className="font-sans text-secondaire normal-case tracking-normal text-muted">minutes</span>
          </div>
        </label>
        <SelectField label="Humeur (optionnelle)" value={mood} onChange={(e) => setMood(e.target.value as Mood | '')}>
          <option value="">Non précisée</option>
          <option value="difficile">Difficile</option>
          <option value="moyen">Moyen</option>
          <option value="correct">Correct</option>
          <option value="bien">Bien</option>
          <option value="excellent">Excellent</option>
        </SelectField>
        <FormField
          label="Tags de la séance (optionnels, séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="technique, difficile"
        />
        {templates.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-libelle font-semibold uppercase tracking-[0.04em] text-muted">Modèles de note</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setNote(template.text)}
                  title={template.text}
                  className={`max-w-[220px] truncate border border-ink-700 px-3 py-2 text-left text-secondaire text-muted transition-colors hover:text-champagne ${FOCUS_RING}`}
                >
                  {template.text}
                </button>
              ))}
            </div>
          </div>
        )}
        <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        {error && (
          <p role="alert" className="text-corps text-danger">
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

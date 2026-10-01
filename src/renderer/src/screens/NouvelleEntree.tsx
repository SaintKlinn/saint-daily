import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { useNoteTemplates } from '../hooks/useNoteTemplates';
import { analyserTags } from '../lib/tags';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { FormField, SelectField, TextAreaField } from '../components/FormField';
import { ChoixDuree, ChoixHumeur, ChoixQuand } from '../components/ChampsSeance';
import { depuisChampDateHeure, erreurSaisieSeance, versChampDateHeure } from '../lib/seances';
import type { Mood } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function NouvelleEntree() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId');

  const { engagements, loading: engagementsLoading } = useEngagements();
  const skills = engagements.filter((e) => !e.scheduledAt && !e.isProject);
  // Une séance peut aussi porter sur le projet lui-même (session de
  // chantier) : son temps compte alors dans le total du projet.
  const projets = engagements.filter((e) => e.isProject && !e.archivedAt);
  const { logEntry } = usePracticeEntries(null);
  // L'erreur du hook n'est délibérément pas affichée ici : elle signifie
  // « pas de modèles disponibles », ce que l'absence de chips dit déjà, et
  // un message d'erreur en travers du formulaire central pour une
  // commodité absente serait disproportionné.
  const { templates } = useNoteTemplates();

  const [skillId, setSkillId] = useState(preselectedSkillId ?? '');
  const [duration, setDuration] = useState('30');
  // Vide = maintenant ; sinon une valeur `datetime-local` (voir ChoixQuand).
  const [quand, setQuand] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [tagsInput, setTagsInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const durationMinutes = Number(duration);
    if (!skillId) {
      setError(projets.length > 0 ? 'Choisis un skill ou un projet.' : 'Choisis un skill.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('La durée doit être un nombre de minutes positif.');
      return;
    }
    // Mêmes règles que l'éditeur de séance : pas plus de 24 h, pas dans le
    // futur.
    const dateHeure = quand || versChampDateHeure(new Date().toISOString());
    const invalide = erreurSaisieSeance({ duree: duration, dateHeure });
    if (invalide) {
      setError(invalide);
      return;
    }
    setSubmitting(true);
    setError(null);
    const tags = analyserTags(tagsInput);
    const { error: logError } = await logEntry({
      engagementId: skillId,
      durationMinutes,
      practicedAt: quand ? (depuisChampDateHeure(quand) as string) : undefined,
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
    // Une séance de chantier porte sur un projet : la fiche d'un skill le
    // filtrerait et dirait « Introuvable — supprimé définitivement », alors
    // que la séance vient d'être enregistrée.
    navigate(projets.some((p) => p.id === skillId) ? `/projets/${skillId}` : `/skills/${skillId}`);
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 overflow-hidden border border-ink-700 bg-ink-900 p-8">
      <RayCorner variant={0} />
      <div className="relative">
        <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Nouvelle entrée</p>
        <h1 className="mt-2 font-serif text-titre-ecran text-champagne">Journal de pratique</h1>
      </div>
      {/* Sans aucun skill, le menu « Choisir… » était vide : on ne pouvait ni
          remplir ni comprendre le formulaire. */}
      {!engagementsLoading && skills.length === 0 ? (
        <EmptyState titre="Aucun skill pour l'instant" action={{ libelle: 'Créer un skill', vers: '/skills/nouveau' }}>
          Une séance s'enregistre sur un skill. Crée celui que tu veux pratiquer, puis reviens ici.
        </EmptyState>
      ) : (
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-6">
        <SelectField
          label={projets.length > 0 ? 'Skill ou projet' : 'Skill'}
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
        >
          <option value="">Choisir…</option>
          {projets.length > 0 ? (
            <>
              <optgroup label="Skills">
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Projets">
                {projets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </SelectField>
        <ChoixQuand valeur={quand} onChange={setQuand} />
        <ChoixDuree valeur={duration} onChange={setDuration} />
        <ChoixHumeur valeur={mood} onChange={setMood} />
        <FormField
          label="Tags de la séance (optionnels, séparés par des virgules)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="ex. technique, difficile"
        />
        {templates.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-libelle uppercase tracking-[0.04em] text-muted">Modèles de note</p>
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
      )}
    </div>
  );
}

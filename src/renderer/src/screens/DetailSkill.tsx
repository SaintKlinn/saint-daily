import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useMilestones } from '../hooks/useMilestones';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import type { GenericLevel } from '../lib/types';
import Introuvable from './Introuvable';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export default function DetailSkill() {
  const { id } = useParams<{ id: string }>();
  const { skills, loading, error: skillsError, updateSkill, setArchived } = useSkills();
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const { entries, error: entriesError } = usePracticeEntries(id ?? null);

  const skill = skills.find((s) => s.id === id);

  // Archiver, changer le niveau, cocher un jalon écrivaient en silence :
  // un échec réseau ne se voyait qu'en revenant à l'état précédent au
  // prochain refresh, sans un mot d'explication (audit ui-ux-pro-max).
  const [actionError, setActionError] = useState<string | null>(null);

  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const daysSince = useMemo(() => daysSinceLastPractice(entries), [entries]);
  const chartPoints = useMemo(() => buildCumulativeHoursPath(entries), [entries]);

  async function handleToggleArchived() {
    if (!skill) return;
    setActionError(null);
    const { error } = await setArchived(skill.id, !skill.archivedAt);
    if (error) setActionError(error);
  }

  async function handleLevelChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateSkill(skill.id, { genericLevel: e.target.value as GenericLevel });
    if (error) setActionError(error);
  }

  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    setActionError(null);
    const { error } = await toggleMilestone(milestoneId, completed);
    if (error) setActionError(error);
  }

  // Tant que les skills chargent, on ne peut pas conclure. Une fois le
  // chargement terminé, un id qui ne correspond à rien = deep link cassé
  // (skill supprimé, lien périmé) : c'est l'écran « introuvable » prévu
  // par la spec, pas un « Chargement… » qui ne finit jamais.
  // `skills.length === 0` en plus de `loading` : useSkills repasse
  // loading à true à CHAQUE refresh, y compris celui qui suit une
  // modification (niveau, notes, archivage). Sans cette condition, tout
  // l'écran clignoterait sur « Chargement… » à chaque édition.
  if (loading && skills.length === 0) {
    return <p className="text-muted">Chargement…</p>;
  }
  if (!skill) {
    // Le chargement a échoué : la liste est vide parce que la requête a
    // raté, pas parce que le skill n'existe plus. Ne pas afficher
    // « Introuvable », qui serait un diagnostic faux.
    if (skillsError) {
      return (
        <p role="alert" className="text-sm text-danger">
          {skillsError}
        </p>
      );
    }
    return <Introuvable />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Le skill est affiché, mais une requête annexe a pu échouer :
          le signaler plutôt que de montrer un graphe/journal vide. */}
      {entriesError && (
        <p role="alert" className="text-sm text-danger">
          {entriesError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl text-champagne">{skill.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <span key={tag} className="border border-ink-700 px-2 py-0.5 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleToggleArchived}
          className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne"
        >
          {skill.archivedAt ? 'Désarchiver' : 'Archiver'}
        </button>
      </div>

      <div className="flex gap-8 text-sm text-muted">
        <span>
          Streak : <span className="text-accent-bright">{streak} j</span>
        </span>
        <span>
          Dernière pratique :{' '}
          <span className="text-champagne">
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </span>
        </span>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm text-muted">
        Niveau
        <select
          value={skill.genericLevel}
          onChange={handleLevelChange}
          className="border border-ink-700 bg-ink-800 px-3 py-2 text-champagne"
        >
          {(Object.keys(LEVEL_LABELS) as GenericLevel[]).map((level) => (
            <option key={level} value={level}>
              {LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </label>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Notes</h2>
        {/* Partie « second cerveau » de la spec : les réflexions libres
            sur un skill étaient saisies à la création et cherchables,
            mais jamais réaffichées ni modifiables ensuite. */}
        <NotesSection
          key={skill.id}
          notes={skill.notes}
          onSave={(notes) => updateSkill(skill.id, { notes })}
        />
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Progression (heures cumulées)</h2>
        <svg viewBox="0 0 400 120" className="w-full max-w-xl border border-ink-700 bg-ink-800">
          <polyline points={chartPoints} fill="none" stroke="#E7B94E" strokeWidth="2" />
        </svg>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Jalons</h2>
        {milestonesError && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {milestonesError}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => (
            <li key={m.id} className="text-sm">
              {/* Case et texte dans un même <label> : cliquer le texte doit
                  aussi cocher, comme partout ailleurs dans l'app — la case
                  seule était une cible bien trop petite (audit ui-ux-pro-max). */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!m.completedAt}
                  onChange={(e) => handleToggleMilestone(m.id, e.target.checked)}
                />
                <span className={m.completedAt ? 'text-muted line-through' : 'text-champagne'}>{m.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <NewMilestoneForm onAdd={addMilestone} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-lg text-champagne">Journal de pratique</h2>
          <Link to={`/entree/nouvelle?skillId=${skill.id}`} className="text-sm text-accent-bright underline">
            + Nouvelle entrée
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border border-ink-700 p-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>{new Date(entry.practicedAt).toLocaleDateString('fr-FR')}</span>
                <span className="font-data">{entry.durationMinutes} min</span>
              </div>
              {entry.note && <p className="mt-1 text-champagne">{entry.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NotesSection({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (notes: string | null) => Promise<{ error: string | null }>;
}) {
  // Monté avec key={skill.id} côté parent : l'état local est réinitialisé
  // quand on passe d'un skill à un autre.
  const [value, setValue] = useState(notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Refs et pas la prop `notes` : cliquer sur « Enregistrer » déclenche
  // d'abord le blur du textarea, donc deux appels rapprochés avant que la
  // prop rafraîchie ne revienne. Ces deux refs rendent le second appel
  // no-op au lieu d'écrire deux fois la même valeur.
  const persistedRef = useRef(notes ?? '');
  const inFlightRef = useRef(false);

  async function handleSave() {
    const next = value.trim() ? value : null;
    const nextValue = next ?? '';
    if (inFlightRef.current || persistedRef.current === nextValue) return;
    inFlightRef.current = true;
    setStatus('saving');
    setError(null);
    const { error: saveError } = await onSave(next);
    inFlightRef.current = false;
    if (saveError) {
      setStatus('idle');
      // La saisie reste dans le textarea — pas de perte, retry manuel.
      setError(saveError);
      return;
    }
    persistedRef.current = nextValue;
    setStatus('saved');
  }

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus('idle');
        }}
        onBlur={handleSave}
        rows={4}
        aria-label="Notes sur ce skill"
        placeholder="Aucune note. Écris ici tes réflexions sur ce skill…"
        className="border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-champagne"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving'}
          className="w-fit border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne disabled:opacity-60"
        >
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {status === 'saved' && <span className="text-sm text-muted">Notes enregistrées.</span>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        setSubmitting(true);
        setError(null);
        const { error: addError } = await onAdd(label);
        setSubmitting(false);
        if (addError) {
          setError(addError);
          return;
        }
        input.value = '';
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          name="label"
          placeholder="Nouveau jalon"
          disabled={submitting}
          className="flex-1 border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
        />
        <button
          type="submit"
          disabled={submitting}
          className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne disabled:opacity-60"
        >
          Ajouter
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}

function buildCumulativeHoursPath(entries: { practicedAt: string; durationMinutes: number }[]): string {
  if (entries.length === 0) return '';
  const sorted = [...entries].sort((a, b) => new Date(a.practicedAt).getTime() - new Date(b.practicedAt).getTime());
  const totalMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
  const maxHours = Math.max(totalMinutes / 60, 1);

  let cumulativeMinutes = 0;
  return sorted
    .map((entry, i) => {
      cumulativeMinutes += entry.durationMinutes;
      const x = sorted.length === 1 ? 400 : (i / (sorted.length - 1)) * 400;
      const y = 120 - (cumulativeMinutes / 60 / maxHours) * 110 - 5;
      return `${x},${y}`;
    })
    .join(' ');
}

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useMilestones } from '../hooks/useMilestones';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import type { GenericLevel } from '../lib/types';
import Introuvable from './Introuvable';
import { ChevronLeftIcon, ChevronDownIcon, CheckIcon } from '../components/icons';

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
  const totalHours = useMemo(
    () => Math.round((entries.reduce((sum, e) => sum + e.durationMinutes, 0) / 60) * 10) / 10,
    [entries]
  );
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
    <div className="flex flex-col gap-6">
      <Link to="/skills" className="flex w-fit items-center gap-2 font-sans text-[13px] text-muted hover:text-champagne">
        <ChevronLeftIcon />
        Retour
      </Link>

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
          <h1 className="font-serif text-[36px] leading-tight text-champagne">{skill.name}</h1>
          {skill.tags.length > 0 && (
            <p className="mt-1.5 text-[13px] text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="relative flex items-center gap-1.5 border border-accent-mid px-3.5 py-2 font-data text-[11px] uppercase tracking-[0.08em] text-accent-mid">
            {LEVEL_LABELS[skill.genericLevel]}
            <ChevronDownIcon />
            <select
              value={skill.genericLevel}
              onChange={handleLevelChange}
              aria-label="Niveau"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {(Object.keys(LEVEL_LABELS) as GenericLevel[]).map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleToggleArchived}
            className="border border-ink-700 px-3.5 py-2 font-sans text-[13px] text-muted hover:text-champagne"
          >
            {skill.archivedAt ? 'Désarchiver' : 'Archiver'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-9">
        <div className="flex w-[260px] min-w-[260px] flex-col items-center justify-center gap-3 border border-ink-700 bg-ink-900 p-6">
          <svg viewBox="0 0 220 130" className="w-full">
            <polyline points={chartPoints} fill="none" stroke="#E7B94E" strokeWidth="2" />
          </svg>
          <p className="font-data text-2xl text-champagne">{totalHours}h</p>
          <p className="font-data text-[11px] uppercase tracking-[0.05em] text-muted">cumulées</p>
          <p className="text-center text-sm text-muted">
            Streak : <span className="text-accent-bright">{streak} j</span> · dernière pratique{' '}
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section>
            <h2 className="mb-3 font-sans text-sm font-semibold text-champagne">Jalons</h2>
            {milestonesError && (
              <p role="alert" className="mb-2 text-sm text-danger">
                {milestonesError}
              </p>
            )}
            <ul className="flex flex-col gap-0 border-l border-ink-700 pl-[18px]">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center py-2">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    {/* Marge négative sur la case seulement (pas la ligne) :
                        elle chevauche le trait vertical du <ul>, le texte
                        suivant garde une position quasi normale grâce au
                        gap (technique reprise de la maquette Detail). */}
                    <span className="relative -ml-[27px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={!!m.completedAt}
                        onChange={(e) => handleToggleMilestone(m.id, e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                      >
                        {m.completedAt && <CheckIcon size={11} />}
                      </span>
                    </span>
                    <span className={`text-sm ${m.completedAt ? 'text-muted line-through' : 'text-champagne'}`}>
                      {m.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <NewMilestoneForm onAdd={addMilestone} />
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-sans text-sm font-semibold text-champagne">Journal</h2>
              <Link to={`/entree/nouvelle?skillId=${skill.id}`} className="text-sm text-accent-bright underline">
                + Nouvelle entrée
              </Link>
            </div>
            <div className="flex flex-col overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="flex gap-[18px] border-t border-ink-700 py-3.5 last:border-b">
                  <p className="w-20 font-data text-xs text-muted">
                    {new Date(entry.practicedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="w-16 font-data text-xs text-accent-bright">{entry.durationMinutes} min</p>
                  <p className="flex-1 text-sm text-champagne">{entry.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-sans text-sm font-semibold text-champagne">Notes</h2>
            {/* Partie « second cerveau » de la spec : les réflexions libres
                sur un skill étaient saisies à la création et cherchables,
                mais jamais réaffichées ni modifiables ensuite. */}
            <NotesSection key={skill.id} notes={skill.notes} onSave={(notes) => updateSkill(skill.id, { notes })} />
          </section>
        </div>
      </div>
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
    <div className="flex flex-col gap-2">
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
        className="border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-champagne placeholder:text-muted focus:outline-none"
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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
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
          className="flex-1 border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-champagne placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne disabled:opacity-60"
        >
          Ajouter
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
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
      const x = sorted.length === 1 ? 220 : (i / (sorted.length - 1)) * 220;
      const y = 120 - (cumulativeMinutes / 60 / maxHours) * 110 - 5;
      return `${x},${y}`;
    })
    .join(' ');
}

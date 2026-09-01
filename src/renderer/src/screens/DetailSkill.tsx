import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useMilestones } from '../hooks/useMilestones';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import type { GenericLevel } from '../lib/types';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export default function DetailSkill() {
  const { id } = useParams<{ id: string }>();
  const { skills, updateSkill, setArchived } = useSkills();
  const { milestones, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const { entries } = usePracticeEntries(id ?? null);

  const skill = skills.find((s) => s.id === id);

  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const daysSince = useMemo(() => daysSinceLastPractice(entries), [entries]);
  const chartPoints = useMemo(() => buildCumulativeHoursPath(entries), [entries]);

  if (!skill) {
    return <p className="text-muted">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
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
          onClick={() => setArchived(skill.id, !skill.archivedAt)}
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
          onChange={(e) => updateSkill(skill.id, { genericLevel: e.target.value as GenericLevel })}
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
        <h2 className="mb-2 font-serif text-lg text-champagne">Progression (heures cumulées)</h2>
        <svg viewBox="0 0 400 120" className="w-full max-w-xl border border-ink-700 bg-ink-800">
          <polyline points={chartPoints} fill="none" stroke="#E7B94E" strokeWidth="2" />
        </svg>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg text-champagne">Jalons</h2>
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!m.completedAt} onChange={(e) => toggleMilestone(m.id, e.target.checked)} />
              <span className={m.completedAt ? 'text-muted line-through' : 'text-champagne'}>{m.label}</span>
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

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        if (input.value.trim()) {
          onAdd(input.value.trim());
          input.value = '';
        }
      }}
      className="mt-3 flex gap-2"
    >
      <input
        name="label"
        placeholder="Nouveau jalon"
        className="flex-1 border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
      />
      <button type="submit" className="border border-ink-700 px-3 py-1.5 text-sm text-muted hover:text-champagne">
        Ajouter
      </button>
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

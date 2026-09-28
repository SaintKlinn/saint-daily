import { useMemo, useState } from 'react';
import { calculateStreak, daysSinceLastPractice, filterSkillsForPicker, sortSkillsByRecentPractice } from '../lib/streaks';
import { useJoursRepos } from '../lib/joursRepos';
import { SearchIcon } from './icons';
import type { Engagement, PracticeEntry } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function SkillPicker({
  skills,
  entriesBySkill,
  value,
  onChange,
  loading = false,
}: {
  skills: Engagement[];
  entriesBySkill: Record<string, PracticeEntry[]>;
  value: string;
  onChange: (skillId: string) => void;
  loading?: boolean;
}) {
  const [search, setSearch] = useState('');
  // Le Pomodoro y ajoute les projets (session de chantier) : les libellés
  // le disent seulement quand il y en a.
  const avecProjets = skills.some((s) => s.isProject);
  const quoi = avecProjets ? 'un skill ou un projet' : 'un skill';
  const repos = useJoursRepos();

  const visible = useMemo(() => {
    const filtered = filterSkillsForPicker(skills, search);
    return sortSkillsByRecentPractice(filtered, entriesBySkill);
  }, [skills, entriesBySkill, search]);

  return (
    <label className="flex flex-col gap-1 text-libelle uppercase tracking-[0.04em] text-muted">
      {avecProjets ? 'Skill ou projet' : 'Skill'}
      <div className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-4 py-3">
        <SearchIcon className="text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Rechercher ${quoi}`}
          aria-label={`Rechercher ${quoi}`}
          className={`w-full bg-transparent font-sans text-corps normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
      </div>
      <div className="max-h-56 overflow-y-auto border border-ink-700">
        {visible.length === 0 && (
          <p className="px-4 py-3 text-corps normal-case tracking-normal text-muted">
            {loading ? 'Chargement…' : 'Aucun skill ne correspond.'}
          </p>
        )}
        {visible.map((skill) => {
          const entries = entriesBySkill[skill.id] ?? [];
          const streak = calculateStreak(entries, undefined, repos);
          const daysSince = daysSinceLastPractice(entries);
          const selected = skill.id === value;
          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => onChange(skill.id)}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-2 border-b border-l-2 border-ink-700 bg-ink-800 px-4 py-3 text-left normal-case tracking-normal transition-colors duration-150 last:border-b-0 ${FOCUS_RING} ${selected ? 'border-l-accent-bright bg-ink-700' : 'border-l-transparent hover:bg-ink-700'}`}
            >
              <span className={`font-serif text-corps ${selected ? 'text-accent-bright' : 'text-champagne'}`}>{skill.name}</span>
              <span className="font-data text-right text-secondaire text-muted">
                dernière · {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
                <br />
                {/* Un projet n'a pas de série à lui : ses jours comptent
                    surtout sur ses skills. On dit plutôt ce qu'il est. */}
                {skill.isProject ? 'projet · session de chantier' : streak > 0 ? `série de ${streak} j` : 'pas de série en cours'}
              </span>
            </button>
          );
        })}
      </div>
    </label>
  );
}

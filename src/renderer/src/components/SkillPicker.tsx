import { useMemo, useState } from 'react';
import { calculateStreak, daysSinceLastPractice, filterSkillsForPicker, sortSkillsByRecentPractice } from '../lib/streaks';
import { SearchIcon } from './icons';
import type { PracticeEntry, Skill } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function SkillPicker({
  skills,
  entriesBySkill,
  value,
  onChange,
}: {
  skills: Skill[];
  entriesBySkill: Record<string, PracticeEntry[]>;
  value: string;
  onChange: (skillId: string) => void;
}) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const filtered = filterSkillsForPicker(skills, search);
    return sortSkillsByRecentPractice(filtered, entriesBySkill);
  }, [skills, entriesBySkill, search]);

  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
      Skill
      <div className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2.5">
        <SearchIcon className="text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un skill"
          aria-label="Rechercher un skill"
          className={`w-full bg-transparent font-sans text-[15px] normal-case tracking-normal text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
      </div>
      <div className="max-h-56 overflow-y-auto border border-ink-700">
        {visible.length === 0 && <p className="px-3.5 py-3 text-sm normal-case tracking-normal text-muted">Aucun skill ne correspond.</p>}
        {visible.map((skill) => {
          const entries = entriesBySkill[skill.id] ?? [];
          const streak = calculateStreak(entries);
          const daysSince = daysSinceLastPractice(entries);
          const selected = skill.id === value;
          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => onChange(skill.id)}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-3 border-b border-ink-700 px-3.5 py-2.5 text-left normal-case tracking-normal transition-colors duration-150 last:border-b-0 ${FOCUS_RING} ${selected ? 'bg-ink-700' : 'hover:bg-ink-800'}`}
            >
              <span className="font-serif text-[15px] text-champagne">{skill.name}</span>
              <span className="font-data text-right text-xs text-muted">
                série de {streak} j
                <br />
                {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
              </span>
            </button>
          );
        })}
      </div>
    </label>
  );
}

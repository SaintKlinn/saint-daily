import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { filterByTag, calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import Toggle from '../components/Toggle';
import { SearchIcon } from '../components/icons';
import type { GenericLevel } from '../lib/types';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export default function ListeSkills() {
  const { skills, error } = useSkills();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));

  const allTags = useMemo(() => Array.from(new Set(skills.flatMap((s) => s.tags))).sort(), [skills]);

  const visible = useMemo(() => {
    let list = skills.filter((s) => (showArchived ? true : !s.archivedAt));
    list = filterByTag(list, tag);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(needle) || (s.notes ?? '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [skills, tag, search, showArchived]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[30px] text-champagne">Skills</h1>
        <div className="flex items-center gap-3.5">
          <Toggle bordered={false} checked={showArchived} onChange={setShowArchived} label="Voir les skills en pause" />
          <div className="flex items-center gap-2 border border-ink-700 bg-ink-900 px-3.5 py-2">
            <SearchIcon className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un skill ou une note"
              className="w-56 bg-transparent font-sans text-[13px] text-champagne placeholder:text-muted focus:outline-none"
            />
          </div>
          <Link to="/skills/nouveau" className="bg-accent-bright px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-accent-hover">
            + Nouveau skill
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setTag(null)}
            className={`font-data text-xs px-3 py-1.5 ${tag === null ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
          >
            Tous les tags
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`font-data text-xs px-3 py-1.5 ${tag === t ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {visible.map((skill) => {
          const entries = entriesBySkill[skill.id] ?? [];
          const streak = calculateStreak(entries);
          const daysSince = daysSinceLastPractice(entries);
          return (
            <Link
              key={skill.id}
              to={`/skills/${skill.id}`}
              className={`flex items-center gap-5 bg-ink-800 px-[22px] py-5 hover:bg-ink-700 ${skill.archivedAt ? 'opacity-55' : ''}`}
            >
              <ProgressRing
                size={40}
                radius={17}
                filled={
                  skill.archivedAt || !settings ? 0 : ringFillFromDaysSince(daysSince, settings.reminderThresholdDays)
                }
              />
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-serif text-[19px] text-champagne">{skill.name}</span>
                  <span
                    className={`font-data text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 border ${
                      skill.archivedAt ? 'border-muted text-muted' : 'border-accent-mid text-accent-mid'
                    }`}
                  >
                    {skill.archivedAt ? 'En pause' : LEVEL_LABELS[skill.genericLevel]}
                  </span>
                </div>
                {skill.tags.length > 0 && (
                  <p className="mt-1 text-[13px] text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                )}
              </div>
              <p className="font-data text-right text-[13px] text-muted">
                {skill.archivedAt ? (
                  'archivé'
                ) : (
                  <>
                    série de {streak} j
                    <br />
                    dernière · {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
                  </>
                )}
              </p>
            </Link>
          );
        })}
        {visible.length === 0 && <p className="bg-ink-800 px-[22px] py-5 text-sm text-muted">Aucun skill ne correspond.</p>}
      </div>
    </div>
  );
}

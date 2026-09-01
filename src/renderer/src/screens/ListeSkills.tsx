import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { filterByTag } from '../lib/streaks';

export default function ListeSkills() {
  const { skills, error } = useSkills();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-champagne">Skills</h1>
        <Link to="/skills/nouveau" className="bg-accent-bright px-4 py-2 text-sm font-semibold text-ink-900">
          + Nouveau skill
        </Link>
      </div>

      {/* Sans ça, un échec de chargement était indiscernable d'une liste
          réellement vide (« Aucun skill ne correspond. »). */}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
        />
        <select
          value={tag ?? ''}
          onChange={(e) => setTag(e.target.value || null)}
          className="border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-champagne"
        >
          <option value="">Tous les tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Voir les skills en pause
        </label>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((skill) => (
          <li key={skill.id}>
            <Link
              to={`/skills/${skill.id}`}
              className="flex items-center justify-between border border-ink-700 bg-ink-800 px-4 py-3 hover:border-accent-bright"
            >
              <span className="text-champagne">{skill.name}</span>
              <span className="flex gap-2">
                {skill.tags.map((t) => (
                  <span key={t} className="text-xs text-muted">
                    {t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted">Aucun skill ne correspond.</p>}
      </ul>
    </div>
  );
}

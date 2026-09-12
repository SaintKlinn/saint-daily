import { useMemo, useState } from 'react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntriesForUser } from '../hooks/usePracticeEntries';
import { filterJournalEntries, type JournalEntry } from '../lib/journal';
import { formatMinutes } from '../lib/retrospective';
import EmptyState from '../components/EmptyState';
import { SearchIcon } from '../components/icons';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

interface Row extends JournalEntry {
  durationMinutes: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Journal() {
  const { engagements, deletedEngagements, error: engagementsError } = useEngagements();
  const { entries, loading, error: entriesError } = useAllPracticeEntriesForUser();
  const [search, setSearch] = useState('');

  // Les engagements en corbeille sont inclus dans la table de noms : leur
  // historique reste de l'historique, et une ligne sans nom serait pire
  // qu'une ligne nommée.
  const namesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const engagement of [...engagements, ...deletedEngagements]) map[engagement.id] = engagement.name;
    return map;
  }, [engagements, deletedEngagements]);

  const rows = useMemo<Row[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        engagementName: namesById[entry.engagementId] ?? 'Engagement inconnu',
        note: entry.note,
        tags: entry.tags,
        practicedAt: entry.practicedAt,
        durationMinutes: entry.durationMinutes,
      })),
    [entries, namesById]
  );

  const visible = useMemo(() => filterJournalEntries(rows, search), [rows, search]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[30px] text-champagne">Journal</h1>
        <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une note, un tag, un engagement"
            aria-label="Rechercher dans le journal"
            className={`w-72 bg-transparent text-[13px] text-champagne placeholder:text-muted ${FOCUS_RING}`}
          />
        </label>
      </div>

      {engagementsError && (
        <p role="alert" className="text-sm text-danger">
          {engagementsError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-sm text-danger">
          {entriesError}
        </p>
      )}

      {loading ? (
        <EmptyState role="status">Chargement…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>Aucune séance enregistrée pour l'instant.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>Aucun résultat pour « {search.trim()} ».</EmptyState>
      ) : (
        <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
          {visible.map((row) => (
            <article key={row.id} className="flex flex-col gap-1.5 bg-ink-800 px-[18px] py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-serif text-[17px] text-champagne">{row.engagementName}</span>
                <span className="font-data text-[11px] tabular-nums text-muted">
                  {formatDate(row.practicedAt)} · {formatMinutes(row.durationMinutes)}
                </span>
              </div>
              {row.note && <p className="whitespace-pre-wrap text-[13px] text-champagne">{row.note}</p>}
              {row.tags.length > 0 && (
                <p className="text-[12px] text-muted">{row.tags.map((tag) => `#${tag}`).join(' ')}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

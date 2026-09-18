import { useDeferredValue, useMemo, useState } from 'react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntriesForUser } from '../hooks/usePracticeEntries';
import { useDailyReflections } from '../hooks/useDailyReflections';
import { filterJournalEntries, type JournalEntry } from '../lib/journal';
import { formatMinutes } from '../lib/retrospective';
import EmptyState from '../components/EmptyState';
import { SearchIcon } from '../components/icons';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// Au-delà de ce seuil, on tronque le rendu plutôt que de reconstruire des
// milliers de nœuds DOM à chaque frappe. Pas de virtualisation ici :
// c'est un écran qu'on consulte, pas un qu'on habite, et 200 lignes
// couvrent déjà largement un scan visuel.
const MAX_VISIBLE_ROWS = 200;

interface Row extends JournalEntry {
  kind: 'seance' | 'reflexion';
  durationMinutes: number;
  // Les séances ont une heure, les réflexions seulement un jour : on trie
  // sur `created_at` pour les secondes, ce qui les place naturellement en
  // fin de leur journée — là où un bilan du soir appartient.
  sortAt: string;
}

// Une date seule (`AAAA-MM-JJ`) est interprétée en UTC par `new Date`,
// alors qu'elle désigne un jour local : on l'ancre à midi local pour que
// le libellé affiché soit le bon jour dans tous les fuseaux.
function parseRowDate(value: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!dateOnly) return new Date(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(iso: string): string {
  return parseRowDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Journal() {
  const {
    engagements,
    deletedEngagements,
    loading: engagementsLoading,
    error: engagementsError,
  } = useEngagements();
  const { entries, loading: entriesLoading, error: entriesError } = useAllPracticeEntriesForUser();
  const { reflections } = useDailyReflections();
  const loading = engagementsLoading || entriesLoading;
  const [search, setSearch] = useState('');
  // Différé pour que la frappe reste fluide sur un long historique : la
  // reconstruction de la liste filtrée n'a pas besoin d'être synchrone
  // avec chaque touche.
  const deferredSearch = useDeferredValue(search);

  // Les engagements en corbeille sont inclus dans la table de noms : leur
  // historique reste de l'historique, et une ligne sans nom serait pire
  // qu'une ligne nommée.
  const namesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const engagement of [...engagements, ...deletedEngagements]) map[engagement.id] = engagement.name;
    return map;
  }, [engagements, deletedEngagements]);

  const rows = useMemo<Row[]>(() => {
    const seances: Row[] = entries.map((entry) => ({
      kind: 'seance',
      id: entry.id,
      engagementName: namesById[entry.engagementId] ?? 'Engagement inconnu',
      note: entry.note,
      tags: entry.tags,
      practicedAt: entry.practicedAt,
      durationMinutes: entry.durationMinutes,
      sortAt: entry.practicedAt,
    }));
    const bilans: Row[] = reflections.map((reflection) => ({
      kind: 'reflexion',
      id: `reflexion-${reflection.id}`,
      // Le libellé sert aussi de cible de recherche : chercher « bilan »
      // doit ramener ses bilans du soir.
      engagementName: 'Bilan du soir',
      note: reflection.text,
      tags: [],
      practicedAt: reflection.date,
      durationMinutes: 0,
      sortAt: reflection.createdAt,
    }));
    return [...seances, ...bilans].sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0));
  }, [entries, namesById, reflections]);

  const visible = useMemo(() => filterJournalEntries(rows, deferredSearch), [rows, deferredSearch]);
  const visibleRows = visible.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = visible.length - visibleRows.length;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-titre-ecran text-champagne">Journal</h1>
        <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une note, un tag, un engagement"
            aria-label="Rechercher dans le journal"
            className={`w-72 bg-transparent text-secondaire text-champagne placeholder:text-muted ${FOCUS_RING}`}
          />
        </label>
      </div>

      {engagementsError && (
        <p role="alert" className="text-corps text-danger">
          {engagementsError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
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
          {visibleRows.map((row) => (
            <article key={row.id} className="flex flex-col gap-1.5 bg-ink-800 px-[18px] py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-serif text-titre text-champagne">{row.engagementName}</span>
                <span className="font-data text-libelle tabular-nums text-muted">
                  {formatDate(row.practicedAt)}
                  {row.kind === 'seance' ? ` · ${formatMinutes(row.durationMinutes)}` : ' · bilan du soir'}
                </span>
              </div>
              {row.note && <p className="whitespace-pre-wrap text-secondaire text-champagne">{row.note}</p>}
              {row.tags.length > 0 && (
                <p className="text-secondaire text-muted">{row.tags.map((tag) => `#${tag}`).join(' ')}</p>
              )}
            </article>
          ))}
          {hiddenCount > 0 && (
            <p className="bg-ink-800 px-[18px] py-3 font-data text-libelle text-muted">
              + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} résultat{hiddenCount > 1 ? 's' : ''} — affine ta
              recherche pour les voir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

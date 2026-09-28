import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntriesForUser } from '../hooks/usePracticeEntries';
import { useDailyReflections } from '../hooks/useDailyReflections';
import { filterJournalEntries, grouperParJour, libelleJour, type JournalEntry } from '../lib/journal';
import { formatMinutes } from '../lib/retrospective';
import EmptyState from '../components/EmptyState';
import { SearchIcon } from '../components/icons';
import Button from '../components/Button';
import EditeurSeance from '../components/EditeurSeance';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// Rendu par pages plutôt que tout l'historique d'un coup : pas de
// reconstruction de milliers de nœuds DOM à chaque frappe, et pas de
// virtualisation — c'est un écran qu'on consulte, pas un qu'on habite.
// L'ancien plafond fixe (200 lignes) laissait le reste inaccessible sauf par
// la recherche ; « Afficher plus » y donne accès.
const PAGE = 50;

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

function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function Journal() {
  const {
    engagements,
    deletedEngagements,
    loading: engagementsLoading,
    error: engagementsError,
  } = useEngagements();
  const { entries, loading: entriesLoading, error: entriesError, refresh: rechargerSeances } = useAllPracticeEntriesForUser();
  // Séance ouverte dans l'éditeur (voir EditeurSeance), par identifiant :
  // l'objet complet est relu dans `entries`, toujours à jour.
  const { reflections } = useDailyReflections();
  const loading = engagementsLoading || entriesLoading;
  const [search, setSearch] = useState('');
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const seanceEnEdition = enEdition ? entries.find((e) => e.id === enEdition) ?? null : null;
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
      engagementName: namesById[entry.engagementId] ?? 'Élément supprimé',
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
  const [nbAffiches, setNbAffiches] = useState(PAGE);
  // Une nouvelle recherche repart de la première page.
  useEffect(() => setNbAffiches(PAGE), [deferredSearch]);
  const visibleRows = useMemo(() => visible.slice(0, nbAffiches), [visible, nbAffiches]);
  const hiddenCount = visible.length - visibleRows.length;
  // La date de chaque ligne passe en en-tête de journée : elle n'est plus
  // répétée ligne après ligne, et les journées se distinguent d'un coup d'œil.
  const journees = useMemo(() => grouperParJour(visibleRows, (row) => parseRowDate(row.practicedAt)), [visibleRows]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-titre-ecran text-champagne">Journal</h1>
        <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-4 py-2">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une note, un tag, un skill"
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
        <EmptyState titre="Ton journal est vide" action={{ libelle: 'Logger une séance', vers: '/entree/nouvelle' }}>
          Chaque séance que tu enregistres y apparaît, avec sa note et ton humeur, aux côtés de tes bilans du soir.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>Aucun résultat pour « {search.trim()} ».</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {journees.map((journee) => {
            const minutes = journee.lignes.reduce((total, row) => total + row.durationMinutes, 0);
            return (
              <section key={journee.cle} aria-label={libelleJour(journee.date)} className="flex flex-col gap-2">
                <h2 className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-corps font-semibold text-champagne first-letter:uppercase">
                    {libelleJour(journee.date)}
                  </span>
                  {minutes > 0 && (
                    <span className="font-data text-libelle tabular-nums text-muted">{formatMinutes(minutes)}</span>
                  )}
                </h2>
                <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
                  {journee.lignes.map((row) => (
                    <article key={row.id} className="flex flex-col gap-2 bg-ink-800 px-4 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-serif text-titre text-champagne">{row.engagementName}</span>
                        <span className="flex items-baseline gap-3">
                          <span className="font-data text-libelle tabular-nums text-muted">
                            {row.kind === 'seance'
                              ? `${formatHeure(row.practicedAt)} · ${formatMinutes(row.durationMinutes)}`
                              : 'bilan du soir'}
                          </span>
                          {row.kind === 'seance' && (
                            <button
                              type="button"
                              onClick={() => setEnEdition(row.id)}
                              aria-label={`Modifier la séance ${row.engagementName} de ${formatHeure(row.practicedAt)}`}
                              className={`font-data text-libelle text-muted underline-offset-4 hover:text-champagne hover:underline ${FOCUS_RING}`}
                            >
                              Modifier
                            </button>
                          )}
                        </span>
                      </div>
                      {row.note && <p className="whitespace-pre-wrap text-secondaire text-champagne">{row.note}</p>}
                      {row.tags.length > 0 && (
                        <p className="text-secondaire text-muted">{row.tags.map((tag) => `#${tag}`).join(' ')}</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {hiddenCount > 0 && (
            <Button variant="secondary" className="self-center" onClick={() => setNbAffiches((n) => n + PAGE)}>
              Afficher {Math.min(PAGE, hiddenCount)} de plus
              <span className="font-data text-libelle text-muted">
                · {hiddenCount} entrée{hiddenCount > 1 ? 's' : ''} restante{hiddenCount > 1 ? 's' : ''}
              </span>
            </Button>
          )}
        </div>
      )}
      {seanceEnEdition && (
        <EditeurSeance
          seance={seanceEnEdition}
          nom={namesById[seanceEnEdition.engagementId] ?? 'Séance'}
          onFermer={() => setEnEdition(null)}
          onChange={() => void rechargerSeances()}
        />
      )}
    </div>
  );
}

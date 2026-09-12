import { useMemo, useState, type ReactNode } from 'react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntriesForUser } from '../hooks/usePracticeEntries';
import {
  compareWeeks,
  engagementBreakdown,
  engagementIdentity,
  tagBreakdown,
  timeOfDayBuckets,
  type EngagementLike,
} from '../lib/retrospective';
import BarreRepartition from '../components/BarreRepartition';
import HeatmapCalendrier from '../components/HeatmapCalendrier';
import MeilleureHeureProductivite from '../components/MeilleureHeureProductivite';
import SemaineVsSemaine from '../components/SemaineVsSemaine';
import EmptyState from '../components/EmptyState';

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border border-ink-700 bg-ink-800 p-6">
      <h2 className="font-sans text-[15px] font-semibold text-champagne">{titre}</h2>
      {children}
    </section>
  );
}

export default function Bilan() {
  const { engagements, loading: engagementsLoading, error: engagementsError } = useEngagements();
  const { entries, loading: entriesLoading, error: entriesError } = useAllPracticeEntriesForUser();
  const loading = engagementsLoading || entriesLoading;
  const [heatmapEngagementId, setHeatmapEngagementId] = useState('tous');

  const engagementsById = useMemo(() => {
    const map: Record<string, EngagementLike> = {};
    for (const engagement of engagements) {
      map[engagement.id] = {
        id: engagement.id,
        name: engagement.name,
        tags: engagement.tags,
        recurrenceSeriesId: engagement.recurrenceSeriesId,
      };
    }
    return map;
  }, [engagements]);

  // Les projets ne se pratiquent pas et n'ont donc jamais d'entrée ; les
  // archivés restent hors du sélecteur mais leurs entrées comptent bien
  // dans la vue "Tous", puisque l'historique reste l'historique. Une
  // sélection est une IDENTITÉ (`engagementIdentity`), pas un `id` brut :
  // sans ça, une série récurrente de 56 occurrences lisait comme 56
  // options identiques dans le menu.
  const selectableEngagements = useMemo(() => {
    const byIdentity = new Map<string, { id: string; name: string }>();
    for (const engagement of engagements) {
      if (engagement.isProject || engagement.archivedAt) continue;
      const identity = engagementIdentity(engagement);
      if (!byIdentity.has(identity)) byIdentity.set(identity, { id: identity, name: engagement.name });
    }
    return [...byIdentity.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [engagements]);

  const heatmapEntries = useMemo(() => {
    if (heatmapEngagementId === 'tous') return entries;
    return entries.filter((entry) => {
      const engagement = engagementsById[entry.engagementId];
      return engagement ? engagementIdentity(engagement) === heatmapEngagementId : false;
    });
  }, [entries, heatmapEngagementId, engagementsById]);

  const comparison = useMemo(() => compareWeeks(entries), [entries]);
  const parTag = useMemo(() => tagBreakdown(entries, engagementsById), [entries, engagementsById]);
  const parEngagement = useMemo(() => engagementBreakdown(entries, engagementsById), [entries, engagementsById]);
  const creneaux = useMemo(() => timeOfDayBuckets(entries), [entries]);

  return (
    <div className="flex flex-col gap-7">
      <h1 className="font-serif text-[30px] text-champagne">Bilan</h1>

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
      ) : entries.length === 0 ? (
        <EmptyState>Pas encore assez d'historique pour dresser un bilan.</EmptyState>
      ) : (
        <>
          <Section titre="Activité sur douze mois">
            <HeatmapCalendrier
              entries={heatmapEntries}
              engagements={selectableEngagements}
              selectedEngagementId={heatmapEngagementId}
              onSelectEngagement={setHeatmapEngagementId}
            />
          </Section>

          <Section titre="Cette semaine">
            <SemaineVsSemaine comparison={comparison} />
          </Section>

          <div className="grid gap-7 lg:grid-cols-2">
            <Section titre="Répartition par tag">
              <BarreRepartition rows={parTag} emptyLabel="Aucun tag sur les engagements pratiqués." />
            </Section>

            <Section titre="Répartition par engagement">
              <BarreRepartition rows={parEngagement} emptyLabel="Aucun engagement pratiqué." />
            </Section>
          </div>

          <Section titre="Meilleure période de la journée">
            <MeilleureHeureProductivite buckets={creneaux} />
          </Section>
        </>
      )}
    </div>
  );
}

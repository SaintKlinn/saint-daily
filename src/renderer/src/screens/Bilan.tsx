import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntriesForUser } from '../hooks/usePracticeEntries';
import {
  compareWeeks,
  engagementBreakdown,
  engagementIdentity,
  formatMinutes,
  tagBreakdown,
  timeOfDayBuckets,
  weekDeltaLabel,
  weeklyTotals,
  type EngagementLike,
} from '../lib/retrospective';
import { calculateBestStreak, calculateStreak } from '../lib/streaks';
import { useJoursRepos } from '../lib/joursRepos';
import BarreRepartition from '../components/BarreRepartition';
import HeatmapCalendrier from '../components/HeatmapCalendrier';
import MeilleureHeureProductivite from '../components/MeilleureHeureProductivite';
import TendanceHebdo from '../components/TendanceHebdo';
import PomodorosSemaine from '../components/PomodorosSemaine';
import { usePomodoro } from '../lib/pomodoro';
import { derniersJours } from '../lib/historiquePomodoro';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { EASE_SORTIE, itemTransition, itemVariants, listVariants } from '../theme/mouvement';

// Enfant de la cascade des sections (voir le `motion.div` de rendu) : chaque
// carte monte à son tour plutôt que tout l'écran d'un bloc.
function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <motion.section
      variants={itemVariants}
      transition={itemTransition}
      className="flex flex-col gap-3 border border-ink-700 bg-ink-800 p-4"
    >
      <h2 className="font-sans text-corps font-semibold text-champagne">{titre}</h2>
      {children}
    </motion.section>
  );
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const jours = (n: number) => `${n} j`;

export default function Bilan() {
  const {
    engagements,
    deletedEngagements,
    loading: engagementsLoading,
    error: engagementsError,
  } = useEngagements();
  const { entries, loading: entriesLoading, error: entriesError } = useAllPracticeEntriesForUser();
  const loading = engagementsLoading || entriesLoading;
  const [heatmapEngagementId, setHeatmapEngagementId] = useState('tous');

  // Vivants ET en corbeille : comme pour un engagement archivé (qui reste
  // dans `engagements`), l'historique de pratique d'un skill supprimé ne
  // disparaît pas — seule la fiche part à la corbeille. Sans les deux
  // listes ici, ses entrées resteraient comptées dans le talon de la
  // semaine (heatmap, `compareWeeks`, `timeOfDayBuckets`) tout en
  // disparaissant silencieusement des répartitions par tag et par
  // engagement, qui ne retrouveraient plus l'engagement correspondant.
  const engagementsById = useMemo(() => {
    const map: Record<string, EngagementLike> = {};
    for (const engagement of [...engagements, ...deletedEngagements]) {
      map[engagement.id] = {
        id: engagement.id,
        name: engagement.name,
        tags: engagement.tags,
        recurrenceSeriesId: engagement.recurrenceSeriesId,
      };
    }
    return map;
  }, [engagements, deletedEngagements]);

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
  const semaines = useMemo(() => weeklyTotals(entries), [entries]);
  const { historique } = usePomodoro();
  const joursPomodoro = useMemo(() => derniersJours(historique), [historique]);
  // Toutes les entrées, tâches cochées comprises : c'est la même base que
  // la heatmap juste en dessous, donc une journée allumée sur la heatmap
  // compte aussi pour la série.
  const repos = useJoursRepos();
  const serie = useMemo(() => calculateStreak(entries, undefined, repos), [entries, repos]);
  const record = useMemo(() => calculateBestStreak(entries, repos), [entries, repos]);
  const total = useMemo(
    () => ({ minutes: entries.reduce((somme, entry) => somme + entry.durationMinutes, 0), seances: entries.length }),
    [entries]
  );

  return (
    <div className="flex flex-col gap-8">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_SORTIE }}
      >
        <h1 className="font-serif text-titre-ecran text-champagne">Bilan</h1>
        <p className="mt-1 text-secondaire text-muted">Ta pratique en chiffres, semaine après semaine.</p>
      </motion.header>

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
      ) : entries.length === 0 ? (
        <EmptyState titre="Pas encore de bilan" action={{ libelle: 'Logger une séance', vers: '/entree/nouvelle' }}>
          Le Bilan se construit à partir de tes séances : série, tendance sur douze semaines, activité de l'année. Une
          première séance suffit pour qu'il prenne forme.
        </EmptyState>
      ) : (
        <>
          {/* Les chiffres clés d'abord, avec la carte d'Accueil : c'est ce
              qu'on vient chercher en ouvrant le Bilan, le détail suit. La
              semaine en cours est la carte héros — c'est la seule sur
              laquelle on peut encore agir. */}
          <motion.section
            initial="hidden"
            animate="visible"
            variants={listVariants}
            transition={{ delayChildren: 0.1 }}
            aria-label="Chiffres clés"
            className="grid grid-cols-3 gap-6"
          >
            <StatCard
              label="Cette semaine"
              valeur={comparison.thisWeek.minutes}
              format={formatMinutes}
              detail={`${pluriel(comparison.thisWeek.sessions, 'séance')} · ${weekDeltaLabel(comparison)}`}
              hero
              rayVariant={4}
            />
            <StatCard
              label="Série en cours"
              valeur={serie}
              format={jours}
              detail={serie > 0 && serie >= record ? 'Ton record, en ce moment même.' : `Record : ${jours(record)}`}
              rayVariant={1}
            />
            <StatCard
              label="Temps total"
              valeur={total.minutes}
              format={formatMinutes}
              detail={pluriel(total.seances, 'séance')}
              rayVariant={3}
            />
          </motion.section>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
            transition={{ delayChildren: 0.3 }}
            className="flex flex-col gap-8"
          >
            <Section titre="Douze dernières semaines">
              <TendanceHebdo semaines={semaines} />
            </Section>

            <Section titre="Activité sur douze mois">
              <HeatmapCalendrier
                entries={heatmapEntries}
                engagements={selectableEngagements}
                selectedEngagementId={heatmapEngagementId}
                onSelectEngagement={setHeatmapEngagementId}
              />
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section titre="Répartition par tag">
                <BarreRepartition rows={parTag} emptyLabel="Aucun tag sur ce que tu as pratiqué." />
              </Section>

              <Section titre="Répartition par skill et tâche">
                <BarreRepartition rows={parEngagement} emptyLabel="Aucun temps de pratique enregistré." />
              </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section titre="Meilleure période de la journée">
                <MeilleureHeureProductivite buckets={creneaux} />
              </Section>

              <Section titre="Pomodoros sur sept jours">
                <PomodorosSemaine jours={joursPomodoro} />
              </Section>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

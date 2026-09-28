import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { filterByTag, calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import { useJoursRepos } from '../lib/joursRepos';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import Toggle from '../components/Toggle';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import { PlusIcon, SearchIcon } from '../components/icons';
import type { GenericLevel } from '../lib/types';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export default function ListeSkills() {
  const { engagements, loading, error } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { entriesBySkill } = useAllPracticeEntries(skills.map((s) => s.id));
  const repos = useJoursRepos();

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
    <div className="flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        // `flex-wrap` et `gap-6` : à la largeur minimale (960 px), la grappe
        // d'actions passe sous le titre au lieu de venir le coller, comme sur
        // l'Accueil.
        className="flex flex-wrap items-center justify-between gap-6"
      >
        <h1 className="font-serif text-titre-ecran text-champagne">Skills</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle bordered={false} checked={showArchived} onChange={setShowArchived} label="Voir les skills en pause" />
          <div className="flex items-center gap-2 border border-ink-700 bg-ink-900 px-4 py-2">
            <SearchIcon className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un skill ou une note"
              aria-label="Rechercher un skill ou une note"
              className="w-56 bg-transparent font-sans text-secondaire text-champagne placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
            />
          </div>
          <Link to="/skills/nouveau" className={buttonClassName('primary')}>
            <PlusIcon />
            Nouveau skill
          </Link>
        </div>
      </motion.div>

      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setTag(null)}
            aria-pressed={tag === null}
            className={`font-data text-secondaire px-3 py-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${tag === null ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
          >
            Tous les tags
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={`font-data text-secondaire px-3 py-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${tag === t ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* L'état vide vit hors du conteneur de liste : son fond plein
          (`bg-ink-700`, qui dessine les filets entre lignes) faisait de
          l'EmptyState un bloc vert clair, au lieu du cadre pointillé qu'il
          a partout ailleurs. */}
      {visible.length > 0 && (
      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {visible.map((skill, i) => {
          const entries = entriesBySkill[skill.id] ?? [];
          const streak = calculateStreak(entries, undefined, repos);
          const daysSince = daysSinceLastPractice(entries);
          return (
            <Link
              key={skill.id}
              to={`/skills/${skill.id}`}
              className={`flex items-center gap-2 bg-ink-800 p-4 transition-colors duration-200 hover:bg-ink-700 motion-safe:animate-[fade-up_0.4s_ease-out_backwards] ${skill.archivedAt ? 'opacity-55' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <ProgressRing
                size={40}
                radius={17}
                filled={
                  skill.archivedAt || !settings ? 0 : ringFillFromDaysSince(daysSince, settings.reminderThresholdDays)
                }
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-titre text-champagne">{skill.name}</span>
                  <span
                    className={`font-data text-libelle uppercase tracking-[0.08em] px-2 py-1 border ${
                      skill.archivedAt ? 'border-muted text-muted' : 'border-accent-mid text-accent-mid'
                    }`}
                  >
                    {skill.archivedAt ? 'En pause' : LEVEL_LABELS[skill.genericLevel]}
                  </span>
                </div>
                {skill.tags.length > 0 && (
                  <p className="mt-1 text-secondaire text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                )}
              </div>
              <p className="font-data text-right text-secondaire text-muted">
                {skill.archivedAt ? (
                  'archivé'
                ) : (
                  <>
                    {streak > 0 ? `série de ${streak} j` : 'pas de série en cours'}
                    <br />
                    dernière · {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
                  </>
                )}
              </p>
            </Link>
          );
        })}
      </div>
      )}
      {!loading &&
        visible.length === 0 &&
        (skills.length === 0 ? (
          <EmptyState titre="Aucun skill pour l'instant" action={{ libelle: 'Créer un skill', vers: '/skills/nouveau' }}>
            Un skill, c'est une compétence que tu veux pratiquer régulièrement : piano, espagnol, dessin… Chacun
            garde son historique, sa série et ses jalons.
          </EmptyState>
        ) : !showArchived && !tag && !search.trim() ? (
          <EmptyState>Tous tes skills sont en pause. Active « Voir les skills en pause » pour les retrouver.</EmptyState>
        ) : (
          <EmptyState>Aucun skill ne correspond à cette recherche.</EmptyState>
        ))}
    </div>
  );
}

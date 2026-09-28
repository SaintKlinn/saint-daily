import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { useMilestones } from '../hooks/useMilestones';
import { usePracticeEntries } from '../hooks/usePracticeEntries';
import { calculateBestStreak, calculateStreak, daysSinceLastPractice, streakJustExtended } from '../lib/streaks';
import { computeBadges, computeGoalProgress } from '../lib/motivation';
import { projetAffiche } from '../lib/projets';
import { MOOD_LABELS } from '../lib/seances';
import type { GenericLevel, GoalMetric, GoalPeriod } from '../lib/types';
import Introuvable from './Introuvable';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import Button, { buttonClassName } from '../components/Button';
import BoutonSuppression from '../components/BoutonSuppression';
import GoalProgress from '../components/GoalProgress';
import GoalSetter from '../components/GoalSetter';
import MilestoneChecklist from '../components/MilestoneChecklist';
import ChampSauvegarde from '../components/ChampSauvegarde';
import EditeurSeance from '../components/EditeurSeance';
import { ChevronLeftIcon, ChevronDownIcon, PlusIcon } from '../components/icons';

const LEVEL_LABELS: Record<GenericLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};


// Persiste tout le temps que l'app tourne, pas seulement le montage
// courant du composant — sans ça, revenir sur DetailSkill après avoir
// loggé une entrée via /entree/nouvelle (qui démonte cet écran) perdrait
// la référence et le pulse de récompense ne se déclencherait jamais.
const knownStreakBySkillId = new Map<string, number>();

// Le journal d'un skill s'affiche par pages : avec un an de pratique, la
// liste d'un bloc repoussait les Notes à des milliers de pixels plus bas.
const SEANCES_PAR_PAGE = 20;

export default function DetailSkill() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { engagements, deletedEngagements, loading, error: skillsError, updateEngagement, setArchived, softDelete } =
    useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const { liaisons, remplacerProjet, synchroniserColonne } = useLiaisonsProjet();
  // `projetAffiche` et non `skill.projectId` : la colonne n'est plus qu'une
  // copie de compatibilité, et elle peut contredire la liaison — après une
  // écriture de synchronisation en échec, ou dès qu'une version installée de
  // l'application, qui ne connaît que la colonne, a modifié cet engagement.
  // C'est d'autant plus vrai ici que c'est l'écran depuis lequel on change ce
  // projet : il doit montrer la même chose que la page du projet et que le
  // popover du calendrier, qui lisent tous deux la liaison.
  // `id` et non `skill.id` : `skill` n'est résolu que plus bas, et les deux
  // valent la même chose ici.
  const projetDuSkill = projetAffiche(engagements, liaisons, id ?? '');
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const { entries, loading: entriesLoading, error: entriesError, refresh: rechargerSeances } = usePracticeEntries(id ?? null);

  const skill = skills.find((s) => s.id === id);

  // Archiver, changer le niveau, cocher un jalon écrivaient en silence :
  // un échec réseau ne se voyait qu'en revenant à l'état précédent au
  // prochain refresh, sans un mot d'explication (audit ui-ux-pro-max).
  const [actionError, setActionError] = useState<string | null>(null);
  // La navigation vers /skills n'arrive qu'après l'aller-retour de
  // `softDelete` : sans cet état, le bouton reste armable pendant toute
  // l'attente réseau.
  const [deleting, setDeleting] = useState(false);
  // Pas de remise à zéro au changement de skill : AppShell remonte l'écran
  // à chaque changement d'adresse (clé de transition), donc l'état repart.
  const [nbSeances, setNbSeances] = useState(SEANCES_PAR_PAGE);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const seanceEnEdition = enEdition ? entries.find((e) => e.id === enEdition) : undefined;
  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const [streakPulse, setStreakPulse] = useState(false);

  useEffect(() => {
    // `entries` vaut `[]` (donc streak = 0) tant que le fetch n'a pas
    // résolu : comparer à ce stade prendrait le premier streak réel pour
    // une « progression » depuis 0 et déclencherait un faux pulse au
    // chargement de la page.
    // `knownStreakBySkillId` est indexée par skill.id : passer d'un skill à
    // un autre (même route `skills/:id`, seul le param change, sans
    // démontage) lit/écrit une entrée différente de la map, donc le streak
    // du skill précédent ne peut pas fuiter dans la comparaison du nouveau.
    if (entriesLoading || !skill) return;
    const previous = knownStreakBySkillId.get(skill.id) ?? null;
    knownStreakBySkillId.set(skill.id, streak);
    if (streakJustExtended(previous, streak)) {
      setStreakPulse(true);
      const timeoutId = setTimeout(() => setStreakPulse(false), 400);
      return () => clearTimeout(timeoutId);
    }
  }, [streak, entriesLoading, skill]);


  const daysSince = useMemo(() => daysSinceLastPractice(entries), [entries]);
  const totalHours = useMemo(
    () => Math.round((entries.reduce((sum, e) => sum + e.durationMinutes, 0) / 60) * 10) / 10,
    [entries]
  );
  const chartPoints = useMemo(() => buildCumulativeHoursPath(entries), [entries]);
  const bestStreak = useMemo(() => calculateBestStreak(entries), [entries]);
  const badges = useMemo(() => computeBadges(entries), [entries]);
  const goal = useMemo(
    () =>
      skill?.goalPeriod && skill.goalMetric && skill.goalTarget
        ? computeGoalProgress(entries, skill.goalPeriod, skill.goalMetric, skill.goalTarget)
        : null,
    [entries, skill]
  );

  async function handleToggleArchived() {
    if (!skill) return;
    setActionError(null);
    const { error } = await setArchived(skill.id, !skill.archivedAt);
    if (error) setActionError(error);
  }

  async function handleDelete() {
    if (!skill) return;
    setActionError(null);
    setDeleting(true);
    const { error } = await softDelete(skill.id, false);
    setDeleting(false);
    if (error) {
      setActionError(error);
      return;
    }
    navigate('/skills');
  }

  async function handleLevelChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateEngagement(skill.id, { genericLevel: e.target.value as GenericLevel });
    if (error) setActionError(error);
  }

  async function handleProjectChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!skill) return;
    setActionError(null);
    // `remplacerProjet` porte la boucle détacher-puis-rattacher, partagée
    // avec `Calendrier.handleChangeProject` — voir son commentaire dans
    // `useLiaisonsProjet.ts`.
    const { error, liaisons: fraiches } = await remplacerProjet(skill.id, e.target.value || null);
    const { error: syncError } = await synchroniserColonne(skill.id, fraiches ?? null, updateEngagement);
    if (error) {
      setActionError(error);
      return;
    }
    if (syncError) setActionError(syncError);
  }

  async function handleGoalChange(patch: {
    goalPeriod?: GoalPeriod | null;
    goalMetric?: GoalMetric | null;
    goalTarget?: number | null;
  }) {
    if (!skill) return;
    setActionError(null);
    const { error } = await updateEngagement(skill.id, patch);
    if (error) setActionError(error);
  }

  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    setActionError(null);
    const { error } = await toggleMilestone(milestoneId, completed);
    if (error) setActionError(error);
    return { error };
  }

  // Tant que les skills chargent, on ne peut pas conclure. Une fois le
  // chargement terminé, un id qui ne correspond à rien = deep link cassé
  // (skill supprimé, lien périmé) : c'est l'écran « introuvable » prévu
  // par la spec, pas un « Chargement… » qui ne finit jamais.
  // `skills.length === 0` en plus de `loading` : useEngagements repasse
  // loading à true à CHAQUE refresh, y compris celui qui suit une
  // modification (niveau, notes, archivage). Sans cette condition, tout
  // l'écran clignoterait sur « Chargement… » à chaque édition.
  if (loading && skills.length === 0) {
    return <EmptyState role="status">Chargement…</EmptyState>;
  }
  if (!skill) {
    // Le chargement a échoué : la liste est vide parce que la requête a
    // raté, pas parce que le skill n'existe plus. Ne pas afficher
    // « Introuvable », qui serait un diagnostic faux.
    if (skillsError) {
      return (
        <p role="alert" className="text-corps text-danger">
          {skillsError}
        </p>
      );
    }
    return <Introuvable sujet="skill" enCorbeille={deletedEngagements.some((e) => e.id === id)} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <Link
          to="/skills"
          className="flex w-fit items-center gap-2 font-sans text-secondaire text-muted transition-colors duration-150 hover:text-champagne"
        >
          <ChevronLeftIcon />
          Retour
        </Link>
      </motion.div>

      {/* Le skill est affiché, mais une requête annexe a pu échouer :
          le signaler plutôt que de montrer un graphe/journal vide. */}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
          {entriesError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-corps text-danger">
          {actionError}
        </p>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-heros text-champagne">{skill.name}</h1>
          {skill.tags.length > 0 && (
            <p className="mt-2 text-secondaire text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="relative flex items-center gap-2 border border-accent-mid px-4 py-2 font-data text-libelle uppercase tracking-[0.08em] text-accent-mid">
            {LEVEL_LABELS[skill.genericLevel]}
            <ChevronDownIcon />
            <select
              value={skill.genericLevel}
              onChange={handleLevelChange}
              aria-label="Niveau"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {(Object.keys(LEVEL_LABELS) as GenericLevel[]).map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          <label className="relative flex items-center gap-2 border border-ink-700 px-4 py-2 font-data text-libelle uppercase tracking-[0.08em] text-muted">
            {projetDuSkill ? (projects.find((p) => p.id === projetDuSkill)?.name ?? 'Projet') : 'Aucun projet'}
            <ChevronDownIcon />
            <select
              value={projetDuSkill ?? ''}
              onChange={handleProjectChange}
              aria-label="Projet"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Aucun projet</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Link to={`/pomodoro?skillId=${skill.id}`} className={buttonClassName('secondary', 'sm')}>
            Démarrer un pomodoro
          </Link>
          <Link to={`/focus/${skill.id}`} className={buttonClassName('secondary', 'sm')}>
            Focus
          </Link>
          <Button variant="secondary" size="sm" onClick={handleToggleArchived}>
            {skill.archivedAt ? 'Désarchiver' : 'Archiver'}
          </Button>
          <BoutonSuppression onConfirm={handleDelete} busy={deleting} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-8">
        {/* `self-start sticky top-6` : la colonne ne s'étire plus sur toute la
            hauteur du journal (plusieurs milliers de pixels avec un an de
            séances), où son contenu centré se retrouvait hors de vue, et elle
            reste visible pendant qu'on fait défiler. `<main>` est le
            conteneur qui défile ; `top-6` la garde à 24 px de son bord plutôt
            que collée contre. */}
        <div className="sticky top-6 flex w-[260px] min-w-[260px] flex-col items-center gap-3 self-start overflow-hidden border border-ink-700 bg-ink-900 p-6">
          <RayCorner variant={0} />
          <svg viewBox="0 0 220 130" className="relative w-full" role="img" aria-label="Heures cumulées de pratique dans le temps">
            <polyline points={chartPoints} fill="none" stroke="#E7B94E" strokeWidth="2" />
          </svg>
          <p className="relative font-data text-titre-ecran text-champagne">{totalHours}h</p>
          <p className="relative font-data text-libelle uppercase tracking-[0.1em] text-muted">cumulées</p>
          <p className="relative text-center text-corps text-muted">
            Série :{' '}
            <motion.span
              // `inline-block` : un élément inline nu ignore `transform`,
              // donc l'animation `scale` ci-dessous n'aurait aucun effet
              // sans ça.
              className="inline-block text-accent-bright"
              animate={streakPulse ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {streak} j
            </motion.span>{' '}
            · dernière pratique{' '}
            {daysSince === null ? 'jamais' : daysSince === 0 ? "aujourd'hui" : `il y a ${daysSince} j`}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section>
            <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Objectif</h2>
            {goal ? (
              <div className="flex flex-col gap-3">
                <GoalProgress progress={goal} />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => handleGoalChange({ goalPeriod: null, goalMetric: null, goalTarget: null })}
                >
                  Retirer l'objectif
                </Button>
              </div>
            ) : (
              <GoalSetter onSubmit={handleGoalChange} />
            )}
          </section>

          <section>
            <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Records</h2>
            <p className="mb-3 text-corps text-muted">
              Meilleure série : <span className="text-champagne">{bestStreak} j</span> · Série actuelle :{' '}
              <span className="text-champagne">{streak} j</span>
            </p>
            <ul className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li
                  key={badge.key}
                  className={`flex flex-col gap-1 border px-3 py-2 font-data text-libelle uppercase tracking-[0.08em] ${
                    badge.unlocked ? 'border-accent-bright text-accent-bright' : 'border-ink-700 text-muted'
                  }`}
                >
                  <span>
                    {/* L'état ne tenait qu'à la couleur et à un « · » que la
                        plupart des lecteurs d'écran ignorent. Le mot est
                        annoncé même en `sr-only` ; la couleur ne fait plus
                        que le souligner visuellement. */}
                    <span className="sr-only">{badge.unlocked ? 'Débloqué. ' : 'Verrouillé. '}</span>
                    {badge.label}
                  </span>
                  {/* La condition de déblocage n'était lisible qu'au survol
                      via `title`, donc inatteignable au clavier et absente
                      pour un lecteur d'écran. Elle est maintenant du texte
                      normal, toujours présent. */}
                  <span className="font-sans text-libelle normal-case tracking-normal text-muted">{badge.hint}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Jalons</h2>
            <MilestoneChecklist
              milestones={milestones}
              onToggle={handleToggleMilestone}
              onAdd={addMilestone}
              error={milestonesError}
              taille="normale"
            />
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-sans text-corps font-semibold text-champagne">Journal</h2>
              <Link to={`/entree/nouvelle?skillId=${skill.id}`} className="inline-flex items-center gap-1 text-corps text-accent-bright underline-offset-4 hover:underline focus:outline-none focus-visible:underline">
                <PlusIcon />
                Nouvelle entrée
              </Link>
            </div>
            <div className="flex flex-col">
              {entries.slice(0, nbSeances).map((entry) => (
                <div key={entry.id} className="flex gap-2 border-t border-ink-700 py-4 last:border-b">
                  <p className="w-20 font-data text-secondaire text-muted">
                    {new Date(entry.practicedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="w-16 font-data text-secondaire text-accent-bright">{entry.durationMinutes} min</p>
                  <p className="flex-1 font-serif text-corps italic text-champagne">
                    {entry.note}
                    {/* Discret et à côté de la note plutôt qu'en colonne
                        propre : l'humeur est optionnelle, une colonne vide la
                        plupart du temps aurait cassé l'alignement du journal
                        pour rien. */}
                    {entry.mood && (
                      <span className="ml-2 font-sans not-italic text-secondaire text-muted">· {MOOD_LABELS[entry.mood]}</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEnEdition(entry.id)}
                    aria-label={`Modifier la séance du ${new Date(entry.practicedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                    className="self-start font-data text-libelle text-muted underline-offset-4 hover:text-champagne hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  >
                    Modifier
                  </button>
                </div>
              ))}
            </div>
            {entries.length > nbSeances && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 self-center"
                onClick={() => setNbSeances((n) => n + SEANCES_PAR_PAGE)}
              >
                Afficher {Math.min(SEANCES_PAR_PAGE, entries.length - nbSeances)} séances de plus
                <span className="font-data text-libelle text-muted">
                  · {entries.length - nbSeances} restante{entries.length - nbSeances > 1 ? 's' : ''}
                </span>
              </Button>
            )}
            {seanceEnEdition && (
              <EditeurSeance
                seance={seanceEnEdition}
                nom={skill.name}
                onFermer={() => setEnEdition(null)}
                onChange={() => void rechargerSeances()}
              />
            )}
          </section>

          <section>
            <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Notes</h2>
            {/* Partie « second cerveau » de la spec : les réflexions libres
                sur un skill étaient saisies à la création et cherchables,
                mais jamais réaffichées ni modifiables ensuite. */}
            <ChampSauvegarde
              key={skill.id}
              valeur={skill.notes ?? ''}
              onSave={(notes) => updateEngagement(skill.id, { notes })}
              lignes={4}
              ariaLabel="Notes sur ce skill"
              placeholder="Aucune note. Écris ici tes réflexions sur ce skill…"
              confirmation="Notes enregistrées."
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function buildCumulativeHoursPath(entries: { practicedAt: string; durationMinutes: number }[]): string {
  if (entries.length === 0) return '';
  const sorted = [...entries].sort((a, b) => new Date(a.practicedAt).getTime() - new Date(b.practicedAt).getTime());
  const totalMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
  const maxHours = Math.max(totalMinutes / 60, 1);

  let cumulativeMinutes = 0;
  return sorted
    .map((entry, i) => {
      cumulativeMinutes += entry.durationMinutes;
      const x = sorted.length === 1 ? 220 : (i / (sorted.length - 1)) * 220;
      const y = 120 - (cumulativeMinutes / 60 / maxHours) * 110 - 5;
      return `${x},${y}`;
    })
    .join(' ');
}

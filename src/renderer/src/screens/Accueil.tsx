import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { useDailyReflections } from '../hooks/useDailyReflections';
import { calculateStreak, daysSinceLastPractice, lastPracticedEngagementId } from '../lib/streaks';
import { formatMinutes } from '../lib/retrospective';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import Button, { buttonClassName } from '../components/Button';
import { CheckIcon, PlusIcon } from '../components/icons';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/priority';
import { colors } from '../theme/colors';
import { shouldShowEveningPrompt, shouldShowMorningGreeting, shouldShowWeeklyReview, toLocalDateKey } from '../lib/rituels';
import { startOfDay, endOfDay } from '../lib/calendarLayout';
import { useAuth } from '../lib/auth';
import { salutation } from '../lib/identite';

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// En dehors du composant, au niveau du module — persiste pour toute la
// session de l'app, pas seulement le montage courant du composant (une
// navigation Accueil -> Skills -> Accueil ne doit pas re-notifier).
const notifiedSkillIds = new Set<string>();

export default function Accueil() {
  const { session } = useAuth();
  const salut = salutation(session?.user);
  const { engagements, error: skillsError, setArchived } = useEngagements();
  const skills = useMemo(() => engagements.filter((e) => !e.scheduledAt && !e.isProject), [engagements]);
  const { settings, updateSettings } = useSettings();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const activeSkills = useMemo(() => activeEngagements.filter((e) => !e.scheduledAt && !e.isProject), [activeEngagements]);
  const {
    entriesBySkill,
    loading: entriesLoading,
    error: entriesError,
    refresh: refreshEntries,
  } = useAllPracticeEntries(activeEngagements.map((e) => e.id));
  const { logEntry } = usePracticeEntries(null);
  // entriesBySkill couvre TOUS les engagements actifs (tâches et projets
  // compris, voir useAllPracticeEntries(activeEngagements...) plus haut) —
  // cocher une tâche y insère une entrée de 0 minute qui devient aussitôt
  // la plus récente. Sans ce filtrage, lastPracticedEngagementId renverrait
  // l'id de la tâche, activeSkills.find() ne le trouverait jamais (ce n'est
  // pas un skill), et le bouton « Reprendre » disparaîtrait purement et
  // simplement au lieu de continuer à pointer vers le dernier skill pratiqué.
  const skillEntriesBySkill = useMemo(() => {
    const activeSkillIds = new Set(activeSkills.map((s) => s.id));
    return Object.fromEntries(Object.entries(entriesBySkill).filter(([id]) => activeSkillIds.has(id)));
  }, [entriesBySkill, activeSkills]);
  const resumeSkill = useMemo(() => {
    const id = lastPracticedEngagementId(skillEntriesBySkill);
    return id ? (activeSkills.find((s) => s.id === id) ?? null) : null;
  }, [skillEntriesBySkill, activeSkills]);
  const [completeTaskError, setCompleteTaskError] = useState<string | null>(null);
  // Persistance best-effort côté `updateSettings` (voir handleDismissWeeklyReview) :
  // tant que la migration `weekly_review_dismissed_at` n'est pas appliquée, cet
  // appel échoue systématiquement. Sans cet état local, le bandeau ne
  // disparaîtrait jamais au clic — ni « Voir le bilan » ni « Plus tard » n'auraient
  // d'effet visible. Il ne survit pas à un rechargement ; une fois la migration en
  // place, la persistance côté serveur prend le relais entre les sessions.
  const [weeklyReviewDismissedThisMount, setWeeklyReviewDismissedThisMount] = useState(false);

  const { reflections, loading: reflectionsLoading, saveToday } = useDailyReflections();
  const [eveningText, setEveningText] = useState('');
  const [eveningError, setEveningError] = useState<string | null>(null);
  const [eveningSaving, setEveningSaving] = useState(false);
  // Masquage local immédiat, en plus de la persistance : avant que la
  // migration ne soit appliquée l'écriture échoue, et un geste de rejet
  // qui ne produit aucun effet visible est pire que pas de bandeau du
  // tout. Même correctif que celui appliqué au bandeau hebdomadaire.
  // Stocke la clé du jour où le rejet a eu lieu, pas un simple booléen :
  // avec l'horloge qui tourne ci-dessous, un montage qui traverse minuit
  // ne doit masquer le bandeau que pour le jour où « Merci » a été cliqué
  // — pas pour tous les matins suivants du même montage.
  const [morningDismissedDateThisMount, setMorningDismissedDateThisMount] = useState<string | null>(null);

  // L'app tourne dans le tray pendant des jours sans que l'Accueil se
  // re-rende naturellement : sans cette horloge, les gates horaires des
  // deux rituels (shouldShowMorningGreeting/shouldShowEveningPrompt) ne
  // seraient réévaluées qu'au prochain montage, et un utilisateur qui
  // laisse l'app ouverte sur l'Accueil à 14h ne verrait jamais le bandeau
  // du soir apparaître à 18h — le rituel n'aurait simplement jamais lieu.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tasks = useMemo(
    () =>
      activeEngagements
        .filter((e) => e.scheduledAt && (entriesBySkill[e.id] ?? []).length === 0 && !e.skippedAt)
        .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime()),
    [activeEngagements, entriesBySkill]
  );

  const tasksToday = useMemo(() => {
    const dayStart = startOfDay(new Date());
    const dayEnd = endOfDay(new Date());
    return tasks.filter((task) => {
      const scheduled = new Date(task.scheduledAt as string);
      return scheduled >= dayStart && scheduled < dayEnd;
    });
  }, [tasks]);

  const todayKey = toLocalDateKey(now);
  const hasReflectionToday = reflections.some((reflection) => reflection.date === todayKey);
  const showMorning =
    morningDismissedDateThisMount !== todayKey &&
    !!settings &&
    shouldShowMorningGreeting(settings.morningGreetingDismissedDate, now);
  // Tant que la lecture des réflexions n'a pas résolu, on ne sait pas
  // encore si aujourd'hui en a déjà une : afficher le bandeau puis le
  // faire disparaître un instant plus tard serait un flash visible sur
  // un jour qui a en fait déjà un bilan.
  const showEvening = !reflectionsLoading && shouldShowEveningPrompt(hasReflectionToday, now);

  async function handleDismissMorning() {
    setMorningDismissedDateThisMount(todayKey);
    await updateSettings({ morningGreetingDismissedDate: todayKey });
  }

  async function handleSaveEvening() {
    const text = eveningText.trim();
    if (!text) return;
    setEveningError(null);
    setEveningSaving(true);
    // La clé de jour vient de `now` — le même horodatage qui a décidé
    // d'afficher le bandeau — et non d'un nouveau `new Date()` pris à
    // l'instant du clic. Un bilan tapé à 23:58 et enregistré à 00:01 doit
    // rester classé sous la journée qui vient de finir, pas sous la
    // nouvelle qui commence : relire l'horloge ici est précisément ce qui
    // ouvrirait la fenêtre de perte décrite dans la revue.
    const { error } = await saveToday(text, todayKey);
    if (error) setEveningError(error);
    else setEveningText('');
    setEveningSaving(false);
  }

  async function handleCompleteTask(taskId: string) {
    const { error } = await logEntry({ engagementId: taskId, durationMinutes: 0, note: null });
    if (error) {
      setCompleteTaskError(error);
      return;
    }
    // Une tâche faite n'est jamais « pratiquée à nouveau » comme un skill —
    // sans l'archiver ici, elle resterait pour toujours dans
    // activeEngagements et la requête .in() de useAllPracticeEntries
    // grossirait d'un id à chaque tâche créée (voir revue finale de branche).
    const { error: archiveError } = await setArchived(taskId, true);
    if (archiveError) {
      setCompleteTaskError(archiveError);
      return;
    }
    setCompleteTaskError(null);
    await refreshEntries();
  }

  async function handleDismissWeeklyReview() {
    // Un échec ici n'a aucune conséquence grave : pas de message d'erreur
    // pour un geste aussi anodin que fermer une invitation. Mais le
    // bandeau doit tout de même disparaître visiblement à l'instant même —
    // d'où le flag local mis à jour de façon synchrone, indépendamment du
    // résultat de l'appel réseau.
    setWeeklyReviewDismissedThisMount(true);
    await updateSettings({ weeklyReviewDismissedAt: new Date().toISOString() });
  }

  const stats = useMemo(
    () =>
      activeSkills.map((skill) => {
        const entries = entriesBySkill[skill.id] ?? [];
        return {
          skill,
          streak: calculateStreak(entries),
          daysSince: daysSinceLastPractice(entries),
        };
      }),
    [activeSkills, entriesBySkill]
  );

  const dueSkills = useMemo(
    () => (settings ? stats.filter((s) => s.daysSince !== null && s.daysSince >= settings.reminderThresholdDays) : []),
    [stats, settings]
  );

  const minutesThisMonth = useMemo(() => {
    const now = new Date();
    return Object.values(entriesBySkill)
      .flat()
      .filter((entry) => {
        const d = new Date(entry.practicedAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, entry) => sum + entry.durationMinutes, 0);
  }, [entriesBySkill]);

  // Une notification par skill par session de l'app (pas de rappel qui
  // revient toutes les 5 minutes tant qu'on n'a pas relancé l'app).
  useEffect(() => {
    if (!settings?.notificationsEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') Notification.requestPermission();

    for (const { skill, daysSince } of stats) {
      if (daysSince !== null && daysSince >= settings.reminderThresholdDays && !notifiedSkillIds.has(skill.id)) {
        if (Notification.permission === 'granted') {
          notifiedSkillIds.add(skill.id);
          new Notification('Saint Daily', { body: `${skill.name} : pas pratiqué depuis ${daysSince} jours.` });
        }
      }
    }
  }, [stats, settings]);

  return (
    <div className="flex flex-col gap-8">
      {showMorning && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-accent-mid bg-ink-800 px-6 py-4">
          <div>
            <p className="text-corps text-champagne">Bonjour — voici ta journée</p>
            <p className="mt-1 text-secondaire text-muted">
              {tasksToday.length} tâche{tasksToday.length > 1 ? 's' : ''} planifiée
              {tasksToday.length > 1 ? 's' : ''} aujourd'hui · {dueSkills.length} rappel
              {dueSkills.length > 1 ? 's' : ''} dû{dueSkills.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleDismissMorning}>
            Merci
          </Button>
        </div>
      )}

      {showEvening && (
        <div className="flex flex-col gap-2 border border-ink-700 bg-ink-800 px-6 py-4">
          <div>
            <p className="text-corps text-champagne">Un mot sur ta journée ?</p>
            <p className="mt-1 text-secondaire text-muted">Une ligne suffit — ce n'est pas un journal.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={eveningText}
              onChange={(e) => setEveningText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !eveningSaving) void handleSaveEvening();
              }}
              placeholder="Journée dense mais satisfaisante."
              aria-label="Bilan de la journée"
              maxLength={280}
              className={`min-w-0 flex-1 border border-ink-700 bg-ink-900 px-3 py-2 text-secondaire text-champagne placeholder:text-muted ${FOCUS_RING}`}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEvening}
              disabled={eveningSaving || !eveningText.trim()}
            >
              {eveningSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {eveningError && (
            <p role="alert" className="text-corps text-danger">
              {eveningError}
            </p>
          )}
        </div>
      )}

      {settings && !weeklyReviewDismissedThisMount && shouldShowWeeklyReview(settings.weeklyReviewDismissedAt) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-accent-mid bg-ink-800 px-6 py-4">
          <div>
            <p className="text-corps text-champagne">Ta semaine est prête</p>
            <p className="mt-1 text-secondaire text-muted">
              Un coup d'œil sur ce que tu as pratiqué ces derniers jours.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/bilan" onClick={handleDismissWeeklyReview} className={buttonClassName('primary', 'sm')}>
              Voir le bilan
            </Link>
            <Button variant="secondary" size="sm" onClick={handleDismissWeeklyReview}>
              Plus tard
            </Button>
          </div>
        </div>
      )}

      {/* Le repli et l'écart de 24 px : sans eux la rangée n'avait aucune
          issue quand elle débordait, et comprimait le titre et les boutons
          jusqu'à les casser chacun en deux lignes. À la largeur minimale de
          la fenêtre (960 px, voir src/main/index.ts) l'en-tête réclame
          désormais plus que la colonne ne mesure, depuis que le titre est
          passé à 40 px et les boutons à 15 px. Replier met la grappe
          d'actions sous le titre, ce qui reste lisible ; 24 px parce que le
          titre et les actions sont deux groupes. */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex flex-wrap items-center justify-between gap-6"
      >
        <h1 className="font-serif text-heros text-champagne">
          {salut.avant}
          {salut.pseudo && (
            // Pas de couleur d'accent : à 40 px, le pseudonyme deviendrait
            // l'élément le plus criard de l'écran au détriment du contenu.
            // Le soulignement décalé ne se montre qu'au survol et au focus.
            <Link
              to="/reglages"
              className={`underline-offset-4 hover:underline focus-visible:underline ${FOCUS_RING}`}
            >
              {salut.pseudo}
            </Link>
          )}
          {salut.apres}
        </h1>
        <div className="flex items-center gap-3">
          {resumeSkill && (
            <Link
              to={`/pomodoro?skillId=${resumeSkill.id}`}
              className={buttonClassName('secondary', 'sm')}
              title={`Reprendre ${resumeSkill.name}`}
            >
              Reprendre {resumeSkill.name}
            </Link>
          )}
          <Link to="/pomodoro" className={buttonClassName('secondary')}>
            Démarrer un pomodoro
          </Link>
          <Link to="/entree/nouvelle" className={buttonClassName('primary')}>
            <PlusIcon />
            Nouvelle entrée
          </Link>
        </div>
      </motion.header>

      {skillsError && (
        <p role="alert" className="text-corps text-danger">
          {skillsError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
          {entriesError}
        </p>
      )}
      {completeTaskError && (
        <p role="alert" className="text-corps text-danger">
          {completeTaskError}
        </p>
      )}

      <motion.section
        initial="hidden"
        animate="visible"
        variants={listVariants}
        transition={{ delayChildren: 0.25 }}
        className="grid grid-cols-3 gap-6"
      >
        <StatCard label="Skills actifs" value={String(activeSkills.length)} rayVariant={2} />
        <StatCard
          label="Séries en cours"
          value={String(stats.filter((s) => s.streak > 0).length)}
          hero
          rayVariant={4}
        />
        <StatCard label="Pratiqué ce mois-ci" value={formatMinutes(minutesThisMonth)} rayVariant={0} />
      </motion.section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="font-sans text-corps font-semibold text-champagne"
        >
          Rappels dus
        </motion.h2>
        {activeSkills.length === 0 ? (
          <EmptyState>
            Aucun skill actif pour l'instant.{' '}
            <Link to="/skills/nouveau" className="text-accent-bright underline">
              Crée ton premier skill
            </Link>
            .
          </EmptyState>
        ) : dueSkills.length === 0 ? (
          <EmptyState>Rien de dû — tout est à jour.</EmptyState>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
            transition={{ delayChildren: 0.45 }}
            className="flex flex-col"
          >
            {dueSkills.map(({ skill, daysSince }, i) => (
              <motion.div
                key={skill.id}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex items-center gap-2 border border-ink-700 bg-ink-800 p-4 ${i > 0 ? 'border-t-0' : ''}`}
              >
                <ProgressRing
                  size={36}
                  radius={15}
                  filled={settings ? ringFillFromDaysSince(daysSince, settings.reminderThresholdDays) : 0}
                />
                <Link to={`/skills/${skill.id}`} className="flex-1 transition-opacity duration-150 hover:opacity-80">
                  <p className="font-serif text-titre text-champagne">{skill.name}</p>
                  {skill.tags.length > 0 && (
                    <p className="mt-1 text-secondaire text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </Link>
                <p className="font-data text-secondaire text-muted">pas pratiqué depuis {daysSince} j</p>
                <Link to={`/entree/nouvelle?skillId=${skill.id}`} className={buttonClassName('accent-outline', 'sm')}>
                  Logger
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="font-sans text-corps font-semibold text-champagne"
          >
            Tâches à faire
          </motion.h2>
          <Link to="/taches/nouvelle" className="text-corps text-accent-bright underline">
            + Nouvelle tâche
          </Link>
        </div>
        {entriesLoading ? (
          // `entriesBySkill` vaut encore `{}` tant que useAllPracticeEntries
          // n'a pas résolu : sans cette garde, toute tâche déjà faite
          // passerait le test « aucune entrée » et apparaîtrait un instant
          // avant de disparaître une fois les vraies données chargées.
          <EmptyState role="status">Chargement…</EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState>Aucune tâche planifiée.</EmptyState>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
            transition={{ delayChildren: 0.55 }}
            className="flex flex-col"
          >
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex items-center gap-2 border border-ink-700 bg-ink-800 p-4 ${i > 0 ? 'border-t-0' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleCompleteTask(task.id)}
                  aria-label={`Marquer "${task.name}" comme faite`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink-700 text-muted transition-colors duration-150 hover:border-accent-bright hover:text-accent-bright"
                >
                  <CheckIcon size={12} />
                </button>
                <div className="flex-1">
                  <p className="flex items-center gap-2 font-serif text-titre text-champagne">
                    {PRIORITY_COLORS[task.priority] && (
                      <span
                        role="img"
                        aria-label={`Priorité : ${PRIORITY_LABELS[task.priority]}`}
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: PRIORITY_COLORS[task.priority] as string }}
                      />
                    )}
                    {task.name}
                  </p>
                  {task.tags.length > 0 && (
                    <p className="mt-1 text-secondaire text-muted">{task.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </div>
                <p className="font-data text-secondaire text-muted">
                  {new Date(task.scheduledAt as string).toLocaleString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hero = false,
  rayVariant,
}: {
  label: string;
  value: string;
  hero?: boolean;
  rayVariant: 0 | 1 | 2 | 3 | 4;
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col gap-2 overflow-hidden border px-6 py-6 ${hero ? 'border-accent-bright/35' : 'border-ink-700'}`}
      style={{
        background: hero
          ? `linear-gradient(180deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 60%, ${colors.accent.bright}1f 100%)`
          : `linear-gradient(160deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 68%)`,
        boxShadow: `inset 0 1px 0 ${colors.accent.bright}14, 0 18px 34px -26px rgba(0, 0, 0, 0.8)`,
      }}
    >
      <RayCorner variant={rayVariant} />
      <p className="relative flex items-center gap-2 font-data text-libelle uppercase tracking-[0.1em] text-muted">
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{
            background: hero ? colors.accent.bright : colors.accent.mid,
            boxShadow: hero ? `0 0 6px ${colors.accent.bright}` : undefined,
          }}
        />
        {label}
      </p>
      <p
        className={`relative font-serif text-heros [font-variant-numeric:tabular-nums] ${hero ? 'text-accent-bright' : 'text-champagne'}`}
        style={hero ? { textShadow: `0 0 22px ${colors.accent.bright}4d` } : undefined}
      >
        {value}
      </p>
    </motion.div>
  );
}

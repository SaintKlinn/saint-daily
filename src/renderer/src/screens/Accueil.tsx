import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import { PlusIcon } from '../components/icons';
import { colors } from '../theme/colors';

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

// En dehors du composant, au niveau du module — persiste pour toute la
// session de l'app, pas seulement le montage courant du composant (une
// navigation Accueil -> Skills -> Accueil ne doit pas re-notifier).
const notifiedSkillIds = new Set<string>();

export default function Accueil() {
  const { skills, error: skillsError } = useSkills();
  const { settings } = useSettings();
  const activeSkills = useMemo(() => skills.filter((s) => !s.archivedAt), [skills]);
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(activeSkills.map((s) => s.id));

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
    <div className="flex flex-col gap-9">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex items-center justify-between"
      >
        <h1 className="font-serif text-[34px] leading-tight text-champagne">Bon retour.</h1>
        <div className="flex items-center gap-3">
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
        <p role="alert" className="text-sm text-danger">
          {skillsError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-sm text-danger">
          {entriesError}
        </p>
      )}

      <motion.section
        initial="hidden"
        animate="visible"
        variants={listVariants}
        transition={{ delayChildren: 0.25 }}
        className="grid grid-cols-3 gap-5"
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

      <section className="flex min-h-0 flex-1 flex-col gap-3.5">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="font-sans text-[15px] font-semibold text-champagne"
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
                className={`flex items-center gap-[18px] border border-ink-700 bg-ink-800 p-[18px] ${i > 0 ? 'border-t-0' : ''}`}
              >
                <ProgressRing
                  size={36}
                  radius={15}
                  filled={settings ? ringFillFromDaysSince(daysSince, settings.reminderThresholdDays) : 0}
                />
                <Link to={`/skills/${skill.id}`} className="flex-1 hover:opacity-80">
                  <p className="font-serif text-lg text-champagne">{skill.name}</p>
                  {skill.tags.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{skill.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                </Link>
                <p className="font-data text-[13px] text-muted">pas pratiqué depuis {daysSince} j</p>
                <Link to={`/entree/nouvelle?skillId=${skill.id}`} className={buttonClassName('accent-outline', 'sm')}>
                  Logger
                </Link>
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
      className={`relative flex flex-col gap-1.5 overflow-hidden border px-6 py-5 ${hero ? 'border-accent-bright/35' : 'border-ink-700'}`}
      style={{
        background: hero
          ? `linear-gradient(180deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 60%, ${colors.accent.bright}1f 100%)`
          : `linear-gradient(160deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 68%)`,
        boxShadow: `inset 0 1px 0 ${colors.accent.bright}14, 0 18px 34px -26px rgba(0, 0, 0, 0.8)`,
      }}
    >
      <RayCorner variant={rayVariant} />
      <p className="relative flex items-center gap-[7px] font-data text-[11px] uppercase tracking-[0.1em] text-muted">
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
        className={`relative font-serif text-[38px] [font-variant-numeric:tabular-nums] ${hero ? 'text-accent-bright' : 'text-champagne'}`}
        style={hero ? { textShadow: `0 0 22px ${colors.accent.bright}4d` } : undefined}
      >
        {value}
      </p>
    </motion.div>
  );
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}`;
}

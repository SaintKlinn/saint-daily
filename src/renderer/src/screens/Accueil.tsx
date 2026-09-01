import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';
import ProgressRing, { ringFillFromDaysSince } from '../components/ProgressRing';
import RayCorner from '../components/RayCorner';
import { PlusIcon } from '../components/icons';

// En dehors du composant, au niveau du module — persiste pour toute la
// session de l'app, pas seulement le montage courant du composant (une
// navigation Accueil -> Skills -> Accueil ne doit pas re-notifier).
const notifiedSkillIds = new Set<string>();

const GREETING_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

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

  const greeting = capitalize(GREETING_LABEL_FORMAT.format(new Date()));

  return (
    <div className="flex flex-col gap-9">
      <header className="flex items-end justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-[0.12em] text-muted">{greeting}</p>
          <h1 className="mt-1.5 font-serif text-[34px] leading-tight text-champagne">Bon retour.</h1>
        </div>
        <Link
          to="/entree/nouvelle"
          className="flex items-center gap-2 bg-accent-bright px-5 py-3 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover"
        >
          <PlusIcon />
          Nouvelle entrée
        </Link>
      </header>

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

      <section className="grid grid-cols-3 gap-5">
        <StatCard label="Skills actifs" value={String(activeSkills.length)} rayVariant={2} />
        <StatCard
          label="Séries en cours"
          value={String(stats.filter((s) => s.streak > 0).length)}
          accent
          rayVariant={4}
        />
        <StatCard label="Pratiqué ce mois-ci" value={formatMinutes(minutesThisMonth)} rayVariant={0} />
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-3.5">
        <h2 className="font-sans text-[15px] font-semibold text-champagne">Rappels dus</h2>
        {activeSkills.length === 0 ? (
          <p className="text-sm text-muted">
            Aucun skill actif pour l'instant.{' '}
            <Link to="/skills/nouveau" className="text-accent-bright underline">
              Crée ton premier skill
            </Link>
            .
          </p>
        ) : dueSkills.length === 0 ? (
          <p className="text-sm text-muted">Rien de dû — tout est à jour.</p>
        ) : (
          <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
            {dueSkills.map(({ skill, daysSince }, i) => (
              <div
                key={skill.id}
                className="flex items-center gap-[18px] bg-ink-800 p-[18px] motion-safe:animate-[fade-up_0.4s_ease-out_backwards]"
                style={{ animationDelay: `${i * 60}ms` }}
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
                <Link
                  to={`/entree/nouvelle?skillId=${skill.id}`}
                  className="border border-accent-bright px-4 py-2 font-sans text-[13px] font-semibold text-accent-bright hover:bg-accent-bright hover:text-ink-900"
                >
                  Logger
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
  rayVariant,
}: {
  label: string;
  value: string;
  accent?: boolean;
  rayVariant: 0 | 1 | 2 | 3 | 4;
}) {
  return (
    <div className="relative flex flex-col gap-1.5 overflow-hidden border border-ink-700 bg-ink-900 px-6 py-5">
      <RayCorner variant={rayVariant} />
      <p className="relative font-data text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={`relative font-serif text-[32px] ${accent ? 'text-accent-bright' : 'text-champagne'}`}>{value}</p>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}`;
}

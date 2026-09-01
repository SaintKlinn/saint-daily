import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSkills } from '../hooks/useSkills';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { calculateStreak, daysSinceLastPractice } from '../lib/streaks';

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
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-champagne">Accueil</h1>
        <Link to="/entree/nouvelle" className="bg-accent-bright px-4 py-2 text-sm font-semibold text-ink-900">
          + Nouvelle entrée
        </Link>
      </div>

      {/* Un échec de chargement doit être visible : sinon la page affiche
          des streaks à 0 et aucun rappel « dû », sans rien signaler. */}
      {skillsError && <p className="text-sm text-danger">{skillsError}</p>}
      {entriesError && <p className="text-sm text-danger">{entriesError}</p>}

      <ul className="grid grid-cols-2 gap-4">
        {stats.map(({ skill, streak, daysSince }) => {
          const due = settings ? daysSince !== null && daysSince >= settings.reminderThresholdDays : false;
          return (
            <li key={skill.id}>
              <Link
                to={`/skills/${skill.id}`}
                className={`block border p-4 ${due ? 'border-accent-bright' : 'border-ink-700'} bg-ink-800`}
              >
                <p className="font-serif text-lg text-champagne">{skill.name}</p>
                <p className="mt-1 text-sm text-muted">Streak : {streak} j</p>
                {due && <p className="mt-1 text-sm text-accent-bright">Pas pratiqué depuis {daysSince} j</p>}
              </Link>
            </li>
          );
        })}
      </ul>

      {activeSkills.length === 0 && (
        <p className="text-sm text-muted">
          Aucun skill actif pour l'instant.{' '}
          <Link to="/skills/nouveau" className="text-accent-bright underline">
            Crée ton premier skill
          </Link>
          .
        </p>
      )}
    </div>
  );
}

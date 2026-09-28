import { startOfMonth, startOfWeek } from './calendarLayout';
import { calculateBestStreak } from './streaks';
import { AUCUN_REPOS, type JoursRepos } from './joursRepos';
import { formatMinutes } from './retrospective';
import type { GoalMetric, GoalPeriod } from './types';

export interface MotivationEntryLike {
  practicedAt: string;
  durationMinutes: number;
}

export interface Badge {
  key: string;
  label: string;
  hint: string;
  unlocked: boolean;
}

const TEN_HOURS_IN_MINUTES = 600;

/**
 * Badges entièrement **dérivés** de l'historique : rien n'est stocké, donc
 * rien ne peut se désynchroniser de la réalité, et un import de données
 * anciennes débloque rétroactivement ce qui est mérité.
 */
export function computeBadges(entries: MotivationEntryLike[], repos: JoursRepos = AUCUN_REPOS): Badge[] {
  const sessions = entries.length;
  const minutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const bestStreak = calculateBestStreak(entries, repos);
  return [
    {
      key: 'streak-7',
      label: "7 jours d'affilée",
      hint: 'Sept jours consécutifs avec au moins une séance',
      unlocked: bestStreak >= 7,
    },
    {
      key: 'streak-30',
      label: '30 jours d\'affilée',
      hint: 'Trente jours consécutifs avec au moins une séance',
      unlocked: bestStreak >= 30,
    },
    {
      key: 'hours-10',
      label: '10 heures cumulées',
      hint: 'Dix heures de pratique au total',
      unlocked: minutes >= TEN_HOURS_IN_MINUTES,
    },
    {
      key: 'sessions-100',
      label: '100 séances',
      hint: 'Cent séances enregistrées',
      unlocked: sessions >= 100,
    },
  ];
}

export interface GoalProgress {
  current: number;
  target: number;
  ratio: number;
  label: string;
}

export function computeGoalProgress(
  entries: MotivationEntryLike[],
  period: GoalPeriod,
  metric: GoalMetric,
  target: number,
  now: Date = new Date()
): GoalProgress {
  const windowStart = period === 'mensuel' ? startOfMonth(now) : startOfWeek(now);
  const inWindow = entries.filter((entry) => new Date(entry.practicedAt) >= windowStart);
  const current =
    metric === 'heures'
      ? inWindow.reduce((sum, entry) => sum + entry.durationMinutes, 0) / 60
      : inWindow.length;
  // Affiché au format de durée du reste de l'app (« 2h 58 », pas
  // « 2.9 h ») — l'objectif était le seul endroit à écrire une durée en
  // heures décimales. Les minutes sont tronquées, jamais arrondies : 178 min
  // s'affichent « 2h 58 », pas « 3h », qui dirait l'objectif atteint alors
  // que le test `current >= target` (sur la valeur brute, ailleurs) dirait
  // le contraire. Le chiffre affiché ne dépasse jamais la progression réelle.
  const minutesFaites = Math.floor(current * 60);
  return {
    current,
    target,
    // Plafonné à 1 : la barre ne déborde pas quand l'objectif est dépassé,
    // le chiffre affiché à côté dit déjà de combien.
    ratio: target > 0 ? Math.min(1, current / target) : 0,
    label:
      metric === 'heures'
        ? `${formatMinutes(minutesFaites)} sur ${formatMinutes(Math.round(target * 60))}`
        : `${current} séance${current > 1 ? 's' : ''} sur ${target}`,
  };
}

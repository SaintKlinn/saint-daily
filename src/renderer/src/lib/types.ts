export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export type Priority = 'aucune' | 'basse' | 'moyenne' | 'elevee';
export type RecurrenceType = 'aucune' | 'quotidien' | 'hebdomadaire' | 'tous_les_n_jours';
export type GoalPeriod = 'hebdomadaire' | 'mensuel';
export type GoalMetric = 'heures' | 'seances';
export type Mood = 'difficile' | 'moyen' | 'correct' | 'bien' | 'excellent';

export interface Engagement {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  deletedAt: string | null;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  priority: Priority;
  recurrenceSeriesId: string | null;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
  isProject: boolean;
  projectId: string | null;
  goalPeriod: GoalPeriod | null;
  goalMetric: GoalMetric | null;
  goalTarget: number | null;
  createdAt: string;
}

export interface EngagementMilestone {
  id: string;
  engagementId: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface PracticeEntry {
  id: string;
  engagementId: string;
  userId: string;
  durationMinutes: number;
  note: string | null;
  mood: Mood | null;
  practicedAt: string;
  createdAt: string;
}

export interface SkillAppSettings {
  userId: string;
  reminderThresholdDays: number;
  reminderLeadMinutes: number;
  notificationsEnabled: boolean;
  autoLaunchEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroCyclesBeforeLongBreak: number;
  pomodoroAutoAdvance: boolean;
  showPracticeInCalendar: boolean;
  weeklyReviewDismissedAt: string | null;
}

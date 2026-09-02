export type GenericLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';

export interface Skill {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: GenericLevel;
  archivedAt: string | null;
  createdAt: string;
}

export interface SkillMilestone {
  id: string;
  skillId: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface PracticeEntry {
  id: string;
  skillId: string;
  userId: string;
  durationMinutes: number;
  note: string | null;
  practicedAt: string;
  createdAt: string;
}

export interface SkillAppSettings {
  userId: string;
  reminderThresholdDays: number;
  notificationsEnabled: boolean;
  autoLaunchEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroCyclesBeforeLongBreak: number;
  pomodoroAutoAdvance: boolean;
}

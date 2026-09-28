import type { PomodoroDurations, PomodoroPhase, PomodoroSession, PomodoroStatus } from './pomodoroLogic';

// Sauvegarde locale de la session Pomodoro en cours, pour qu'une fermeture
// de l'app (plantage, redémarrage de mise à jour, extinction) ne perde ni le
// minuteur, ni les checkpoints déjà insérés en base : sans elle, ces
// derniers restaient pour toujours dans le journal en entrées « Pomodoro —
// cycle 2/4 », jamais consolidées.
//
// `localStorage` et non une table : c'est l'état d'un minuteur qui tourne
// sur CETTE machine, pas une donnée du compte. Même garde que
// preferencesAffichage.ts — toute lecture et toute écriture peuvent lever.

export const CLE_SESSION_POMODORO = 'saint-daily.pomodoro-session';

export interface StockageSession {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

export interface SessionPersistee {
  // Une session n'est reprise que pour le compte qui l'a lancée : un autre
  // compte sur la même machine ne doit ni la voir, ni la solder.
  userId: string;
  session: PomodoroSession;
  durations: PomodoroDurations;
  note: string;
  // Dernier instant où l'app était vivante avec cette session — voir
  // `restoreSession` : c'est là que le minuteur est figé à la reprise.
  lastSeenAt: number;
}

function stockageParDefaut(): StockageSession | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const PHASES: PomodoroPhase[] = ['work', 'shortBreak', 'longBreak'];
const STATUTS: PomodoroStatus[] = ['running', 'paused', 'awaitingAdvance'];

const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Validation champ par champ : une valeur corrompue ou d'une ancienne forme
// relancerait sinon un minuteur à `phaseEndsAt: NaN`, ou des `in('id', …)`
// Supabase sur autre chose que des identifiants.
function estSession(v: unknown): v is PomodoroSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.skillId === 'string' &&
    typeof s.skillName === 'string' &&
    PHASES.includes(s.phase as PomodoroPhase) &&
    STATUTS.includes(s.status as PomodoroStatus) &&
    estNombre(s.cycleIndex) &&
    estNombre(s.phaseEndsAt) &&
    (s.remainingMsAtPause === null || estNombre(s.remainingMsAtPause)) &&
    Array.isArray(s.loggedEntryIds) &&
    s.loggedEntryIds.every((id) => typeof id === 'string') &&
    estNombre(s.extensionMs)
  );
}

function estDurees(v: unknown): v is PomodoroDurations {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    estNombre(d.workMinutes) &&
    estNombre(d.shortBreakMinutes) &&
    estNombre(d.longBreakMinutes) &&
    estNombre(d.cyclesBeforeLongBreak)
  );
}

/** La session sauvegardée pour `userId`, ou null : rien de sauvegardé,
 *  valeur illisible, autre compte, stockage refusé. */
export function lireSessionPersistee(
  userId: string | undefined,
  stockage: StockageSession | null = stockageParDefaut()
): SessionPersistee | null {
  if (!userId) return null;
  try {
    const brut = stockage?.getItem(CLE_SESSION_POMODORO);
    if (!brut) return null;
    const v = JSON.parse(brut) as Record<string, unknown>;
    if (
      v?.userId !== userId ||
      !estSession(v.session) ||
      !estDurees(v.durations) ||
      typeof v.note !== 'string' ||
      !estNombre(v.lastSeenAt)
    ) {
      return null;
    }
    return v as unknown as SessionPersistee;
  } catch {
    return null;
  }
}

export function ecrireSessionPersistee(
  donnees: SessionPersistee,
  stockage: StockageSession | null = stockageParDefaut()
): void {
  try {
    stockage?.setItem(CLE_SESSION_POMODORO, JSON.stringify(donnees));
  } catch {
    // Sans persistance, la session tourne normalement ; seule la reprise
    // après fermeture est perdue. Rien à remonter à l'utilisateur.
  }
}

export function effacerSessionPersistee(stockage: StockageSession | null = stockageParDefaut()): void {
  try {
    stockage?.removeItem(CLE_SESSION_POMODORO);
  } catch {
    // Même repli que l'écriture.
  }
}

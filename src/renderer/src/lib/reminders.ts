export interface ReminderEngagement {
  id: string;
  name: string;
  scheduledAt: string | null;
  archivedAt: string | null;
}

export type ReminderKind = 'lead' | 'start';

export interface DueReminder {
  engagementId: string;
  name: string;
  kind: ReminderKind;
  key: string;
  /**
   * Déclencheur dépassé depuis trop longtemps pour être montré. Il est
   * quand même renvoyé, pour que l'appelant le marque comme vu : sans ça
   * il reviendrait à chaque vérification suivante.
   */
  stale: boolean;
}

/**
 * Au-delà de ce retard, un rappel n'est plus affiché. Au réveil d'une
 * machine restée en veille, afficher d'un coup tous les rappels des
 * dernières heures est plus nuisible qu'utile — et un « dans 10 min »
 * arrivant deux heures trop tard est simplement faux.
 */
export const REMINDER_TOLERANCE_MS = 2 * 60_000;

export function reminderKey(engagementId: string, kind: ReminderKind): string {
  return `${engagementId}:${kind}`;
}

/**
 * Déclencheurs dus à l'instant `now` et pas encore traités.
 *
 * Un engagement est éligible s'il est planifié, non archivé et n'a encore
 * aucune entrée de pratique — exactement le critère qu'utilise déjà la
 * liste « Tâches à faire » de l'Accueil pour décider qu'une tâche reste à
 * faire. Une tâche cochée ne se rappelle donc plus.
 */
export function dueReminders(
  engagements: ReminderEngagement[],
  entryCountByEngagement: Record<string, number>,
  now: Date,
  leadMinutes: number,
  fired: ReadonlySet<string>
): DueReminder[] {
  const nowMs = now.getTime();
  const due: DueReminder[] = [];

  for (const engagement of engagements) {
    if (!engagement.scheduledAt) continue;
    if (engagement.archivedAt) continue;
    if ((entryCountByEngagement[engagement.id] ?? 0) > 0) continue;

    const startMs = new Date(engagement.scheduledAt).getTime();
    if (!Number.isFinite(startMs)) continue;

    const triggers: { kind: ReminderKind; at: number }[] = [{ kind: 'start', at: startMs }];
    // À délai nul, le rappel d'anticipation tomberait à la même seconde
    // que celui de départ : deux notifications identiques d'affilée.
    if (leadMinutes > 0) {
      triggers.unshift({ kind: 'lead', at: startMs - leadMinutes * 60_000 });
    }

    for (const trigger of triggers) {
      const key = reminderKey(engagement.id, trigger.kind);
      if (fired.has(key)) continue;
      if (trigger.at > nowMs) continue;
      due.push({
        engagementId: engagement.id,
        name: engagement.name,
        kind: trigger.kind,
        key,
        stale: nowMs - trigger.at > REMINDER_TOLERANCE_MS,
      });
    }
  }

  return due;
}

export function reminderMessage(reminder: DueReminder, leadMinutes: number): string {
  return reminder.kind === 'lead'
    ? `${reminder.name} dans ${leadMinutes} min`
    : `${reminder.name} commence maintenant`;
}

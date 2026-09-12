import { useEffect, useRef } from 'react';
import { dueReminders, reminderMessage, type ReminderEngagement } from '../lib/reminders';

// Vingt secondes : assez fin pour qu'un rappel parte bien dans sa fenêtre
// de tolérance de deux minutes, assez espacé pour rester négligeable.
const CHECK_INTERVAL_MS = 20_000;

/**
 * Surveille les tâches planifiées et pousse une notification native au
 * moment voulu. Monté une seule fois, dans `AppShell`.
 *
 * La fenêtre principale tourne avec `backgroundThrottling: false` (voir
 * `src/main/index.ts`), donc cet intervalle continue de tourner même
 * fenêtre masquée dans le tray — c'est précisément le cas d'usage.
 */
export function useEngagementReminders(
  engagements: ReminderEngagement[],
  entryCountByEngagement: Record<string, number>,
  notificationsEnabled: boolean,
  leadMinutes: number
): void {
  const firedRef = useRef<Set<string>>(new Set());
  // Les données changent à chaque rafraîchissement des engagements. Les
  // lire dans une ref plutôt qu'en dépendance de l'effet évite de
  // reconstruire l'intervalle à chaque re-render, ce qui repousserait
  // indéfiniment la prochaine vérification.
  const dataRef = useRef({ engagements, entryCountByEngagement, leadMinutes });
  dataRef.current = { engagements, entryCountByEngagement, leadMinutes };

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();

    const interval = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      const { engagements: list, entryCountByEngagement: counts, leadMinutes: lead } = dataRef.current;
      for (const reminder of dueReminders(list, counts, new Date(), lead, firedRef.current)) {
        // Marqué comme vu qu'il soit affiché ou périmé : sinon un rappel
        // manqué reviendrait à chaque vérification jusqu'à la fin des
        // temps.
        firedRef.current.add(reminder.key);
        if (reminder.stale) continue;
        const notification = new Notification('Saint Daily', { body: reminderMessage(reminder, lead) });
        notification.onclick = () => window.api?.focusWindow?.();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [notificationsEnabled]);
}

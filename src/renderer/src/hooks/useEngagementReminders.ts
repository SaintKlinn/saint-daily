import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { getSupabaseClient } from '../lib/supabase';
import { dueReminders, reminderMessage, REMINDER_TOLERANCE_MS, type ReminderEngagement } from '../lib/reminders';

// Chaque tick coûte désormais des lectures réseau plutôt qu'un simple
// calcul local : 60 s reste largement assez fin pour une fonctionnalité
// qui ne joue que quelques fois par jour, et combiné à la tolérance de
// trois minutes de `lib/reminders.ts`, garantit qu'aucun déclencheur ne
// passe entre deux vérifications.
const CHECK_INTERVAL_MS = 60_000;

interface EngagementReminderRow {
  id: string;
  name: string;
  scheduled_at: string | null;
  archived_at: string | null;
  // Optionnel comme dans `useEngagements` : la migration qui ajoute cette
  // colonne n'est pas encore passée sur la base live, donc `select('*')`
  // peut renvoyer la ligne sans ce champ plutôt que d'échouer.
  deleted_at?: string | null;
}

interface SettingsReminderRow {
  notifications_enabled: boolean;
  // Optionnel : la migration qui ajoute cette colonne est appliquée à la
  // base live après le déploiement du code (voir `useSettings`). Tant
  // qu'elle n'est pas passée, `select('*')` renvoie simplement une ligne
  // sans ce champ plutôt que d'échouer.
  reminder_lead_minutes: number | undefined;
}

/**
 * Surveille les tâches planifiées et pousse une notification native au
 * moment voulu. Monté une seule fois, dans `AppProvidersLayout` (App.tsx) —
 * pas dans `AppShell`, pour survivre à l'entrée et à la sortie du mode
 * focus (route soeur d'AppShell, en dehors du rail de navigation) sans que
 * le Set de déduplication ci-dessous ne reparte de zéro à chaque passage.
 *
 * Ne reçoit rien en argument : `useEngagements` et `useAllPracticeEntries`
 * n'ont ni store partagé ni realtime, chaque appelant garde un état privé
 * qui n'est rafraîchi que par ses propres mutations. Ce hook est monté une
 * seule fois pour une session qui tourne des jours dans le tray et
 * n'effectue lui-même aucune mutation — des props figées à ce moment-là
 * auraient deux conséquences : une tâche créée après le lancement ne
 * rappellerait jamais, et une tâche cochée depuis l'Accueil continuerait de
 * déclencher ses rappels (fausse notification). Ce hook relit donc
 * lui-même Supabase à chaque tick, ce qui a aussi pour effet qu'un
 * changement du réglage « Notifications natives » prend effet dans la
 * minute plutôt qu'au prochain redémarrage.
 *
 * La fenêtre principale tourne avec `backgroundThrottling: false` (voir
 * `src/main/index.ts`), donc cet intervalle continue de tourner même
 * fenêtre masquée dans le tray — c'est précisément le cas d'usage.
 */
export function useEngagementReminders(): void {
  const firedRef = useRef<Set<string>>(new Set());
  const { session } = useAuth();
  // Lue dans une ref plutôt qu'en dépendance de l'effet : la session peut
  // changer (connexion/déconnexion) sans reconstruire l'intervalle, ce qui
  // repousserait indéfiniment la prochaine vérification.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();

    async function checkOnce() {
      // 1. Ni permission ni Notification : on ne touche pas au réseau.
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const currentSession = sessionRef.current;
      if (!currentSession) return;

      const supabase = getSupabaseClient();

      // 2. Réglages : même table et même forme de requête que
      // `useSettings` (select('*') plutôt que des colonnes nommées, pour
      // rester silencieux si la migration n'est pas encore passée).
      const { data: settingsRow } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();
      const settings = settingsRow as SettingsReminderRow | null;
      if (!settings || !settings.notifications_enabled) return;
      const leadMinutes = settings.reminder_lead_minutes ?? 10;

      // 3. Fenêtre étroite : seuls les engagements dont un déclencheur
      // peut plausiblement tomber maintenant (normalement zéro à deux
      // lignes), jamais tout le catalogue.
      const now = new Date();
      const nowMs = now.getTime();
      const windowStart = new Date(nowMs - REMINDER_TOLERANCE_MS).toISOString();
      const windowEnd = new Date(nowMs + leadMinutes * 60_000 + REMINDER_TOLERANCE_MS).toISOString();
      const { data: engagementRows } = await supabase
        .from('engagement')
        .select('*')
        .is('archived_at', null)
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', windowEnd);
      if (!engagementRows || engagementRows.length === 0) return;

      // Filtre côté client, pas dans la requête : nommer `deleted_at` dans
      // un `select()` ou un `.is()` ferait échouer la requête tant que la
      // migration de la corbeille n'est pas passée sur la base live (même
      // limite que `useEngagements.refresh`). Un engagement mis à la
      // corbeille ne doit plus jamais notifier, même s'il reste échu dans
      // la fenêtre ci-dessus.
      const liveRows = (engagementRows as EngagementReminderRow[]).filter((row) => !row.deleted_at);
      if (liveRows.length === 0) return;

      // 4. Seulement les entrées de ces engagements-là, pour savoir
      // lesquels sont déjà faits.
      const engagementIds = liveRows.map((row) => row.id);
      const { data: entryRows } = await supabase
        .from('practice_entry')
        .select('engagement_id')
        .in('engagement_id', engagementIds);

      const entryCountByEngagement: Record<string, number> = {};
      for (const row of (entryRows as { engagement_id: string }[] | null) ?? []) {
        entryCountByEngagement[row.engagement_id] = (entryCountByEngagement[row.engagement_id] ?? 0) + 1;
      }

      const engagements: ReminderEngagement[] = liveRows.map((row) => ({
        id: row.id,
        name: row.name,
        scheduledAt: row.scheduled_at,
        archivedAt: row.archived_at,
      }));

      // 5. Même clé de suivi, mêmes règles pures.
      for (const reminder of dueReminders(engagements, entryCountByEngagement, now, leadMinutes, firedRef.current)) {
        // Marqué comme vu qu'il soit affiché ou périmé : sinon un rappel
        // manqué reviendrait à chaque vérification jusqu'à la fin des
        // temps.
        firedRef.current.add(reminder.key);
        if (reminder.stale) continue;
        const notification = new Notification('Saint Daily', { body: reminderMessage(reminder, leadMinutes) });
        notification.onclick = () => window.api?.focusWindow?.();
      }
    }

    const interval = setInterval(() => {
      void checkOnce();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}

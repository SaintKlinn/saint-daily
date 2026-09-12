import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { endOfDay, startOfDay } from '../lib/calendarLayout';

// Même cadence que les deux autres sondages de l'app. Le widget doit
// refléter une tâche cochée il y a une minute, mais pas à la seconde près.
const REFRESH_INTERVAL_MS = 60_000;

interface AgendaRow {
  id: string;
  name: string;
  scheduled_at: string;
  deleted_at?: string | null;
}

/**
 * Pousse l'agenda du jour vers la fenêtre widget. Monté une seule fois,
 * dans la fenêtre principale — le widget ne parle jamais à Supabase.
 */
export function useAgendaWidgetFeed(): void {
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const supabase = getSupabaseClient();
      const now = new Date();
      // `select('*')` puis tri côté client : nommer `deleted_at` ferait
      // échouer la requête tant que la migration de la corbeille n'est pas
      // appliquée à la base live.
      const { data, error } = await supabase
        .from('engagement')
        .select('*')
        .is('archived_at', null)
        .gte('scheduled_at', startOfDay(now).toISOString())
        // Borne stricte : endOfDay() vaut minuit du jour SUIVANT (voir
        // calendarLayout.ts), donc un `.lte()` inclurait une tâche planifiée
        // pile à 00:00 le lendemain — elle s'afficherait alors sur les deux
        // jours.
        .lt('scheduled_at', endOfDay(now).toISOString())
        .order('scheduled_at', { ascending: true });
      if (cancelled || error) return;
      const rows = ((data ?? []) as AgendaRow[]).filter((row) => !row.deleted_at);
      if (rows.length === 0) {
        window.api?.agenda?.reportState?.([]);
        return;
      }
      // « Fait » = possède au moins une entrée de pratique, la définition
      // qu'utilise déjà tout le reste de l'app.
      const { data: entries, error: entriesError } = await supabase
        .from('practice_entry')
        .select('engagement_id')
        .in('engagement_id', rows.map((row) => row.id));
      // Sans ce garde-fou (même raison que useTrayNextEngagement), un échec
      // silencieux de cette requête afficherait toutes les tâches du jour
      // comme non faites, y compris celles déjà cochées.
      if (cancelled || entriesError) return;
      const done = new Set(((entries ?? []) as { engagement_id: string }[]).map((e) => e.engagement_id));
      window.api?.agenda?.reportState?.(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          scheduledAt: row.scheduled_at,
          done: done.has(row.id),
        }))
      );
    }

    void refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      // Ce hook ne tourne que dans la fenêtre principale, authentifiée
      // (voir doc plus haut) — son démontage (déconnexion) doit donc
      // effacer l'agenda déjà relayé au widget, sinon celui-ci continue
      // d'afficher les tâches du jour par-dessus l'écran de connexion.
      // Même précaution que PomodoroProvider avec reportState(null) pour
      // l'overlay Pomodoro.
      window.api?.agenda?.reportState?.([]);
    };
  }, []);
}

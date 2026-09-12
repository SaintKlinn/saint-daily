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
        .lte('scheduled_at', endOfDay(now).toISOString())
        .order('scheduled_at', { ascending: true });
      if (cancelled || error) return;
      const rows = ((data ?? []) as AgendaRow[]).filter((row) => !row.deleted_at);
      if (rows.length === 0) {
        window.api?.agenda?.reportState?.([]);
        return;
      }
      // « Fait » = possède au moins une entrée de pratique, la définition
      // qu'utilise déjà tout le reste de l'app.
      const { data: entries } = await supabase
        .from('practice_entry')
        .select('engagement_id')
        .in('engagement_id', rows.map((row) => row.id));
      if (cancelled) return;
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
    };
  }, []);
}

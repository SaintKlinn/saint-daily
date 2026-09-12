import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';

// Une requête par minute, sur une seule ligne : l'infobulle n'a pas besoin
// d'être à la seconde près, mais elle doit refléter une tâche créée il y a
// deux minutes. Elle interroge donc elle-même plutôt que de consommer un
// état monté au démarrage et jamais rafraîchi — l'app tourne des jours
// dans le tray.
const REFRESH_INTERVAL_MS = 60_000;

interface NextEngagementRow {
  name: string;
  scheduled_at: string;
  deleted_at?: string | null;
}

function formatLabel(row: NextEngagementRow): string {
  const at = new Date(row.scheduled_at);
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate();
  const day = sameDay ? "aujourd'hui" : at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `Prochain : ${row.name} — ${day} à ${time}`;
}

/**
 * Tient à jour l'infobulle de l'icône du tray avec le prochain engagement
 * planifié. Monté une seule fois, dans `AppProvidersLayout` (App.tsx) — pas
 * dans `AppShell`, pour survivre à l'entrée et à la sortie du mode focus.
 */
export function useTrayNextEngagement(): void {
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data, error } = await getSupabaseClient()
        .from('engagement')
        // `select('*')` et tri des supprimés côté client : nommer
        // `deleted_at` ferait échouer la requête tant que la migration de
        // la corbeille n'est pas appliquée à la base live.
        .select('*')
        .is('archived_at', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5);
      if (cancelled || error) return;
      const next = ((data ?? []) as NextEngagementRow[]).find((row) => !row.deleted_at);
      window.api?.setTrayNextEngagement?.(next ? formatLabel(next) : null);
    }

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}

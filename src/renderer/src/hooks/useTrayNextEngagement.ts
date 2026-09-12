import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';

// Une requête par minute, sur une seule ligne : l'infobulle n'a pas besoin
// d'être à la seconde près, mais elle doit refléter une tâche créée il y a
// deux minutes. Elle interroge donc elle-même plutôt que de consommer un
// état monté au démarrage et jamais rafraîchi — l'app tourne des jours
// dans le tray.
const REFRESH_INTERVAL_MS = 60_000;

// Nombre de lignes à venir considérées à chaque rafraîchissement. Deux
// filtres s'appliquent ensuite côté client (voir refresh) : `deleted_at`
// (colonne pas encore migrée sur la base live, donc filtrée ici plutôt que
// nommée dans la requête) et « déjà pratiqué » (practice_entry existante).
// Un `.limit(5)` combiné à ces filtres pouvait laisser l'infobulle vide dès
// que cinq engagements à venir ou plus tombaient dans un seul de ces deux
// cas alors que d'autres, plus loin dans le tri, restaient valables — d'où
// une marge large plutôt qu'un nombre pile ajusté au cas courant.
const CANDIDATE_LIMIT = 50;

interface NextEngagementRow {
  id: string;
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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('engagement')
        // `select('*')` et tri des supprimés côté client : nommer
        // `deleted_at` ferait échouer la requête tant que la migration de
        // la corbeille n'est pas appliquée à la base live.
        .select('*')
        .is('archived_at', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(CANDIDATE_LIMIT);
      if (cancelled || error) return;

      const liveRows = ((data ?? []) as NextEngagementRow[]).filter((row) => !row.deleted_at);
      if (liveRows.length === 0) {
        window.api?.setTrayNextEngagement?.(null);
        return;
      }

      // « Fait » a le même sens partout ailleurs dans l'app (voir
      // lib/reminders.ts et Accueil.tsx) : au moins une entrée de pratique,
      // pas un champ de statut. Sans ce filtre, une tâche cochée ce matin
      // resterait annoncée comme prochaine toute la journée.
      const { data: entryRows, error: entriesError } = await supabase
        .from('practice_entry')
        .select('engagement_id')
        .in(
          'engagement_id',
          liveRows.map((row) => row.id)
        );
      if (cancelled || entriesError) return;

      const doneIds = new Set((entryRows as { engagement_id: string }[] | null ?? []).map((row) => row.engagement_id));
      const next = liveRows.find((row) => !doneIds.has(row.id));
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

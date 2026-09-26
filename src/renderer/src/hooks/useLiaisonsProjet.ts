import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { projetPrincipal } from '../lib/projets';
import type { LiaisonProjet } from '../lib/types';

interface LiaisonRow {
  id: string;
  user_id: string;
  engagement_id: string;
  project_id: string;
  position: number;
  created_at: string;
}

function fromRow(row: LiaisonRow): LiaisonProjet {
  return {
    id: row.id,
    userId: row.user_id,
    engagementId: row.engagement_id,
    projectId: row.project_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

/**
 * Charge toutes les liaisons projet de l'utilisateur d'un coup, comme
 * `useEngagements` charge tous les engagements : l'application filtre en
 * mémoire et n'a aucune requête par projet.
 *
 * `liaisons` vaut `null` tant que la table n'existe pas — c'est-à-dire tant
 * que la migration 0016 n'a pas été appliquée à la main. Ce `null` n'est pas
 * une erreur à afficher mais un état de fonctionnement : il déclenche le
 * repli sur `project_id` dans `lib/projets.ts`. Le rendre `[]` ferait
 * disparaître tous les rattachements de l'utilisateur.
 */
export function useLiaisonsProjet() {
  const { session } = useAuth();
  const [liaisons, setLiaisons] = useState<LiaisonProjet[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Renvoie la liste en plus de la poser dans l'état : un appelant qui vient
  // d'écrire a besoin des liaisons fraîches tout de suite, et relire l'état
  // de React juste après l'avoir posé rendrait la valeur précédente.
  const refresh = useCallback(async (): Promise<LiaisonProjet[] | null> => {
    setLoading(true);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement_project')
      .select('*');
    // Règle du dépôt : l'échec de LECTURE d'une table absente ne s'affiche
    // nulle part. L'utilisateur n'a rien fait, il n'y a rien à lui dire, et
    // le repli de `lib/projets.ts` couvre le cas. Ce hook n'expose donc
    // aucune erreur de lecture — les échecs d'écriture, eux, sont renvoyés
    // par `lier` et `delier` à la tâche 3.
    const resultat = fetchError ? null : (data as LiaisonRow[]).map(fromRow);
    setLiaisons(resultat);
    setLoading(false);
    return resultat;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Contrairement à la lecture, un échec d'écriture DOIT se voir : ici
  // l'utilisateur vient d'agir, et le message doit dire quoi faire plutôt
  // que ce qui a cassé.
  const MESSAGE_TABLE_ABSENTE =
    'Le rattachement multiple n’est pas encore disponible : applique la migration 0016.';

  async function lier(engagementId: string, projectId: string) {
    if (!session) return { error: 'Non connecté', liaisons: null };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement_project')
      .insert({
        user_id: session.user.id,
        engagement_id: engagementId,
        project_id: projectId,
        position: liaisons?.filter((l) => l.engagementId === engagementId).length ?? 0,
      });
    if (insertError) return { error: MESSAGE_TABLE_ABSENTE, liaisons: null };
    return { error: null, liaisons: await refresh() };
  }

  async function delier(engagementId: string, projectId: string) {
    const { error: deleteError } = await getSupabaseClient()
      .from('engagement_project')
      .delete()
      .eq('engagement_id', engagementId)
      .eq('project_id', projectId);
    if (deleteError) return { error: MESSAGE_TABLE_ABSENTE, liaisons: null };
    return { error: null, liaisons: await refresh() };
  }

  /**
   * Écriture de COMPATIBILITÉ, à retirer le jour où `project_id` disparaît.
   *
   * L'application installée lit encore cette colonne. Cesser de l'écrire
   * figerait ses rattachements à leur dernière valeur, sans le dire. On la
   * remet donc au projet principal après chaque modification — et à `null`
   * quand l'engagement n'est plus lié à rien.
   */
  async function synchroniserColonne(
    engagementId: string,
    liaisonsFraiches: LiaisonProjet[],
    updateEngagement: (id: string, patch: { projectId: string | null }) => Promise<{ error: string | null }>
  ) {
    return updateEngagement(engagementId, {
      projectId: projetPrincipal(liaisonsFraiches, engagementId),
    });
  }

  return { liaisons, loading, refresh, lier, delier, synchroniserColonne };
}

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
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

  return { liaisons, loading, refresh };
}

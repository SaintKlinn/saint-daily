import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { projetPrincipal } from '../lib/projets';
import { toFrenchError } from '../lib/errors';
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

// Message actionnable réservé au cas où `engagement_project` n'existe
// vraiment pas — PostgREST le signale par `PGRST205`, Postgres par `42P01`.
// Pour toute autre erreur d'écriture, `toFrenchError` sait déjà quoi dire
// (et logue ce qu'il ne reconnaît pas), voir `estTableAbsente` ci-dessous.
const MESSAGE_MIGRATION_REQUISE =
  'Le rattachement multiple n’est pas encore disponible : applique la migration 0016.';

// Renvoyé par `remplacerProjet` quand elle refuse d'écrire faute de savoir
// dans quel état est la liaison — voir son commentaire.
const MESSAGE_LIAISON_INDISPONIBLE =
  'Rattachement impossible pour le moment : réessaie dans un instant.';

function estTableAbsente(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01';
}

/**
 * Charge toutes les liaisons projet de l'utilisateur d'un coup, comme
 * `useEngagements` charge tous les engagements : l'application filtre en
 * mémoire et n'a aucune requête par projet.
 *
 * `liaisons` vaut `null` quand la liaison est indisponible — table absente,
 * ou lecture en échec. Ce `null` n'est pas une erreur à afficher mais un état
 * de fonctionnement : il déclenche le repli sur `project_id` dans
 * `lib/projets.ts`. Le rendre `[]` ferait disparaître tous les rattachements
 * de l'utilisateur.
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
    // par `lier` et `delier`.
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
  // que ce qui a cassé — sauf quand l'erreur est autre chose qu'une table
  // absente, auquel cas `toFrenchError` sait déjà quoi dire.
  //
  // `liaisonsActuelles` : par défaut la liste connue du hook, mais
  // `remplacerProjet` la fournit explicitement pour éviter une fermeture
  // périmée — voir son commentaire.
  async function lier(
    engagementId: string,
    projectId: string,
    liaisonsActuelles: LiaisonProjet[] | null = liaisons
  ) {
    if (!session) return { error: 'Non connecté', liaisons: null };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement_project')
      .insert({
        user_id: session.user.id,
        engagement_id: engagementId,
        project_id: projectId,
        position: liaisonsActuelles?.filter((l) => l.engagementId === engagementId).length ?? 0,
      });
    if (insertError) {
      return {
        error: estTableAbsente(insertError) ? MESSAGE_MIGRATION_REQUISE : toFrenchError(insertError.message),
        liaisons: null,
      };
    }
    return { error: null, liaisons: await refresh() };
  }

  async function delier(engagementId: string, projectId: string) {
    const { error: deleteError } = await getSupabaseClient()
      .from('engagement_project')
      .delete()
      .eq('engagement_id', engagementId)
      .eq('project_id', projectId);
    if (deleteError) {
      return {
        error: estTableAbsente(deleteError) ? MESSAGE_MIGRATION_REQUISE : toFrenchError(deleteError.message),
        liaisons: null,
      };
    }
    return { error: null, liaisons: await refresh() };
  }

  /**
   * Remplace le projet d'un engagement : détache tout, rattache au plus un.
   * Le modèle en accepterait plusieurs ; les deux interfaces qui appellent
   * ceci n'en proposent qu'un, et c'est un choix d'interface, pas une limite
   * du modèle.
   *
   * Refuse d'écrire quand la liaison est indisponible. Sans ce refus,
   * `(liaisons ?? [])` ne détacherait rien et le rattachement s'ajouterait au
   * précédent : l'engagement se retrouverait dans deux projets alors que
   * l'utilisateur en a choisi un.
   */
  async function remplacerProjet(engagementId: string, projectId: string | null) {
    if (liaisons === null) return { error: MESSAGE_LIAISON_INDISPONIBLE };
    let fraiches: LiaisonProjet[] | null = null;
    for (const l of liaisons.filter((x) => x.engagementId === engagementId)) {
      const { error, liaisons: apres } = await delier(engagementId, l.projectId);
      if (error) return { error, liaisons: await refresh() };
      fraiches = apres;
    }
    if (projectId) {
      // `fraiches` et non la fermeture `liaisons` : après la boucle
      // ci-dessus, `liaisons` contient encore les liens qu'on vient de
      // détacher (l'état React ne s'est pas encore re-rendu), et calculer la
      // position dessus poserait ce rattachement en position 1 au lieu de 0.
      const { error, liaisons: apres } = await lier(engagementId, projectId, fraiches);
      if (error) return { error, liaisons: await refresh() };
      fraiches = apres;
    }
    return { error: null, liaisons: fraiches };
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
    liaisonsFraiches: LiaisonProjet[] | null,
    updateEngagement: (id: string, patch: { projectId: string | null }) => Promise<{ error: string | null }>
  ) {
    // `null` veut dire « on n'a pas pu lire la table ». On ne touche alors
    // PAS à la colonne : la recopier depuis une liste qu'on n'a pas pu
    // obtenir l'écraserait avec `null`, effaçant précisément le rattachement
    // hérité qui sert de repli quand la table est injoignable. Une colonne
    // périmée se rattrape au prochain succès ; une colonne effacée, non.
    if (liaisonsFraiches === null) return { error: null };
    return updateEngagement(engagementId, {
      projectId: projetPrincipal(liaisonsFraiches, engagementId),
    });
  }

  return { liaisons, loading, refresh, lier, delier, remplacerProjet, synchroniserColonne };
}

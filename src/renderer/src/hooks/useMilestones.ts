import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllPages } from './usePracticeEntries';
import { getSupabaseClient } from '../lib/supabase';
import { toFrenchError } from '../lib/errors';
import type { EngagementMilestone } from '../lib/types';

interface MilestoneRow {
  id: string;
  engagement_id: string;
  label: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

function fromRow(row: MilestoneRow): EngagementMilestone {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    label: row.label,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function useMilestones(engagementId: string | null) {
  const [milestones, setMilestones] = useState<EngagementMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verrou de génération : incrémenté à chaque appel de `refresh`, avant
  // même la requête. Sans lui, une requête encore en vol quand
  // `engagementId` change — navigation d'une fiche de skill à une autre,
  // même route `skills/:id`, sans démontage — peut se résoudre APRÈS la
  // plus récente et écraser la bonne liste par l'ancienne, sans qu'aucun
  // rendu ultérieur ne vienne corriger. Incrémenté aussi avant la sortie
  // anticipée : vider la liste doit, elle aussi, périmer ce qui est en vol.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!engagementId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement_milestone')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('position', { ascending: true });
    // Appel périmé : une génération plus récente a démarré pendant
    // l'attente ci-dessus, son résultat est déjà affiché ou en cours — ne
    // pas toucher l'état avec cette réponse arrivée en retard.
    if (generation !== generationRef.current) return;
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setMilestones((data as MilestoneRow[]).map(fromRow));
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addMilestone(label: string) {
    if (!engagementId) return { error: 'Aucun engagement sélectionné' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement_milestone')
      .insert({ engagement_id: engagementId, label, position: milestones.length });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function toggleMilestone(id: string, completed: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement_milestone')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  return { milestones, loading, error, refresh, addMilestone, toggleMilestone };
}

/**
 * Les jalons de plusieurs engagements en une seule requête paginée —
 * utilisé par la liste des projets pour calculer l'avancement de chaque
 * ligne sans une requête par projet.
 *
 * L'appelant passe des identifiants TRIÉS et DÉDOUBLONNÉS : la
 * mémoïsation se fait sur `engagementIds.join(',')`, donc deux tableaux de
 * même contenu dans un ordre différent produiraient deux clés différentes
 * et relanceraient la requête à chaque rendu où l'ordre change.
 */
export function useAllMilestones(engagementIds: string[]) {
  const [milestonesByEngagement, setMilestonesByEngagement] = useState<
    Record<string, EngagementMilestone[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = engagementIds.join(',');
  // Même verrou de génération que `useMilestones` ci-dessus : quand la
  // liste d'ids change, la requête précédente reste en vol et pourrait, en
  // se résolvant après coup, écraser un résultat plus complet.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (engagementIds.length === 0) {
      setMilestonesByEngagement({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { rows, error: fetchError } = await fetchAllPages<MilestoneRow>((from, to) =>
      getSupabaseClient()
        .from('engagement_milestone')
        .select('*')
        .in('engagement_id', engagementIds)
        // Une lecture paginée a besoin d'un ordre total : `position` n'est
        // unique qu'au sein d'un engagement, donc `id` départage pour que
        // chaque ligne apparaisse exactement une fois quel que soit le plan
        // d'exécution.
        .order('position', { ascending: true })
        .order('id')
        .range(from, to)
    );
    if (generation !== generationRef.current) return;
    setError(fetchError);
    const parEngagement: Record<string, EngagementMilestone[]> = {};
    for (const row of rows) {
      const jalon = fromRow(row);
      (parEngagement[jalon.engagementId] ??= []).push(jalon);
    }
    setMilestonesByEngagement(parEngagement);
    setLoading(false);
    // `key` est la vraie dépendance : évite de recréer cette fonction, et
    // donc de re-déclencher l'effet, à chaque nouvelle identité de tableau
    // sans changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { milestonesByEngagement, loading, error, refresh };
}

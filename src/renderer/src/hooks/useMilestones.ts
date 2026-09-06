import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
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

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { SkillMilestone } from '../lib/types';

interface MilestoneRow {
  id: string;
  skill_id: string;
  label: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

function fromRow(row: MilestoneRow): SkillMilestone {
  return {
    id: row.id,
    skillId: row.skill_id,
    label: row.label,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function useMilestones(skillId: string | null) {
  const [milestones, setMilestones] = useState<SkillMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!skillId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('skill_milestone')
      .select('*')
      .eq('skill_id', skillId)
      .order('position', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setMilestones((data as MilestoneRow[]).map(fromRow));
    }
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addMilestone(label: string) {
    if (!skillId) return { error: 'Aucun skill sélectionné' };
    const { error: insertError } = await getSupabaseClient()
      .from('skill_milestone')
      .insert({ skill_id: skillId, label, position: milestones.length });
    if (insertError) return { error: insertError.message };
    await refresh();
    return { error: null };
  }

  async function toggleMilestone(id: string, completed: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill_milestone')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { milestones, loading, error, refresh, addMilestone, toggleMilestone };
}

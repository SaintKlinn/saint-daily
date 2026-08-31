import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { GenericLevel, Skill } from '../lib/types';

interface SkillRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tags: string[];
  generic_level: GenericLevel;
  archived_at: string | null;
  created_at: string;
}

function fromRow(row: SkillRow): Skill {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    genericLevel: row.generic_level,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function useSkills() {
  const { session } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('skill')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSkills((data as SkillRow[]).map(fromRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createSkill(input: {
    name: string;
    tags: string[];
    genericLevel: GenericLevel;
    notes?: string | null;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('skill').insert({
      user_id: session.user.id,
      name: input.name,
      tags: input.tags,
      generic_level: input.genericLevel,
      notes: input.notes ?? null,
    });
    if (insertError) return { error: insertError.message };
    await refresh();
    return { error: null };
  }

  async function updateSkill(id: string, patch: Partial<Pick<Skill, 'name' | 'notes' | 'tags' | 'genericLevel'>>) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
      })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  async function setArchived(id: string, archived: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('skill')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { skills, loading, error, refresh, createSkill, updateSkill, setArchived };
}

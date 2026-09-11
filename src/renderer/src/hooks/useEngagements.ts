import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { Engagement, GenericLevel, Priority } from '../lib/types';

interface EngagementRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tags: string[];
  generic_level: GenericLevel;
  archived_at: string | null;
  scheduled_at: string | null;
  scheduled_ends_at: string | null;
  priority: Priority;
  created_at: string;
}

function fromRow(row: EngagementRow): Engagement {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    genericLevel: row.generic_level,
    archivedAt: row.archived_at,
    scheduledAt: row.scheduled_at,
    scheduledEndsAt: row.scheduled_ends_at,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

export function useEngagements() {
  const { session } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('engagement')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setEngagements((data as EngagementRow[]).map(fromRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // `genericLevel` optionnel : sans objet pour une tâche ponctuelle,
  // laissée absente du payload pour que la colonne applique son propre
  // défaut plutôt que de dupliquer 'debutant' ici.
  async function createEngagement(input: {
    name: string;
    tags: string[];
    genericLevel?: GenericLevel;
    notes?: string | null;
    scheduledAt?: string | null;
    scheduledEndsAt?: string | null;
    priority?: Priority;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient()
      .from('engagement')
      .insert({
        user_id: session.user.id,
        name: input.name,
        tags: input.tags,
        ...(input.genericLevel ? { generic_level: input.genericLevel } : {}),
        notes: input.notes ?? null,
        scheduled_at: input.scheduledAt ?? null,
        scheduled_ends_at: input.scheduledEndsAt ?? null,
        ...(input.priority ? { priority: input.priority } : {}),
      });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function updateEngagement(
    id: string,
    patch: Partial<
      Pick<Engagement, 'name' | 'notes' | 'tags' | 'genericLevel' | 'priority' | 'scheduledAt' | 'scheduledEndsAt'>
    >
  ) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.genericLevel !== undefined ? { generic_level: patch.genericLevel } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduled_at: patch.scheduledAt } : {}),
        ...(patch.scheduledEndsAt !== undefined ? { scheduled_ends_at: patch.scheduledEndsAt } : {}),
      })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  async function setArchived(id: string, archived: boolean) {
    const { error: updateError } = await getSupabaseClient()
      .from('engagement')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  return { engagements, loading, error, refresh, createEngagement, updateEngagement, setArchived };
}

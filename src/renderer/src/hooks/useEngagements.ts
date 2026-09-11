import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { Engagement, GenericLevel, Priority, RecurrenceType } from '../lib/types';

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
  recurrence_series_id: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
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
    recurrenceSeriesId: row.recurrence_series_id,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    recurrenceWeekdays: row.recurrence_weekdays,
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
    recurrenceSeriesId?: string | null;
    recurrenceType?: RecurrenceType;
    recurrenceInterval?: number | null;
    recurrenceWeekdays?: number[] | null;
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
        ...(input.recurrenceSeriesId !== undefined ? { recurrence_series_id: input.recurrenceSeriesId } : {}),
        ...(input.recurrenceType ? { recurrence_type: input.recurrenceType } : {}),
        ...(input.recurrenceInterval !== undefined ? { recurrence_interval: input.recurrenceInterval } : {}),
        ...(input.recurrenceWeekdays !== undefined ? { recurrence_weekdays: input.recurrenceWeekdays } : {}),
      });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function updateEngagement(
    id: string,
    patch: Partial<
      Pick<
        Engagement,
        | 'name'
        | 'notes'
        | 'tags'
        | 'genericLevel'
        | 'priority'
        | 'scheduledAt'
        | 'scheduledEndsAt'
        | 'recurrenceSeriesId'
        | 'recurrenceType'
        | 'recurrenceInterval'
        | 'recurrenceWeekdays'
      >
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
        ...(patch.recurrenceSeriesId !== undefined ? { recurrence_series_id: patch.recurrenceSeriesId } : {}),
        ...(patch.recurrenceType !== undefined ? { recurrence_type: patch.recurrenceType } : {}),
        ...(patch.recurrenceInterval !== undefined ? { recurrence_interval: patch.recurrenceInterval } : {}),
        ...(patch.recurrenceWeekdays !== undefined ? { recurrence_weekdays: patch.recurrenceWeekdays } : {}),
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

  // Première suppression réelle de l'app — volontairement scopée aux
  // occurrences de récurrence auto-générées et jamais échues (voir spec) :
  // rien d'autre dans le codebase n'appelle cette fonction.
  async function deleteEngagement(id: string) {
    const { error: deleteError } = await getSupabaseClient().from('engagement').delete().eq('id', id);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
    await refresh();
    return { error: null };
  }

  return { engagements, loading, error, refresh, createEngagement, updateEngagement, setArchived, deleteEngagement };
}

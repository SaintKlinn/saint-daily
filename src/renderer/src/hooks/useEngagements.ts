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
  deleted_at: string | null;
  scheduled_at: string | null;
  scheduled_ends_at: string | null;
  priority: Priority;
  recurrence_series_id: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  is_project: boolean;
  project_id: string | null;
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
    // `?? null` volontaire : la migration qui ajoute cette colonne est
    // appliquée à la base live après le déploiement du code. Entre les
    // deux, la propriété est absente de la ligne et vaudrait `undefined`,
    // ce que le filtre ci-dessous traiterait correctement mais que le type
    // `string | null` ne décrit pas.
    deletedAt: row.deleted_at ?? null,
    scheduledAt: row.scheduled_at,
    scheduledEndsAt: row.scheduled_ends_at,
    priority: row.priority,
    recurrenceSeriesId: row.recurrence_series_id,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    recurrenceWeekdays: row.recurrence_weekdays,
    isProject: row.is_project,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

export function useEngagements() {
  const { session } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [deletedEngagements, setDeletedEngagements] = useState<Engagement[]>([]);
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
      const all = (data as EngagementRow[]).map(fromRow);
      // Point de filtrage unique de toute l'application : aucun écran n'a
      // à se souvenir d'exclure la corbeille, et aucun futur écran ne
      // pourra afficher un élément supprimé par accident. Le tri est
      // côté client et non dans la requête, pour que le code fonctionne
      // aussi tant que la colonne n'existe pas (voir l'en-tête du plan).
      setEngagements(all.filter((engagement) => !engagement.deletedAt));
      setDeletedEngagements(
        all
          .filter((engagement) => engagement.deletedAt)
          .sort((a, b) => (b.deletedAt as string).localeCompare(a.deletedAt as string))
      );
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
    isProject?: boolean;
    projectId?: string | null;
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
        ...(input.isProject !== undefined ? { is_project: input.isProject } : {}),
        ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
      });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function createEngagements(
    inputs: Array<{
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
      isProject?: boolean;
      projectId?: string | null;
    }>
  ) {
    if (!session) return { error: 'Non connecté' };
    if (inputs.length === 0) return { error: null };
    const rows = inputs.map((input) => ({
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
      ...(input.isProject !== undefined ? { is_project: input.isProject } : {}),
      ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
    }));
    const { error: insertError } = await getSupabaseClient().from('engagement').insert(rows);
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  // Contrepartie en lot de `deleteEngagement` — même portée volontaire
  // (occurrences de récurrence auto-générées, jamais échues).
  async function deleteEngagements(ids: string[]) {
    if (ids.length === 0) return { error: null };
    const { error: deleteError } = await getSupabaseClient().from('engagement').delete().in('id', ids);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
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
        | 'projectId'
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
        ...(patch.projectId !== undefined ? { project_id: patch.projectId } : {}),
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

  /**
   * Envoie un engagement à la corbeille. Pour un projet, ses enfants
   * encore vivants y partent avec lui, **avec exactement le même
   * horodatage** : c'est ce qui permet ensuite à `restore` de ne remonter
   * que ceux qui sont partis à ce moment-là, et pas un enfant supprimé
   * séparément plus tôt.
   */
  async function softDelete(id: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    const deletedAt = new Date().toISOString();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .update({ deleted_at: deletedAt })
        .eq('project_id', id)
        .is('deleted_at', null);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
    }
    const { error: updateError } = await supabase
      .from('engagement')
      .update({ deleted_at: deletedAt })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  async function restore(id: string, deletedAt: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .update({ deleted_at: null })
        .eq('project_id', id)
        .eq('deleted_at', deletedAt);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
    }
    const { error: updateError } = await supabase
      .from('engagement')
      .update({ deleted_at: null })
      .eq('id', id);
    if (updateError) return { error: toFrenchError(updateError.message) };
    await refresh();
    return { error: null };
  }

  /**
   * Suppression réelle et irréversible. Les entrées de pratique et les
   * jalons partent d'eux-mêmes (`on delete cascade`), mais `project_id`
   * n'a aucune clause `on delete` : sans les deux passes ci-dessous, la
   * base refuserait de supprimer un projet encore référencé.
   */
  async function purge(id: string, isProject: boolean) {
    const supabase = getSupabaseClient();
    if (isProject) {
      const { error: childrenError } = await supabase
        .from('engagement')
        .delete()
        .eq('project_id', id)
        .not('deleted_at', 'is', null);
      if (childrenError) return { error: toFrenchError(childrenError.message) };
      // Un enfant restauré entre-temps pointe encore vers le projet : il
      // survit, mais perd son rattachement, sans quoi la clé étrangère
      // bloquerait la suppression du parent.
      const { error: detachError } = await supabase
        .from('engagement')
        .update({ project_id: null })
        .eq('project_id', id);
      if (detachError) return { error: toFrenchError(detachError.message) };
    }
    const { error: deleteError } = await supabase.from('engagement').delete().eq('id', id);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
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

  return {
    engagements,
    deletedEngagements,
    loading,
    error,
    refresh,
    createEngagement,
    createEngagements,
    updateEngagement,
    setArchived,
    deleteEngagement,
    deleteEngagements,
    softDelete,
    restore,
    purge,
  };
}

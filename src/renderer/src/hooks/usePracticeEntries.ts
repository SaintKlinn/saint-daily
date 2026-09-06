import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { PracticeEntry } from '../lib/types';

interface PracticeEntryRow {
  id: string;
  engagement_id: string;
  user_id: string;
  duration_minutes: number;
  note: string | null;
  practiced_at: string;
  created_at: string;
}

function fromRow(row: PracticeEntryRow): PracticeEntry {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    userId: row.user_id,
    durationMinutes: row.duration_minutes,
    note: row.note,
    practicedAt: row.practiced_at,
    createdAt: row.created_at,
  };
}

export function usePracticeEntries(engagementId: string | null) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!engagementId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('practice_entry')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('practiced_at', { ascending: false });
    if (fetchError) {
      setError(toFrenchError(fetchError.message));
    } else {
      setEntries((data as PracticeEntryRow[]).map(fromRow));
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logEntry(input: {
    engagementId: string;
    durationMinutes: number;
    note?: string | null;
    practicedAt?: string;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      engagement_id: input.engagementId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
    });
    if (insertError) return { error: toFrenchError(insertError.message) };
    if (input.engagementId === engagementId) await refresh();
    return { error: null };
  }

  return { entries, loading, error, refresh, logEntry };
}

/**
 * Toutes les entrées de plusieurs engagements en une seule requête —
 * utilisé par l'Accueil pour calculer streak/régularité de chaque skill
 * actif et pour savoir quelles tâches ont déjà une entrée, sans une
 * requête par engagement.
 */
export function useAllPracticeEntries(engagementIds: string[]) {
  const [entriesBySkill, setEntriesBySkill] = useState<Record<string, PracticeEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = engagementIds.join(',');

  const refresh = useCallback(async () => {
    if (engagementIds.length === 0) {
      setEntriesBySkill({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // L'erreur DOIT être capturée : sans elle, un échec de cette requête
    // affichait silencieusement tous les skills avec streak 0 et aucun
    // rappel « dû », sans le moindre indice que quelque chose a raté.
    const { data, error: fetchError } = await getSupabaseClient()
      .from('practice_entry')
      .select('*')
      .in('engagement_id', engagementIds);
    setError(fetchError ? toFrenchError(fetchError.message) : null);
    const bySkill: Record<string, PracticeEntry[]> = {};
    for (const row of (data ?? []) as PracticeEntryRow[]) {
      const entry = fromRow(row);
      (bySkill[entry.engagementId] ??= []).push(entry);
    }
    setEntriesBySkill(bySkill);
    setLoading(false);
    // key (la liste d'ids jointe) est la vraie dépendance : évite de
    // recréer cette fonction (et donc de re-déclencher l'effet ci-dessous)
    // à chaque re-render sur une nouvelle identité de tableau sans
    // changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entriesBySkill, loading, error, refresh };
}

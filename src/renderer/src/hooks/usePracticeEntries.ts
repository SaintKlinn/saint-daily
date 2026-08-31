import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { PracticeEntry } from '../lib/types';

interface PracticeEntryRow {
  id: string;
  skill_id: string;
  user_id: string;
  duration_minutes: number;
  note: string | null;
  practiced_at: string;
  created_at: string;
}

function fromRow(row: PracticeEntryRow): PracticeEntry {
  return {
    id: row.id,
    skillId: row.skill_id,
    userId: row.user_id,
    durationMinutes: row.duration_minutes,
    note: row.note,
    practicedAt: row.practiced_at,
    createdAt: row.created_at,
  };
}

export function usePracticeEntries(skillId: string | null) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!skillId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('practice_entry')
      .select('*')
      .eq('skill_id', skillId)
      .order('practiced_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEntries((data as PracticeEntryRow[]).map(fromRow));
    }
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logEntry(input: {
    skillId: string;
    durationMinutes: number;
    note?: string | null;
    practicedAt?: string;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      skill_id: input.skillId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
    });
    if (insertError) return { error: insertError.message };
    if (input.skillId === skillId) await refresh();
    return { error: null };
  }

  return { entries, loading, error, refresh, logEntry };
}

/**
 * Toutes les entrées de plusieurs skills en une seule requête — utilisé par
 * l'Accueil pour calculer streak/régularité de chaque skill actif sans une
 * requête par skill.
 */
export function useAllPracticeEntries(skillIds: string[]) {
  const [entriesBySkill, setEntriesBySkill] = useState<Record<string, PracticeEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const key = skillIds.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (skillIds.length === 0) {
        setEntriesBySkill({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await getSupabaseClient().from('practice_entry').select('*').in('skill_id', skillIds);
      if (cancelled) return;
      const bySkill: Record<string, PracticeEntry[]> = {};
      for (const row of (data ?? []) as PracticeEntryRow[]) {
        const entry = fromRow(row);
        (bySkill[entry.skillId] ??= []).push(entry);
      }
      setEntriesBySkill(bySkill);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // key (la liste d'ids jointe) est la vraie dépendance : évite un
    // effet qui re-fetch à chaque re-render sur une nouvelle identité de
    // tableau sans changement de contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { entriesBySkill, loading };
}

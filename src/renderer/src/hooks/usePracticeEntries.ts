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

// Supabase plafonne une requête à 1000 lignes par défaut. Sans pagination,
// toute requête sur l'historique complet se tronquerait silencieusement
// dès que ce seuil est dépassé — un bug qui s'aggrave avec le temps et qui
// serait invisible sans erreur. Extrait en helper partagé pour que
// `useAllPracticeEntries` (streaks d'Accueil/Calendrier/ListeSkills/
// Pomodoro) et `useAllPracticeEntriesForUser` (Bilan) ne puissent pas
// diverger sur cette logique : l'un des deux paginait déjà, l'autre non.
const PRACTICE_ENTRIES_PAGE_SIZE = 1000;

export async function fetchAllPages<TRow>(
  // `PromiseLike`, pas `Promise` : le query builder de supabase-js est
  // "thenable" mais n'implémente pas l'interface `Promise` complète
  // (`catch`/`finally`/`Symbol.toStringTag`) tant qu'on ne l'attend pas.
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: TRow[] | null; error: { message: string } | null }>
): Promise<{ rows: TRow[]; error: string | null }> {
  const rows: TRow[] = [];
  for (let from = 0; ; from += PRACTICE_ENTRIES_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PRACTICE_ENTRIES_PAGE_SIZE - 1);
    if (error) return { rows, error: toFrenchError(error.message) };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PRACTICE_ENTRIES_PAGE_SIZE) break;
  }
  return { rows, error: null };
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
    const { rows, error: fetchError } = await fetchAllPages<PracticeEntryRow>((from, to) =>
      getSupabaseClient().from('practice_entry').select('*').in('engagement_id', engagementIds).range(from, to)
    );
    setError(fetchError);
    const bySkill: Record<string, PracticeEntry[]> = {};
    for (const row of rows) {
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

/**
 * Toutes les entrées de pratique de l'utilisateur, sans filtre
 * d'engagement — y compris celles d'engagements archivés, puisque
 * l'historique reste l'historique. Utilisé par l'écran Bilan, qui a besoin
 * d'une vue complète en une seule source.
 */
export function useAllPracticeEntriesForUser() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { rows, error: fetchError } = await fetchAllPages<PracticeEntryRow>((from, to) =>
      getSupabaseClient().from('practice_entry').select('*').order('practiced_at', { ascending: false }).range(from, to)
    );
    if (fetchError) {
      setError(fetchError);
      setLoading(false);
      return;
    }
    setEntries(rows.map(fromRow));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}

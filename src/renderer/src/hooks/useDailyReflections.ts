import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import { toLocalDateKey } from '../lib/rituels';
import type { DailyReflection } from '../lib/types';

interface DailyReflectionRow {
  id: string;
  date: string;
  text: string;
  created_at: string;
}

function fromRow(row: DailyReflectionRow): DailyReflection {
  return { id: row.id, date: row.date, text: row.text, createdAt: row.created_at };
}

export function useDailyReflections() {
  const { session } = useAuth();
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data, error } = await getSupabaseClient()
      .from('daily_reflection')
      .select('*')
      .order('date', { ascending: false });
    // Un échec de lecture vaut « aucune réflexion » et n'est remonté
    // nulle part : tant que la migration n'est pas appliquée cette table
    // n'existe pas, et l'Accueil ne doit pas porter un message d'erreur
    // permanent pour une fonctionnalité que l'utilisateur n'a pas touchée.
    setReflections(error ? [] : (data as DailyReflectionRow[]).map(fromRow));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Enregistre le bilan du jour. La contrainte d'unicité `(user_id, date)`
   * rend l'opération idempotente : réécrire son bilan remplace la ligne du
   * jour au lieu d'en créer une seconde.
   */
  async function saveToday(text: string) {
    if (!session) return { error: 'Non connecté' };
    const { error } = await getSupabaseClient()
      .from('daily_reflection')
      .upsert({ user_id: session.user.id, date: toLocalDateKey(), text }, { onConflict: 'user_id,date' });
    // Ici, à l'inverse de la lecture, l'erreur est renvoyée : l'utilisateur
    // vient d'écrire une phrase et de cliquer, il doit savoir si elle est
    // partie.
    if (error) return { error: toFrenchError(error.message) };
    await refresh();
    return { error: null };
  }

  return { reflections, loading, refresh, saveToday };
}

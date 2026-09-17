import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import { toLocalDateKey } from '../lib/rituels';
import { fetchAllPages } from './usePracticeEntries';
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
    // Paginé via le helper partagé plutôt qu'un `.select()` unique : passé
    // ~1000 lignes (2,7 ans de bilans quotidiens), PostgREST tronque
    // silencieusement la réponse, et triée `date desc` ce sont les plus
    // anciennes réflexions qui disparaîtraient du Journal sans le moindre
    // signal. Voir le commentaire de `fetchAllPages` dans
    // usePracticeEntries.ts.
    const { rows, error } = await fetchAllPages<DailyReflectionRow>((from, to) =>
      getSupabaseClient().from('daily_reflection').select('*').order('date', { ascending: false }).range(from, to)
    );
    // Un échec de lecture vaut « aucune réflexion » et n'est remonté
    // nulle part : tant que la migration n'est pas appliquée cette table
    // n'existe pas, et l'Accueil ne doit pas porter un message d'erreur
    // permanent pour une fonctionnalité que l'utilisateur n'a pas touchée.
    setReflections(error ? [] : rows.map(fromRow));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Enregistre le bilan du jour. La contrainte d'unicité `(user_id, date)`
   * rend l'opération idempotente : réécrire son bilan remplace la ligne du
   * jour au lieu d'en créer une seconde.
   *
   * `dateKey` est fourni par l'appelant plutôt que recalculé ici avec
   * `toLocalDateKey()` : l'appelant (Accueil) l'a déjà dérivé de l'horloge
   * qui a décidé d'afficher le bandeau. Relire l'horloge une seconde fois
   * au moment du clic ouvrirait une fenêtre autour de minuit où une ligne
   * tapée juste avant serait enregistrée sous le jour suivant.
   */
  async function saveToday(text: string, dateKey: string = toLocalDateKey()) {
    if (!session) return { error: 'Non connecté' };
    const { error } = await getSupabaseClient()
      .from('daily_reflection')
      .upsert({ user_id: session.user.id, date: dateKey, text }, { onConflict: 'user_id,date' });
    // Ici, à l'inverse de la lecture, l'erreur est renvoyée : l'utilisateur
    // vient d'écrire une phrase et de cliquer, il doit savoir si elle est
    // partie.
    if (error) return { error: toFrenchError(error.message) };
    await refresh();
    return { error: null };
  }

  return { reflections, loading, refresh, saveToday };
}

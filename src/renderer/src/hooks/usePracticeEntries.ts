import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { Mood, PracticeEntry } from '../lib/types';

interface PracticeEntryRow {
  id: string;
  engagement_id: string;
  user_id: string;
  duration_minutes: number;
  note: string | null;
  mood?: Mood | null;
  tags?: string[] | null;
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
    // `?? null` volontaire : la migration qui ajoute cette colonne n'est
    // pas encore appliquée à la base live, donc la propriété peut être
    // absente de la ligne.
    mood: row.mood ?? null,
    tags: row.tags ?? [],
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
  // Même verrou de génération que useAllPracticeEntries ci-dessous :
  // `engagementId` change par exemple sur DetailSkill quand on navigue
  // d'une fiche à une autre sans démonter le composant (route /skill/:id),
  // et une requête encore en vol pour l'ancien id ne doit pas pouvoir, en
  // se résolvant après coup, écraser le résultat déjà affiché pour le
  // nouveau.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
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
    // Appel périmé : une génération plus récente a démarré pendant l'attente
    // ci-dessus (nouvel `engagementId`), son résultat est déjà affiché ou en
    // cours — ne pas toucher l'état avec cette réponse arrivée en retard.
    if (generation !== generationRef.current) return;
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
    mood?: Mood | null;
    tags?: string[];
    practicedAt?: string;
  }) {
    if (!session) return { error: 'Non connecté' };
    const { error: insertError } = await getSupabaseClient().from('practice_entry').insert({
      engagement_id: input.engagementId,
      user_id: session.user.id,
      duration_minutes: input.durationMinutes,
      note: input.note ?? null,
      practiced_at: input.practicedAt ?? new Date().toISOString(),
      // Spread conditionnel, pas `mood: input.mood ?? null` : la colonne
      // n'existe pas encore en base live, et la nommer ferait échouer
      // TOUTES les écritures d'entrée — y compris cocher une tâche et
      // terminer un Pomodoro, qui n'ont rien à voir avec l'humeur.
      ...(input.mood ? { mood: input.mood } : {}),
      // Même raison que `mood` : la colonne n'existe pas encore en base
      // live, et la nommer casserait toutes les écritures d'entrée, y
      // compris celles qui n'ont rien à voir avec les tags.
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    });
    if (insertError) return { error: toFrenchError(insertError.message) };
    if (input.engagementId === engagementId) await refresh();
    return { error: null };
  }

  return { entries, loading, error, refresh, logEntry };
}

export interface ModificationSeance {
  durationMinutes: number;
  practicedAt: string;
  note: string | null;
  mood: Mood | null;
  tags: string[];
}

/**
 * Corrige une séance déjà enregistrée. Avant, une faute de frappe sur la
 * durée ou la date restait pour toujours dans les séries et le Bilan.
 * Fonction simple plutôt que méthode d'un hook : le Journal et la fiche d'un
 * skill l'appellent chacun avec leur propre rafraîchissement.
 */
export async function modifierSeance(id: string, modification: ModificationSeance): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient()
    .from('practice_entry')
    .update({
      duration_minutes: modification.durationMinutes,
      practiced_at: modification.practicedAt,
      note: modification.note,
      mood: modification.mood,
      tags: modification.tags,
    })
    .eq('id', id);
  return { error: error ? toFrenchError(error.message) : null };
}

/** Supprime définitivement une séance (pas de corbeille : une séance n'a
 *  pas de fiche à restaurer, et l'éditeur demande confirmation). */
export async function supprimerSeance(id: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('practice_entry').delete().eq('id', id);
  return { error: error ? toFrenchError(error.message) : null };
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
  // Verrou de génération : incrémenté à chaque appel de `refresh`, avant
  // même la requête. Sans lui, une requête encore en vol quand la liste
  // d'ids change (ex. DetailProjet, qui interroge d'abord le seul id du
  // projet puis, une fois ses membres arrivés, l'ensemble complet) peut se
  // résoudre APRÈS la requête la plus récente et écraser un résultat
  // complet avec un résultat obsolète — sans qu'aucun re-rendu ultérieur
  // ne vienne jamais corriger l'affichage. Incrémenté aussi dans la branche
  // de sortie anticipée : vider la map doit, elle aussi, périmer toute
  // requête déjà en vol.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
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
      getSupabaseClient()
        .from('practice_entry')
        .select('*')
        .in('engagement_id', engagementIds)
        // Une lecture paginée qui est ensuite sommée a besoin d'un ordre
        // total : sans lui, Postgres ne garantit aucun ordre stable entre
        // deux pages, et `practiced_at` seul n'est pas unique. `id` sert
        // de départage pour que chaque ligne apparaisse exactement une
        // fois, quel que soit le plan d'exécution.
        .order('practiced_at', { ascending: false })
        .order('id')
        .range(from, to)
    );
    // Appel périmé : une génération plus récente a démarré pendant l'attente
    // ci-dessus (nouvelle liste d'ids), son résultat est déjà affiché ou en
    // cours — ne pas toucher l'état avec cette réponse arrivée en retard.
    if (generation !== generationRef.current) return;
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
  // Même verrou de génération que useAllPracticeEntries : `session` change
  // de référence à chaque rafraîchissement automatique de jeton (et bien
  // sûr à la connexion/déconnexion), ce qui recrée `refresh` et relance
  // l'effet ci-dessous. Une requête encore en vol pour l'ancienne session
  // ne doit pas pouvoir, en se résolvant après coup, écraser le résultat
  // d'une requête plus récente.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!session) return;
    setLoading(true);
    setError(null);
    const { rows, error: fetchError } = await fetchAllPages<PracticeEntryRow>((from, to) =>
      getSupabaseClient().from('practice_entry').select('*').order('practiced_at', { ascending: false }).range(from, to)
    );
    // Appel périmé : une génération plus récente a démarré pendant l'attente
    // ci-dessus (nouvelle session), son résultat est déjà affiché ou en
    // cours — ne pas toucher l'état avec cette réponse arrivée en retard.
    if (generation !== generationRef.current) return;
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

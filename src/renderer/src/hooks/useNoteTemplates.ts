import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toFrenchError } from '../lib/errors';
import type { NoteTemplate } from '../lib/types';

interface NoteTemplateRow {
  id: string;
  text: string;
  position: number;
  created_at: string;
}

function fromRow(row: NoteTemplateRow): NoteTemplate {
  return { id: row.id, text: row.text, position: row.position, createdAt: row.created_at };
}

export function useNoteTemplates() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data, error: fetchError } = await getSupabaseClient()
      .from('note_template')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    // Un échec ici signifie « pas de modèles », jamais « écran cassé » :
    // tant que la migration n'est pas appliquée, cette table n'existe pas,
    // et `NouvelleEntree` — le formulaire central de l'app — doit rester
    // parfaitement utilisable sans ses raccourcis.
    setTemplates(fetchError ? [] : (data as NoteTemplateRow[]).map(fromRow));
    setError(fetchError ? toFrenchError(fetchError.message) : null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addTemplate(text: string) {
    if (!session) return { error: 'Non connecté' };
    // `templates.length` collisionnerait avec une position existante dès
    // qu'un modèle a été retiré : après suppression du premier de trois
    // modèles (positions 0, 1, 2), il n'en reste que deux mais la position
    // 2 est déjà prise. Un plus que le maximum courant reste toujours
    // libre, y compris quand la liste est vide (`-1 + 1`).
    const nextPosition = templates.reduce((max, t) => Math.max(max, t.position), -1) + 1;
    const { error: insertError } = await getSupabaseClient()
      .from('note_template')
      .insert({ user_id: session.user.id, text, position: nextPosition });
    if (insertError) return { error: toFrenchError(insertError.message) };
    await refresh();
    return { error: null };
  }

  async function removeTemplate(id: string) {
    const { error: deleteError } = await getSupabaseClient().from('note_template').delete().eq('id', id);
    if (deleteError) return { error: toFrenchError(deleteError.message) };
    await refresh();
    return { error: null };
  }

  return { templates, loading, error, refresh, addTemplate, removeTemplate };
}

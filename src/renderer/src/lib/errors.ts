/**
 * Traduit les erreurs Supabase/Postgrest les plus courantes en messages
 * français génériques. Toute erreur non reconnue tombe sur un message
 * générique — jamais de détail technique brut affiché à l'utilisateur
 * (voir spec, section Gestion des erreurs).
 *
 * À appeler au point où le message brut entre dans l'état de l'app
 * (hooks de données, signIn), et PAS au rendu : les écrans mélangent ces
 * messages avec leurs propres textes de validation déjà en français
 * (« Choisis un skill. », « Non connecté »…), qui ne doivent pas être
 * réécrits en message générique. Traduire à la source garantit aussi que
 * le message brut n'est logué qu'une fois, pas à chaque re-render.
 */
export function toFrenchError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Connexion impossible. Vérifie ta connexion internet et réessaie.';
  }
  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return 'Cet élément existe déjà.';
  }
  console.error('Erreur Supabase non traduite :', message);
  return 'Une erreur est survenue. Réessaie dans un instant.';
}

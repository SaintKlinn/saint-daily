import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// Instance mémorisée à dessein : plusieurs createClient() créeraient
// plusieurs instances GoTrueClient dont les événements onAuthStateChange
// ne seraient pas forcément synchronisés entre elles (même piège
// documenté dans Saint Gym, lib/supabase/client.ts).
let client: SupabaseClient<any, any, 'saint_daily'> | undefined;

export function getSupabaseClient(): SupabaseClient<any, any, 'saint_daily'> {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis (.env.local)');
    }
    client = createSupabaseClient(url, anonKey, {
      db: { schema: 'saint_daily' },
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

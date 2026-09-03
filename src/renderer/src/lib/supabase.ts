import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

type AppSupabaseClient = SupabaseClient<any, 'saint_daily'>;

// Instance mémorisée à dessein : plusieurs createClient() créeraient
// plusieurs instances GoTrueClient dont les événements onAuthStateChange
// ne seraient pas forcément synchronisés entre elles (même piège
// documenté dans Saint Gym, lib/supabase/client.ts).
let client: AppSupabaseClient | undefined;

export function getSupabaseClient(): AppSupabaseClient {
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

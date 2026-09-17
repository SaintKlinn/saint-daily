import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { toFrenchError } from './errors';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    // Traduit ici, à la source : l'écran de login affiche la valeur telle
    // quelle et ne voit jamais le message anglais de Supabase.
    return { error: error ? toFrenchError(error.message) : null };
  }

  async function signOut() {
    // `scope: 'local'` et non le défaut : `signOut()` nu vaut
    // `scope: 'global'`, qui révoque les jetons de rafraîchissement de
    // TOUTES les sessions de l'utilisateur. Or ce projet Supabase est
    // partagé avec Saint Gym — se déconnecter d'ici fermait aussi sa
    // session là-bas, et sur tous ses appareils. Un bouton « Se
    // déconnecter » dans une app ne déconnecte que cette app.
    await getSupabaseClient().auth.signOut({ scope: 'local' });
  }

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getDevLoginCredentials } from '../lib/devLogin';

// Équivalent du GET /dev-login de Saint Gym : une simple navigation vers
// cette route authentifie avec le compte de test, sans passer par un champ
// de saisie. Inerte hors dev (getDevLoginCredentials renvoie null) — dans ce
// cas comme en cas d'échec, on retombe simplement sur /login.
export default function DevLogin() {
  const { signIn, session } = useAuth();
  const [failed, setFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (session || attempted.current) return;
    attempted.current = true;
    let cancelled = false;
    getDevLoginCredentials().then(async (creds) => {
      if (!creds) {
        if (!cancelled) setFailed(true);
        return;
      }
      const { error } = await signIn(creds.email, creds.password);
      if (!cancelled && error) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [session, signIn]);

  if (session) return <Navigate to="/" replace />;
  if (failed) return <Navigate to="/login" replace />;
  return <div className="flex h-screen items-center justify-center bg-ink-900 text-champagne">Connexion dev…</div>;
}

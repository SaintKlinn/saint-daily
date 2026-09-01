import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import LogoMark from '../components/LogoMark';

export default function Login() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devCredentials, setDevCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    // AuthGate a mémorisé l'écran visé au moment où la session a expiré
    // (voir App.tsx) : on y retourne au lieu de retomber sur l'accueil.
    const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
    navigate(from ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true });
  }, [session, navigate, location]);

  useEffect(() => {
    // window.api est absent hors Electron (ex: cet onglet de prévisualisation
    // pointé directement sur le serveur Vite) — dégrade silencieusement vers
    // "pas de connexion dev" plutôt que de planter l'écran.
    window.api
      ?.getDevLoginCredentials?.()
      .then(setDevCredentials)
      .catch(() => setDevCredentials(null));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  }

  async function handleDevLogin() {
    if (!devCredentials) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(devCredentials.email, devCredentials.password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-ink-900">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4 border border-ink-700 bg-ink-800 p-8">
        <div className="flex items-center gap-3">
          <LogoMark size={32} />
          <h1 className="font-serif text-xl text-champagne">Saint Daily</h1>
        </div>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-ink-700 bg-ink-700 px-3 py-2 text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-ink-700 bg-ink-700 px-3 py-2 text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2 font-sans font-semibold text-ink-900 disabled:opacity-60"
        >
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
        {devCredentials && (
          <button
            type="button"
            onClick={handleDevLogin}
            disabled={submitting}
            className="border border-ink-700 px-4 py-2 font-sans text-sm text-muted hover:text-champagne disabled:opacity-60"
          >
            Connexion dev ({devCredentials.email})
          </button>
        )}
      </form>
    </div>
  );
}

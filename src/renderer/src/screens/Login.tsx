import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getDevLoginCredentials } from '../lib/devLogin';
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
    getDevLoginCredentials().then(setDevCredentials);
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
    <div
      className="flex h-screen flex-col items-center justify-center gap-8 bg-ink-950 px-6"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 900px 500px at 50% 8%, rgba(231, 185, 78, 0.07), transparent 70%)',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <LogoMark width={92} height={61} animated />
        <h1 className="font-serif text-2xl text-champagne">Saint Daily</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4 border border-ink-700 bg-ink-900 p-9">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans text-[15px] normal-case tracking-normal text-champagne outline-none focus:border-accent-bright"
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-bright px-4 py-2.5 font-sans font-semibold text-ink-900 hover:bg-accent-hover disabled:opacity-60"
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

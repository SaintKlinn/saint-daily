import { Link } from 'react-router-dom';
import LogoMark from '../components/LogoMark';

export default function Introuvable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-champagne">
      <LogoMark size={80} className="opacity-30" animated />
      <h1 className="font-serif text-[32px] text-champagne">Introuvable</h1>
      <p className="max-w-[360px] text-center text-sm leading-relaxed text-muted">
        Ce skill n'existe plus, ou a été supprimé. Le lien qui vous a mené ici n'est plus valide.
      </p>
      <Link to="/" className="mt-1 bg-accent-bright px-5 py-3 font-sans text-sm font-semibold text-ink-900 hover:bg-accent-hover">
        Retour à l'accueil
      </Link>
    </div>
  );
}

import { Link } from 'react-router-dom';
import LogoMark from '../components/LogoMark';

export default function Introuvable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-champagne">
      <LogoMark size={48} />
      <p className="font-serif text-xl">Introuvable</p>
      <p className="text-sm text-muted">Ce skill ou cette page n'existe plus.</p>
      <Link to="/" className="text-accent-bright underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}

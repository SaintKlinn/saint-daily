import { useEffect, useState } from 'react';
import type { AutoUpdateState } from '../env';
import Button from './Button';
import LogoMark from './LogoMark';

// Le délai avant le redémarrage réel laisse le temps au tracé du LogoMark
// de se terminer (1s d'animation + jusqu'à 0.4s de décalage par rayon, voir
// index.css/logoRays.ts) — sans ça la fenêtre se fermerait en pleine
// révélation, un geste de marque tronqué au lieu d'un vrai moment.
const RESTART_TRANSITION_MS = 1500;

type Phase = 'hidden' | 'available' | 'downloading' | 'downloaded';

// Bandeau permanent une fois une mise à jour détectée : reste affiché à
// travers toutes les étapes (dispo → téléchargement → prête) jusqu'au
// redémarrage effectif — jamais d'option "plus tard" (voir spec). 'idle' et
// 'checking' n'y touchent jamais une fois `phase` avancée, sinon le
// bandeau clignoterait à chaque re-vérification périodique (toutes les 4h)
// tant que l'utilisateur n'a pas terminé la mise à jour en cours.
export default function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [version, setVersion] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [restarting, setRestarting] = useState(false);

  useEffect(
    () =>
      window.api?.autoUpdate?.onStatus?.((state: AutoUpdateState) => {
        if (state.version) setVersion(state.version);
        if (state.status === 'available') setPhase('available');
        else if (state.status === 'downloading') {
          setPhase('downloading');
          setPercent(state.percent ?? 0);
        } else if (state.status === 'downloaded') setPhase('downloaded');
        else if (state.status === 'error') {
          // Toujours suite à un clic explicite (télécharger/redémarrer) —
          // contrairement à une erreur de vérification en fond, l'utilisateur
          // doit voir que ça n'a pas marché et pouvoir réessayer.
          setPhase((p) => (p === 'hidden' ? 'hidden' : 'available'));
        }
      }),
    []
  );

  function handleRestart() {
    setRestarting(true);
    setTimeout(() => window.api?.autoUpdate?.installNow?.(), RESTART_TRANSITION_MS);
  }

  if (restarting) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-950"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 900px 500px at 50% 8%, rgba(231, 185, 78, 0.07), transparent 70%)',
        }}
      >
        <LogoMark width={92} height={61} animated />
        <p className="font-serif text-lg text-champagne">Mise à jour en cours…</p>
      </div>
    );
  }

  if (phase === 'hidden') return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-accent-bright/35 bg-ink-800 px-6 py-3">
      {phase === 'available' && (
        <>
          <p className="font-sans text-sm text-champagne">
            {version ? `Version ${version} disponible.` : 'Une mise à jour est disponible.'}
          </p>
          <Button variant="accent-outline" size="sm" onClick={() => window.api?.autoUpdate?.downloadNow?.()}>
            Télécharger
          </Button>
        </>
      )}
      {phase === 'downloading' && (
        <div className="flex-1">
          <p className="mb-1.5 font-sans text-sm text-champagne">
            Téléchargement de la mise à jour… {Math.round(percent)} %
          </p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-accent-bright transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}
      {phase === 'downloaded' && (
        <>
          <p className="font-sans text-sm text-champagne">Mise à jour prête — redémarrer pour l'appliquer.</p>
          <Button variant="accent-outline" size="sm" onClick={handleRestart}>
            Redémarrer maintenant
          </Button>
        </>
      )}
    </div>
  );
}

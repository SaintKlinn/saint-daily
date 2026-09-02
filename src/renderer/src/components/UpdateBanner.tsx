import { useEffect, useState } from 'react';
import type { AutoUpdateStatus } from '../env';

// Le seul état qui produit une UI visible est 'downloaded' — voir spec,
// "jamais de redémarrage forcé sans action de l'utilisateur". Les autres
// statuts (checking/downloading/idle/error) restent silencieux par
// conception, pas un oubli.
export default function UpdateBanner() {
  const [status, setStatus] = useState<AutoUpdateStatus>('idle');

  useEffect(() => window.api?.autoUpdate?.onStatus?.(setStatus), []);

  if (status !== 'downloaded') return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-accent-bright/35 bg-ink-800 px-6 py-3">
      <p className="font-sans text-sm text-champagne">Mise à jour disponible — redémarrer pour l'appliquer.</p>
      <button
        onClick={() => window.api?.autoUpdate?.installNow?.()}
        className="border border-accent-bright px-4 py-1.5 font-sans text-sm font-semibold text-accent-bright hover:bg-accent-bright hover:text-ink-900"
      >
        Redémarrer maintenant
      </button>
    </div>
  );
}

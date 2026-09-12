import { useEffect, useRef, useState } from 'react';

interface BoutonSuppressionProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  busy?: boolean;
}

// Le bouton s'arme au premier clic et se désarme seul : un bouton laissé
// en position « Confirmer ? » deviendrait un piège pour le clic distrait
// qui suit, plusieurs minutes plus tard.
const ARM_TIMEOUT_MS = 4000;

// Classes écrites en entier par état plutôt que composées avec
// `buttonClassName` : deux utilitaires Tailwind concurrents (`text-muted`
// et `text-danger`) dans la même liste ont un gagnant décidé par l'ordre
// de la feuille générée, pas par l'ordre d'écriture — donc on n'en met
// jamais deux.
const BASE =
  'inline-flex items-center justify-center gap-2 px-4 py-2 font-sans text-[13px] transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const IDLE = 'border border-ink-700 text-muted hover:text-champagne';
const ARMED = 'border border-danger font-semibold text-danger';

export default function BoutonSuppression({
  onConfirm,
  label = 'Supprimer',
  confirmLabel = 'Confirmer ?',
  busy = false,
}: BoutonSuppressionProps) {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  function handleClick() {
    if (armed) {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timeoutRef.current = window.setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      // Le changement de libellé est la vraie information ; `aria-live`
      // le fait annoncer au lieu de le laisser à la seule couleur.
      aria-live="polite"
      className={`${BASE} ${armed ? ARMED : IDLE}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

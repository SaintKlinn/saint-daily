import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { buttonClassName } from './Button';

/**
 * Les actions rares d'une fiche (archiver, supprimer), rangées derrière un
 * bouton « … » : elles avaient le même poids que l'action qu'on vient faire,
 * et l'avertissement de suppression restait affiché en permanence (audit
 * graphique, M1).
 *
 * Un panneau qui se déplie, pas un menu ARIA à flèches : il contient un
 * bouton à confirmation et un texte, que le modèle « menu » ne décrit pas.
 * Échap et un clic à côté le referment ; Échap rend le focus au bouton.
 */
export default function MenuActions({ children, libelle = "Plus d'actions" }: { children: ReactNode; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const idPanneau = useId();

  useEffect(() => {
    if (!ouvert) return;
    function onPointerDown(e: PointerEvent) {
      if (!racineRef.current?.contains(e.target as Node)) setOuvert(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOuvert(false);
      boutonRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ouvert]);

  return (
    <div ref={racineRef} className="relative">
      <button
        ref={boutonRef}
        type="button"
        aria-label={libelle}
        title={libelle}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((o) => !o)}
        className={buttonClassName('secondary', 'sm', 'px-3 tracking-[0.2em]')}
      >
        …
      </button>
      {ouvert && (
        <div
          id={idPanneau}
          className="absolute right-0 top-full z-20 mt-2 flex w-72 flex-col items-stretch gap-3 border border-ink-700 bg-ink-900 p-4 shadow-2xl"
        >
          {children}
        </div>
      )}
    </div>
  );
}

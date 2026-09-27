import { useRef, useState } from 'react';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

/**
 * Un champ qui s'enregistre au blur, extrait de la `NotesSection` de
 * `DetailSkill` pour servir aussi les trois champs d'un projet.
 *
 * L'appelant le monte avec une `key` liée à l'engagement (`key={project.id}`) :
 * l'état local est ainsi réinitialisé quand on passe d'un engagement à un
 * autre sans démontage, ce que la route `projets/:id` fait.
 */
export default function ChampSauvegarde({
  valeur,
  onSave,
  lignes,
  ariaLabel,
  placeholder,
  confirmation,
  autoFocus,
}: {
  valeur: string;
  onSave: (valeur: string | null) => Promise<{ error: string | null }>;
  lignes?: number;
  ariaLabel: string;
  placeholder?: string;
  confirmation: string;
  autoFocus?: boolean;
}) {
  const [saisie, setSaisie] = useState(valeur);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Des refs et non la prop `valeur` : cliquer sur « Enregistrer » déclenche
  // d'abord le blur du champ, donc deux appels rapprochés avant que la prop
  // rafraîchie ne revienne. Ces deux refs rendent le second no-op au lieu
  // d'écrire deux fois la même valeur.
  const persistedRef = useRef(valeur);
  const inFlightRef = useRef(false);

  async function enregistrer() {
    const suivant = saisie.trim() ? saisie : null;
    const suivantTexte = suivant ?? '';
    if (inFlightRef.current || persistedRef.current === suivantTexte) return;
    inFlightRef.current = true;
    setStatus('saving');
    setError(null);
    const { error: saveError } = await onSave(suivant);
    inFlightRef.current = false;
    if (saveError) {
      setStatus('idle');
      // La saisie reste dans le champ — pas de perte, retry manuel.
      setError(saveError);
      return;
    }
    persistedRef.current = suivantTexte;
    setStatus('saved');
  }

  const classes = `border border-ink-700 bg-ink-900 px-3 py-2 text-corps text-champagne placeholder:text-muted ${FOCUS_RING}`;

  return (
    <div className="flex flex-col gap-2">
      {lignes === undefined ? (
        <input
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setStatus('idle');
          }}
          onBlur={enregistrer}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={classes}
        />
      ) : (
        <textarea
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setStatus('idle');
          }}
          onBlur={enregistrer}
          rows={lignes}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={classes}
        />
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={enregistrer} disabled={status === 'saving'}>
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {status === 'saved' && <span className="text-corps text-muted">{confirmation}</span>}
      </div>
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

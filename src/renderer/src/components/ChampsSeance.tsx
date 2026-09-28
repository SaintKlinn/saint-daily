import { useId, useMemo } from 'react';
import { DUREES_RAPIDES, HUMEURS, MOOD_LABELS, raccourcisQuand } from '../lib/seances';
import type { Mood } from '../lib/types';

// Les contrôles d'une séance, partagés par la saisie (Nouvelle entrée) et
// la correction (éditeur de séance) : les deux formulaires décrivaient la
// même chose avec des contrôles différents (audit graphique, M9). Des puces
// pour les choix courants, un champ pour le reste.

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

function classePuce(active: boolean): string {
  return `px-3 py-2 font-data text-secondaire normal-case tracking-normal transition-colors duration-150 ${FOCUS_RING} ${
    active ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'
  }`;
}

function Libelle({ id, children }: { id: string; children: string }) {
  return (
    <span id={id} className="text-libelle uppercase tracking-[0.04em] text-muted">
      {children}
    </span>
  );
}

/**
 * Quand la séance a eu lieu. `valeur` vide veut dire « maintenant » ; sinon
 * c'est la valeur d'un champ `datetime-local`.
 */
export function ChoixQuand({ valeur, onChange }: { valeur: string; onChange: (valeur: string) => void }) {
  const id = useId();
  const raccourcis = useMemo(() => raccourcisQuand(), []);
  const autre = valeur !== '' && !raccourcis.some((r) => r.valeur === valeur);
  return (
    <div className="flex flex-col gap-2">
      <Libelle id={id}>Quand</Libelle>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={valeur === ''} onClick={() => onChange('')} className={classePuce(valeur === '')}>
          Maintenant
        </button>
        {raccourcis.map((r) => (
          <button
            key={r.libelle}
            type="button"
            aria-pressed={valeur === r.valeur}
            onClick={() => onChange(r.valeur)}
            className={classePuce(valeur === r.valeur)}
          >
            {r.libelle}
          </button>
        ))}
        <input
          type="datetime-local"
          value={autre ? valeur : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Autre date et heure"
          className={`border px-3 py-1.5 font-data text-secondaire text-champagne [color-scheme:dark] ${FOCUS_RING} ${
            autre ? 'border-accent-bright bg-ink-800' : 'border-ink-700 bg-ink-800'
          }`}
        />
      </div>
    </div>
  );
}

/** La durée en minutes : des puces pour les durées courantes, un champ pour le reste. */
export function ChoixDuree({ valeur, onChange }: { valeur: string; onChange: (valeur: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Libelle id={id}>Durée</Libelle>
      <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-2">
        {DUREES_RAPIDES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={valeur === String(minutes)}
            onClick={() => onChange(String(minutes))}
            className={classePuce(valeur === String(minutes))}
          >
            {minutes} min
          </button>
        ))}
        <label className="flex items-baseline gap-2 border border-ink-700 bg-ink-800 px-3 py-1.5">
          <input
            type="number"
            min={0}
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Durée en minutes"
            className={`w-14 bg-transparent font-data text-secondaire text-champagne ${FOCUS_RING}`}
          />
          <span className="font-sans text-secondaire text-muted">min</span>
        </label>
      </div>
    </div>
  );
}

/** L'humeur, optionnelle : cliquer sur la puce choisie la retire. */
export function ChoixHumeur({ valeur, onChange }: { valeur: Mood | ''; onChange: (valeur: Mood | '') => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Libelle id={id}>Humeur (optionnelle)</Libelle>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {HUMEURS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={valeur === h}
            onClick={() => onChange(valeur === h ? '' : h)}
            className={classePuce(valeur === h)}
          >
            {MOOD_LABELS[h]}
          </button>
        ))}
      </div>
    </div>
  );
}

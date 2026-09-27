import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { EngagementMilestone } from '../lib/types';
import { CheckIcon } from './icons';
import Button from './Button';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// La géométrie de la case est une exception assumée aux sept crans
// d'espacement, au même titre que le `gap-10` du rail : ce n'est pas un
// rythme, c'est une dérivation. La marge négative vaut −(rembourrage du
// `<ul>` + moitié de la case) et centre la case sur le trait vertical ;
// les quatre valeurs d'un préréglage bougent donc ENSEMBLE. Le dépôt s'est
// déjà trompé en changeant le rembourrage sans la marge, et la case s'est
// décalée de 2 px. Les réunir ici est la raison d'être de ce préréglage.
const TAILLES = {
  compacte: { case: 'h-[16px] w-[16px]', marge: '-ml-[24px]', icone: 10, ecart: 'gap-2' },
  normale: { case: 'h-[18px] w-[18px]', marge: '-ml-[25px]', icone: 11, ecart: 'gap-3' },
} as const;

/**
 * La liste de jalons de l'application — une seule, pour les trois écrans
 * qui en portent une.
 *
 * Elle ne rend pas de titre : une étiquette de champ dans un popover et un
 * titre de section de page ne sont pas la même chose, et les paramétrer
 * aurait déplacé la divergence dans une prop au lieu de la supprimer.
 * L'appelant rend le sien, dans le style de son contexte.
 *
 * La célébration vit ici, avec son état : le composant sait de lui-même à
 * quel instant une case passe à cochée, et la lui confier a retiré de
 * `DetailSkill` un état, un timeout et son nettoyage au démontage.
 */
export default function MilestoneChecklist({
  milestones,
  onToggle,
  onAdd,
  error,
  taille = 'compacte',
}: {
  milestones: EngagementMilestone[];
  onToggle: (id: string, completed: boolean) => Promise<{ error: string | null }>;
  onAdd: (label: string) => Promise<{ error: string | null }>;
  error: string | null;
  taille?: keyof typeof TAILLES;
}) {
  const t = TAILLES[taille];
  const [celebre, setCelebre] = useState<string | null>(null);
  // Posé dans un gestionnaire d'événement, pas dans un effet : aucune
  // fonction de nettoyage n'est rendue là. On garde donc l'id du timeout
  // pour pouvoir l'annuler, au démontage pendant la pulsation comme
  // lorsque deux jalons sont cochés coup sur coup.
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function basculer(id: string, completed: boolean) {
    const { error: toggleError } = await onToggle(id, completed);
    // On ne célèbre que ce qui a réellement été écrit, et jamais un
    // décochage.
    if (toggleError || !completed) return;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setCelebre(id);
    timeoutRef.current = window.setTimeout(() => {
      setCelebre((actuel) => (actuel === id ? null : actuel));
      timeoutRef.current = null;
    }, 400);
  }

  return (
    <div className="relative flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-0 border-l border-ink-700 pl-4">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center py-2">
              <label className={`flex cursor-pointer items-center ${t.ecart}`}>
                <span className={`relative ${t.marge} ${t.case} flex shrink-0 items-center justify-center`}>
                  <input
                    type="checkbox"
                    checked={!!m.completedAt}
                    onChange={(e) => basculer(m.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`absolute inset-0 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${m.completedAt ? 'bg-accent-bright text-ink-900' : 'border-[1.5px] border-muted'}`}
                  >
                    {m.completedAt && <CheckIcon size={t.icone} />}
                  </span>
                  {celebre === m.id && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-accent-bright"
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 2.2 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </span>
                <span className={`text-corps ${m.completedAt ? 'text-muted line-through' : 'text-champagne'}`}>
                  {m.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <NewMilestoneForm onAdd={onAdd} />
    </div>
  );
}

function NewMilestoneForm({ onAdd }: { onAdd: (label: string) => Promise<{ error: string | null }> }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        setSubmitting(true);
        setError(null);
        const { error: addError } = await onAdd(label);
        setSubmitting(false);
        if (addError) {
          setError(addError);
          return;
        }
        input.value = '';
      }}
      className="mt-1 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          name="label"
          aria-label="Nouveau jalon"
          placeholder="Nouveau jalon"
          disabled={submitting}
          className={`flex-1 border border-ink-700 bg-ink-900 px-3 py-1 text-secondaire text-champagne placeholder:text-muted ${FOCUS_RING}`}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

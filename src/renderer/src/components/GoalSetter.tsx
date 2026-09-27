// Extrait de DetailSkill pour servir aussi l'écran d'un projet : les trois
// champs d'objectif vivent sur TOUT engagement, et un projet en porte un
// aussi légitimement qu'un skill. Le dupliquer aurait créé deux formulaires
// à tenir en phase, sans qu'aucun des deux écrans n'ait de raison de diverger.

import { useState } from 'react';
import Button from './Button';
import type { GoalMetric, GoalPeriod } from '../lib/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function GoalSetter({
  onSubmit,
}: {
  onSubmit: (patch: { goalPeriod: GoalPeriod; goalMetric: GoalMetric; goalTarget: number }) => Promise<unknown>;
}) {
  const [period, setPeriod] = useState<GoalPeriod>('hebdomadaire');
  const [metric, setMetric] = useState<GoalMetric>('seances');
  const [target, setTarget] = useState('3');
  const [submitting, setSubmitting] = useState(false);

  const goalTarget = Number(target);
  // Un champ vide (`Number('') === 0`) ou une saisie non numérique donnent
  // toutes deux `goalTarget <= 0` ou `NaN` : le bouton se désactive plutôt
  // que de rester cliquable pour ne rien faire.
  const targetIsValid = Number.isFinite(goalTarget) && goalTarget > 0;

  async function handleSubmit() {
    if (!targetIsValid) return;
    setSubmitting(true);
    await onSubmit({ goalPeriod: period, goalMetric: metric, goalTarget });
    setSubmitting(false);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-libelle uppercase tracking-[0.04em] text-muted">
        Période
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
          aria-label="Période de l'objectif"
          className={`border border-ink-700 bg-ink-800 px-3 py-2 font-sans normal-case tracking-normal text-corps text-champagne ${FOCUS_RING}`}
        >
          <option value="hebdomadaire">Hebdomadaire</option>
          <option value="mensuel">Mensuel</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-libelle uppercase tracking-[0.04em] text-muted">
        Métrique
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as GoalMetric)}
          aria-label="Métrique de l'objectif"
          className={`border border-ink-700 bg-ink-800 px-3 py-2 font-sans normal-case tracking-normal text-corps text-champagne ${FOCUS_RING}`}
        >
          <option value="seances">Séances</option>
          <option value="heures">Heures</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-libelle uppercase tracking-[0.04em] text-muted">
        Cible
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Cible de l'objectif"
          aria-invalid={!targetIsValid}
          className={`w-20 border border-ink-700 bg-ink-800 px-3 py-2 font-data text-corps text-champagne ${FOCUS_RING}`}
        />
      </label>
      <Button type="button" variant="secondary" size="sm" onClick={handleSubmit} disabled={submitting || !targetIsValid}>
        Définir l'objectif
      </Button>
    </div>
  );
}

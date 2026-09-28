import type { AriaAttributes } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_SORTIE } from '../theme/mouvement';

// Rail de proportion partagé — extrait parce que l'app en avait trois
// versions divergentes (GoalProgress, BarreRepartition, UpdateBanner), dont
// deux illisibles, et qu'un quatrième usage aurait inventé une quatrième
// variante. Même raison que l'extraction de Button/FormField/EmptyState.
//
// Contrastes (luminance relative WCAG 2.x, formule validée en reproduisant
// les ratios déjà documentés dans theme/colors.ts) :
//
//   Le remplissage est la seule chose qui porte une donnée, donc c'est
//   `accent-bright` sur `ink-950` qui doit être franc : 9.09:1.
//
//   Les deux anciennes pistes échouaient, chacune à un bout :
//     `ink-700` (GoalProgress, UpdateBanner) ne se voyait pas du tout sur
//     son fond — 1.46:1 sur ink-900, 1.14:1 sur ink-800 — donc on ne
//     percevait pas l'étendue du rail, et sans étendue une proportion ne
//     veut rien dire.
//     `muted` (BarreRepartition) réglait ça (4.57:1 sur ink-800) mais
//     laissait le remplissage or à 1.10:1 SUR CETTE PISTE : la piste
//     devenait visible et la donnée invisible. Le pire des deux.
//
//   `ink-950` est un puits en retrait (2.18:1 sur ink-800, 1.72:1 sur
//   ink-900), bordé d'`ink-700` : exactement le motif « puits délimité »
//   déjà retenu pour les anciens blocs de SemaineVsSemaine et pour le niveau 0 de
//   la heatmap. Comme eux, la piste ne porte aucune donnée — elle dit
//   « vide mais existant » — et n'est donc pas soumise au seuil 3:1 de
//   WCAG 1.4.11 ; seul son contraste avec le remplissage l'est.
const PISTE = 'h-2 w-full border border-ink-700 bg-ink-950';

export default function BarreProgression({
  ratio,
  className = '',
  ...aria
}: { ratio: number; className?: string } & AriaAttributes & { role?: string }) {
  // Borné ici plutôt que chez chaque appelant : un objectif dépassé donne
  // un ratio > 1, et une largeur de 140 % déborderait du puits.
  const largeur = Math.min(100, Math.max(0, ratio * 100));
  const reduire = useReducedMotion();
  return (
    <div {...aria} className={`${PISTE} ${className}`.trim()}>
      {/* Se remplit depuis zéro à l'apparition, puis suit la donnée : la
          même transition couvre UpdateBanner, où la largeur change en
          continu pendant un téléchargement, et les répartitions du Bilan,
          où elle ne bouge qu'au changement de données.
          `reducedMotion="user"` (App.tsx) ne coupe QUE les transformations
          et le layout : une largeur s'animerait encore. D'où la vérification
          explicite, qui pose la barre à sa valeur sans transition. */}
      <motion.div
        className="h-full bg-accent-bright"
        initial={reduire ? false : { width: 0 }}
        animate={{ width: `${largeur}%` }}
        transition={reduire ? { duration: 0 } : { duration: 0.6, ease: EASE_SORTIE }}
      />
    </div>
  );
}

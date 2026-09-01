import { colors } from '../theme/colors';
import { VARIANTS } from './RayCorner';

// Même coordonnées que RayCorner variante 4, mais rendu bien plus large que
// le rail (72px) et positionné pour que sa base — le point de convergence
// des rayons — tombe sous le bord du rail, tronquée par son
// overflow-hidden : on ne doit voir que les rayons monter, jamais leur
// origine (retour utilisateur sur la V3 du dashboard, voir maquette
// saint-daily-accueil-v3).
export default function RailFlare() {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 w-[480px] -translate-x-1/2"
      style={{ bottom: '-62px' }}
      viewBox="0 0 140 100"
      aria-hidden="true"
    >
      <g stroke={colors.accent.mid} strokeWidth="1" strokeLinecap="round">
        {VARIANTS[4].lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeOpacity={l.o} />
        ))}
      </g>
    </svg>
  );
}

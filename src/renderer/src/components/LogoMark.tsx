import type { CSSProperties } from 'react';
import { LOGO_RAYS, LOGO_VIEWBOX } from '../theme/logoRays';
import { colors } from '../theme/colors';

const CENTER_INDEX = (LOGO_RAYS.length - 1) / 2;

export default function LogoMark({
  size = 30,
  width,
  height,
  className,
  animated = false,
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  /** Révélation ponctuelle au montage (écran de connexion) : chaque trait
   *  se dessine du centre vers sa longueur réelle, décalé par sa distance
   *  à l'axe central, puis reste à son opacité cible. Même technique que
   *  Saint Gym (globals.css, logo-ray-grow) mais sans boucle infinie —
   *  ici c'est un geste d'ouverture ponctuel, pas un indicateur de
   *  chargement. strokeLinecap rond plutôt que net : un trait qui
   *  grandit a besoin d'un bout doux, sinon il paraît tronqué en cours
   *  de dessin. */
  animated?: boolean;
}) {
  const vb = `${LOGO_VIEWBOX.minX} ${LOGO_VIEWBOX.minY} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
  return (
    <svg width={width ?? size} height={height ?? size} viewBox={vb} className={className} aria-hidden="true">
      <g stroke={colors.accent.bright} strokeWidth="2.4" strokeLinecap={animated ? 'round' : 'butt'}>
        {LOGO_RAYS.map((r, i) =>
          animated ? (
            <line
              key={i}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              className="logo-ray-reveal"
              style={
                {
                  strokeDasharray: Math.hypot(r.x2 - r.x1, r.y2 - r.y1),
                  '--len': Math.hypot(r.x2 - r.x1, r.y2 - r.y1),
                  '--o': r.o,
                  '--delay': `${Math.abs(i - CENTER_INDEX) * 0.05}s`,
                } as CSSProperties
              }
            />
          ) : (
            <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeOpacity={r.o} />
          )
        )}
      </g>
    </svg>
  );
}

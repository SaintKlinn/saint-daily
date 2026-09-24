import type { CSSProperties } from 'react';
import { LOGO_RAYS, LOGO_VIEWBOX } from '../theme/logoRays';
import { colors } from '../theme/colors';

const CENTER_INDEX = (LOGO_RAYS.length - 1) / 2;

export default function LogoMark({
  size = 30,
  width,
  height,
  className,
  animation,
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  /** `'revelation'` — geste d'ouverture ponctuel : chaque trait se dessine
   *  du centre vers sa longueur réelle, décalé par sa distance à l'axe,
   *  puis reste à son opacité cible. Écrans de connexion, d'erreur et
   *  bannière de mise à jour.
   *
   *  `'boucle'` — le rail, en vue permanente : tous les traits poussent
   *  ensemble puis se rétractent, sans fin. Portée de Saint Gym.
   *
   *  Une union plutôt que deux booléens : deux drapeaux qui s'excluent
   *  seraient un état illégal représentable.
   *
   *  `strokeLinecap` rond dans les deux cas : un trait qui grandit a besoin
   *  d'un bout doux, sinon il paraît tronqué en cours de dessin. */
  animation?: 'revelation' | 'boucle';
}) {
  const vb = `${LOGO_VIEWBOX.minX} ${LOGO_VIEWBOX.minY} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
  return (
    <svg width={width ?? size} height={height ?? size} viewBox={vb} className={className} aria-hidden="true">
      <g
        stroke={colors.accent.bright}
        strokeWidth="2.4"
        strokeLinecap={animation ? 'round' : 'butt'}
      >
        {LOGO_RAYS.map((r, i) => {
          if (!animation) {
            return <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeOpacity={r.o} />;
          }
          const longueur = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
          return (
            <line
              key={i}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              className={animation === 'boucle' ? 'logo-ray-grow' : 'logo-ray-reveal'}
              style={
                {
                  strokeDasharray: longueur,
                  '--len': longueur,
                  '--o': r.o,
                  // Le décalage par trait n'existe que pour la révélation :
                  // la boucle est simultanée par choix, arbitré côté Saint
                  // Gym où la variante décalée a été testée puis écartée.
                  ...(animation === 'revelation'
                    ? { '--delay': `${Math.abs(i - CENTER_INDEX) * 0.05}s` }
                    : {}),
                } as CSSProperties
              }
            />
          );
        })}
      </g>
    </svg>
  );
}

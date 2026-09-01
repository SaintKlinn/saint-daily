import { LOGO_RAYS, LOGO_VIEWBOX } from '../theme/logoRays';
import { colors } from '../theme/colors';

export default function LogoMark({
  size = 30,
  width,
  height,
  className,
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  const vb = `${LOGO_VIEWBOX.minX} ${LOGO_VIEWBOX.minY} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
  return (
    <svg width={width ?? size} height={height ?? size} viewBox={vb} className={className} aria-hidden="true">
      <g stroke={colors.accent.bright} strokeWidth="2.4" strokeLinecap="butt">
        {LOGO_RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} strokeOpacity={r.o} />
        ))}
      </g>
    </svg>
  );
}

import { colors } from '../theme/colors';

// Anneau de progression (maquettes : Accueil/Liste) — se remplit à mesure
// qu'on approche de la pratique, se vide vers le seuil de rappel. `filled`
// est déjà calculé par l'appelant (0 = dû, 1 = pratiqué aujourd'hui).
export default function ProgressRing({
  size,
  radius,
  strokeWidth = 3,
  filled,
}: {
  size: number;
  radius: number;
  strokeWidth?: number;
  filled: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, filled));
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={center} cy={center} r={radius} fill="none" stroke={colors.ink[700]} strokeWidth={strokeWidth} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={colors.accent.bright}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}

/** 1 = pratiqué aujourd'hui, 0 = au seuil de rappel ou au-delà, jamais négatif. */
export function ringFillFromDaysSince(daysSince: number | null, reminderThresholdDays: number): number {
  if (daysSince === null) return 0;
  if (reminderThresholdDays <= 0) return daysSince === 0 ? 1 : 0;
  return Math.max(0, 1 - daysSince / reminderThresholdDays);
}

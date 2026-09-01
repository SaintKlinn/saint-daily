import { colors } from '../theme/colors';

// Rayons du logo en filigrane, posés en coin des blocs qu'on veut
// distinguer légèrement (cartes de stat, moments notables). Même
// technique et mêmes coordonnées que RayCorner dans Saint Gym — 5
// variantes procédurales (coin, nombre de traits, ouverture, portée)
// plutôt qu'un seul motif recopié partout, pensées pour alterner sur une
// grille et donner un vrai rythme plutôt qu'un tampon répété. La carte
// parente doit être `relative overflow-hidden` et son contenu texte doit
// passer en `relative` pour rester au-dessus.
const VARIANTS = {
  0: {
    position: '-top-2 -right-2',
    lines: [
      { x1: 130.1, y1: 21.7, x2: 135.8, y2: 43.0, o: 0.16 },
      { x1: 128.8, y1: 22.0, x2: 132.3, y2: 57.8, o: 0.22 },
      { x1: 127.5, y1: 22.0, x2: 124.3, y2: 71.9, o: 0.29 },
      { x1: 126.2, y1: 21.8, x2: 121.3, y2: 43.2, o: 0.35 },
      { x1: 125.0, y1: 21.4, x2: 111.3, y2: 54.7, o: 0.42 },
      { x1: 123.8, y1: 20.8, x2: 97.6, y2: 63.4, o: 0.48 },
      { x1: 122.8, y1: 20.0, x2: 108.3, y2: 36.6, o: 0.54 },
      { x1: 121.8, y1: 19.1, x2: 94.1, y2: 42.1, o: 0.61 },
      { x1: 121.1, y1: 18.0, x2: 77.9, y2: 43.3, o: 0.61 },
      { x1: 120.5, y1: 16.9, x2: 100.0, y2: 24.8, o: 0.54 },
      { x1: 120.2, y1: 15.6, x2: 84.9, y2: 22.9, o: 0.48 },
      { x1: 120.0, y1: 14.3, x2: 70.0, y2: 16.4, o: 0.42 },
      { x1: 120.1, y1: 13.0, x2: 98.2, y2: 10.3, o: 0.35 },
      { x1: 120.3, y1: 11.8, x2: 85.8, y2: 1.6, o: 0.29 },
      { x1: 120.8, y1: 10.5, x2: 75.7, y2: -11.1, o: 0.22 },
      { x1: 121.4, y1: 9.4, x2: 103.4, y2: -3.2, o: 0.16 },
    ],
  },
  1: {
    position: '-bottom-2 -left-2',
    lines: [
      { x1: 11.4, y1: 79.0, x2: 9.7, y2: 60.1, o: 0.14 },
      { x1: 12.5, y1: 79.0, x2: 14.8, y2: 48.1, o: 0.21 },
      { x1: 13.6, y1: 79.2, x2: 23.6, y2: 37.4, o: 0.28 },
      { x1: 14.7, y1: 79.5, x2: 22.0, y2: 62.0, o: 0.34 },
      { x1: 15.7, y1: 80.1, x2: 32.1, y2: 53.7, o: 0.41 },
      { x1: 16.6, y1: 80.7, x2: 44.9, y2: 48.4, o: 0.48 },
      { x1: 17.4, y1: 81.5, x2: 32.0, y2: 69.4, o: 0.55 },
      { x1: 18.0, y1: 82.5, x2: 44.8, y2: 66.8, o: 0.55 },
      { x1: 18.5, y1: 83.5, x2: 58.6, y2: 68.0, o: 0.48 },
      { x1: 18.8, y1: 84.6, x2: 37.4, y2: 80.6, o: 0.41 },
      { x1: 19.0, y1: 85.7, x2: 50.0, y2: 84.2, o: 0.34 },
      { x1: 19.0, y1: 86.8, x2: 61.7, y2: 91.7, o: 0.28 },
      { x1: 18.7, y1: 87.9, x2: 37.0, y2: 93.1, o: 0.21 },
      { x1: 18.3, y1: 89.0, x2: 46.4, y2: 102.1, o: 0.14 },
    ],
  },
  2: {
    position: '-top-2 -left-2',
    lines: [
      { x1: 17.9, y1: 14.8, x2: 33.8, y2: 16.9, o: 0.14 },
      { x1: 17.7, y1: 15.8, x2: 43.6, y2: 23.6, o: 0.22 },
      { x1: 17.4, y1: 16.7, x2: 51.4, y2: 33.6, o: 0.30 },
      { x1: 16.9, y1: 17.5, x2: 29.8, y2: 26.9, o: 0.39 },
      { x1: 16.2, y1: 18.3, x2: 35.1, y2: 37.5, o: 0.47 },
      { x1: 15.4, y1: 18.9, x2: 37.2, y2: 50.0, o: 0.55 },
      { x1: 14.6, y1: 19.4, x2: 21.5, y2: 33.9, o: 0.47 },
      { x1: 13.7, y1: 19.8, x2: 21.1, y2: 45.7, o: 0.39 },
      { x1: 12.7, y1: 20.0, x2: 17.0, y2: 57.7, o: 0.30 },
      { x1: 11.7, y1: 20.0, x2: 10.8, y2: 36.0, o: 0.22 },
      { x1: 10.7, y1: 19.9, x2: 4.9, y2: 46.2, o: 0.14 },
    ],
  },
  3: {
    position: '-bottom-2 -right-2',
    lines: [
      { x1: 121.4, y1: 88.4, x2: 105.4, y2: 94.2, o: 0.15 },
      { x1: 121.1, y1: 87.3, x2: 90.7, y2: 93.1, o: 0.22 },
      { x1: 121.0, y1: 86.2, x2: 76.0, y2: 87.5, o: 0.30 },
      { x1: 121.1, y1: 85.1, x2: 104.2, y2: 82.9, o: 0.38 },
      { x1: 121.3, y1: 84.0, x2: 91.6, y2: 75.1, o: 0.45 },
      { x1: 121.7, y1: 82.9, x2: 81.2, y2: 63.3, o: 0.53 },
      { x1: 122.3, y1: 82.0, x2: 108.3, y2: 72.2, o: 0.60 },
      { x1: 123.0, y1: 81.1, x2: 100.7, y2: 59.5, o: 0.52 },
      { x1: 123.8, y1: 80.4, x2: 96.9, y2: 44.3, o: 0.45 },
      { x1: 124.8, y1: 79.8, x2: 116.9, y2: 64.7, o: 0.38 },
      { x1: 125.8, y1: 79.4, x2: 116.0, y2: 49.9, o: 0.30 },
      { x1: 126.9, y1: 79.1, x2: 119.7, y2: 34.7, o: 0.23 },
      { x1: 128.0, y1: 79.0, x2: 128.0, y2: 62.0, o: 0.15 },
    ],
  },
  4: {
    // Bas-centre : éventail symétrique pointant vers le haut, contenu
    // entre x=42 et x=103 (viewBox 140 de large) pour ne pas déborder
    // vers les voisines de gauche/droite dans une rangée de 3.
    position: '-bottom-5 left-0 right-0',
    lines: [
      { x1: 64.6, y1: 87.5, x2: 50.1, y2: 75.3, o: 0.15 },
      { x1: 65.3, y1: 86.8, x2: 44.7, y2: 63.6, o: 0.22 },
      { x1: 66.2, y1: 86.2, x2: 42.5, y2: 50.2, o: 0.30 },
      { x1: 67.0, y1: 85.7, x2: 59.0, y2: 68.4, o: 0.38 },
      { x1: 68.0, y1: 85.3, x2: 59.1, y2: 55.6, o: 0.45 },
      { x1: 69.0, y1: 85.1, x2: 62.8, y2: 42.5, o: 0.53 },
      { x1: 70.0, y1: 85.0, x2: 70.0, y2: 66.0, o: 0.60 },
      { x1: 71.0, y1: 85.1, x2: 75.5, y2: 54.4, o: 0.52 },
      { x1: 72.0, y1: 85.3, x2: 84.3, y2: 44.1, o: 0.45 },
      { x1: 73.0, y1: 85.7, x2: 81.0, y2: 68.4, o: 0.38 },
      { x1: 73.8, y1: 86.2, x2: 90.9, y2: 60.3, o: 0.30 },
      { x1: 74.7, y1: 86.8, x2: 103.2, y2: 54.6, o: 0.23 },
      { x1: 75.4, y1: 87.5, x2: 89.9, y2: 75.3, o: 0.15 },
    ],
  },
} as const;

export default function RayCorner({
  variant = 0,
  size = 'w-16 h-16',
}: {
  variant?: 0 | 1 | 2 | 3 | 4;
  size?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <svg className={`absolute ${v.position} ${size} pointer-events-none`} viewBox="0 0 140 100" aria-hidden="true">
      <g stroke={colors.accent.mid} strokeWidth="1" strokeLinecap="round">
        {v.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeOpacity={l.o} />
        ))}
      </g>
    </svg>
  );
}

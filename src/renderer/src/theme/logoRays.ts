// Coordonnées du mark Saint Daily. Reprend exactement la technique de
// Saint Gym : une seule moitié + le rayon central, reflétée exactement
// (x -> 128 - x), pas alternée par parité d'index. Ne jamais approximer
// ces valeurs (voir Global Constraints du plan et la spec, section
// "Thème graphique").
export const LOGO_RAYS = [
  { x1: 46.0, y1: 83.7, x2: 38.1, y2: 83.2, o: 0.6 },
  { x1: 35.0, y1: 77.4, x2: 18.6, y2: 73.0, o: 0.68 },
  { x1: 47.8, y1: 77.3, x2: 24.6, y2: 66.2, o: 0.75 },
  { x1: 39.8, y1: 67.3, x2: 12.7, y2: 47.4, o: 0.82 },
  { x1: 51.7, y1: 71.8, x2: 24.1, y2: 42.2, o: 0.88 },
  { x1: 48.0, y1: 59.6, x2: 23.3, y2: 20.5, o: 0.93 },
  { x1: 57.4, y1: 68.3, x2: 38.9, y2: 21.3, o: 0.97 },
  { x1: 58.4, y1: 55.5, x2: 48.5, y2: 3.3, o: 0.99 },
  { x1: 64.0, y1: 67.0, x2: 64.0, y2: 13.0, o: 1.0 },
  { x1: 69.6, y1: 55.5, x2: 79.5, y2: 3.3, o: 0.99 },
  { x1: 70.6, y1: 68.3, x2: 89.1, y2: 21.3, o: 0.97 },
  { x1: 80.0, y1: 59.6, x2: 104.7, y2: 20.5, o: 0.93 },
  { x1: 76.3, y1: 71.8, x2: 103.9, y2: 42.2, o: 0.88 },
  { x1: 88.2, y1: 67.3, x2: 115.3, y2: 47.4, o: 0.82 },
  { x1: 80.2, y1: 77.3, x2: 103.4, y2: 66.2, o: 0.75 },
  { x1: 93.0, y1: 77.4, x2: 109.4, y2: 73.0, o: 0.68 },
  { x1: 82.0, y1: 83.7, x2: 89.9, y2: 83.2, o: 0.6 },
] as const;

export const LOGO_VIEWBOX = { minX: 0, minY: 0, width: 128, height: 85 };

// Génère les icônes de l'app (fenêtre/taskbar/installeur Windows) à partir
// du même dessin que le logo in-app (LogoMark.tsx). Les coordonnées sont
// DUPLIQUÉES ici depuis src/renderer/src/theme/logoRays.ts : un script de
// build Node ne peut pas importer ce module .ts sans outillage
// supplémentaire. logoRays.test.ts garde le fichier source correct (17
// rayons, symétrie) mais NE VÉRIFIE PAS que cette copie reste synchronisée
// — si logoRays.ts change un jour, reporter le changement ici à la main.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'resources');

const LOGO_RAYS = [
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
];

const INK = '#064E3B';
const ACCENT = '#E7B94E';

function buildSvg(size) {
  const lines = LOGO_RAYS.map(
    (r) => `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke-opacity="${r.o}" />`
  ).join('');
  // viewBox carré 128x128 (LOGO_VIEWBOX fait 128x85) : le dessin est
  // centré verticalement par translation, (128-85)/2 = 21.5 — même
  // principe de centrage que celui décrit par l'utilisateur pour les
  // icônes Satori de Saint Gym, en SVG natif ici.
  return `<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="${INK}" />
    <g transform="translate(0, 21.5)" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round">${lines}</g>
  </svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const pngSizes = [16, 32, 48, 64, 128, 256, 512];
  const pngBuffers = await Promise.all(
    pngSizes.map((size) => sharp(Buffer.from(buildSvg(size))).resize(size, size).png().toBuffer())
  );
  await writeFile(join(outDir, 'icon.png'), pngBuffers[pngBuffers.length - 1]);

  const icoSizes = [16, 32, 48, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map((size) => sharp(Buffer.from(buildSvg(size))).resize(size, size).png().toBuffer())
  );
  const ico = await pngToIco(icoBuffers);
  await writeFile(join(outDir, 'icon.ico'), ico);

  console.log(`Icônes générées dans ${outDir} (icon.png, icon.ico)`);
}

main();

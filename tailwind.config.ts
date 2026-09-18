import type { Config } from 'tailwindcss';
import { colors } from './src/renderer/src/theme/colors';
import { fontSize } from './src/renderer/src/theme/typographie';

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    // Hors `extend` : remplacer l'échelle par défaut supprime `text-xs`,
    // `text-sm`, `text-base` et consorts, de sorte qu'un usage résiduel
    // devienne une classe inexistante — visible immédiatement plutôt que
    // silencieusement rendu. C'est ce qui rend la migration vérifiable.
    fontSize: fontSize as unknown as Config['theme']['fontSize'],
    extend: {
      colors: {
        ink: colors.ink,
        champagne: colors.champagne,
        muted: colors.muted,
        accent: colors.accent,
        danger: colors.danger,
        heatmap: colors.heatmap,
      },
      fontFamily: {
        serif: ['"IBM Plex Serif"', 'ui-serif', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';
import { colors } from './src/renderer/src/theme/colors';

const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        champagne: colors.champagne,
        muted: colors.muted,
        accent: colors.accent,
        danger: colors.danger,
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

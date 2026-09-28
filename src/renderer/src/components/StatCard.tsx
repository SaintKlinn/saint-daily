import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import RayCorner from './RayCorner';
import ChiffreAnime from './ChiffreAnime';
import { colors } from '../theme/colors';
import { itemTransition, itemVariants } from '../theme/mouvement';

// Extraite d'Accueil.tsx pour que le Bilan porte ses chiffres clés avec la
// même carte, plutôt qu'une seconde variante qui dériverait de la première.
// Elle reste un enfant de cascade (`itemVariants`) : le parent doit être un
// `motion.*` avec `initial="hidden" animate="visible"`.
export default function StatCard({
  label,
  valeur,
  format,
  detail,
  hero = false,
  rayVariant,
}: {
  label: string;
  valeur: number;
  format?: (valeur: number) => string;
  // Ligne de contexte sous le chiffre (« 4 séances », « record : 12 j »).
  detail?: ReactNode;
  hero?: boolean;
  rayVariant: 0 | 1 | 2 | 3 | 4;
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={itemTransition}
      className={`relative flex flex-col gap-2 overflow-hidden border px-6 py-6 ${hero ? 'border-accent-bright/35' : 'border-ink-700'}`}
      style={{
        background: hero
          ? `linear-gradient(180deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 60%, ${colors.accent.bright}1f 100%)`
          : `linear-gradient(160deg, ${colors.ink[800]} 0%, ${colors.ink[900]} 68%)`,
        boxShadow: `inset 0 1px 0 ${colors.accent.bright}14, 0 18px 34px -26px rgba(0, 0, 0, 0.8)`,
      }}
    >
      <RayCorner variant={rayVariant} />
      <p className="relative flex items-center gap-2 font-data text-libelle uppercase tracking-[0.1em] text-muted">
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{
            background: hero ? colors.accent.bright : colors.accent.mid,
            boxShadow: hero ? `0 0 6px ${colors.accent.bright}` : undefined,
          }}
        />
        {label}
      </p>
      <p
        className={`relative font-serif text-heros [font-variant-numeric:tabular-nums] ${hero ? 'text-accent-bright' : 'text-champagne'}`}
        style={hero ? { textShadow: `0 0 22px ${colors.accent.bright}4d` } : undefined}
      >
        <ChiffreAnime valeur={valeur} format={format} />
      </p>
      {detail && <p className="relative text-secondaire text-muted">{detail}</p>}
    </motion.div>
  );
}

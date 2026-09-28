import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'accent-outline';
type Size = 'md' | 'sm';

const VARIANT_CLASSES: Record<Variant, string> = {
  // Désactivé : un bloc neutre plutôt que le doré à 60 %, qui virait à un
  // olive terne sur le vert (audit graphique, M11).
  primary:
    'bg-accent-bright font-semibold text-ink-900 hover:bg-accent-hover disabled:bg-ink-800 disabled:text-muted disabled:font-normal disabled:hover:bg-ink-800',
  secondary: 'border border-ink-700 text-muted hover:text-champagne',
  'accent-outline': 'border border-accent-bright font-semibold text-accent-bright hover:bg-accent-bright hover:text-ink-900',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'px-6 py-3 text-corps',
  sm: 'px-4 py-2 text-secondaire',
};

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 [&:disabled:not(.bg-accent-bright)]:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// Exportée séparément pour les <Link> react-router, qui ont besoin du même
// style mais ne sont pas des <button> — voir NavLink-style usages.
export function buttonClassName(variant: Variant = 'secondary', size: Size = 'md', className = ''): string {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: { variant?: Variant; size?: Size } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={buttonClassName(variant, size, className)} />;
}

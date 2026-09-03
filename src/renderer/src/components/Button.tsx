import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'accent-outline';
type Size = 'md' | 'sm';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent-bright font-semibold text-ink-900 hover:bg-accent-hover',
  secondary: 'border border-ink-700 text-muted hover:text-champagne',
  'accent-outline': 'border border-accent-bright font-semibold text-accent-bright hover:bg-accent-bright hover:text-ink-900',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'px-5 py-3 text-sm',
  sm: 'px-4 py-2 text-[13px]',
};

const BASE =
  'inline-flex items-center justify-center gap-2 font-sans disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

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

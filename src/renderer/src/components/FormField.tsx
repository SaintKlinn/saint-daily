import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const LABEL = 'flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted';
// focus:outline-none supprime le contour bleu par défaut, focus-visible:ring
// le remplace uniquement pour la navigation clavier (jamais au clic souris)
// — même paire que Toggle.tsx, jusqu'ici jamais reprise sur les champs texte.
const FIELD =
  'border border-ink-700 bg-ink-800 px-3 py-2.5 font-sans normal-case tracking-normal text-champagne placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export function FormField({
  label,
  className = '',
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={LABEL}>
      {label}
      <input {...props} className={`${FIELD} text-[15px] ${className}`.trim()} />
    </label>
  );
}

export function TextAreaField({
  label,
  className = '',
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={LABEL}>
      {label}
      <textarea {...props} className={`${FIELD} text-sm ${className}`.trim()} />
    </label>
  );
}

export function SelectField({
  label,
  className = '',
  children,
  ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={LABEL}>
      {label}
      <select {...props} className={`${FIELD} text-[15px] ${className}`.trim()}>
        {children}
      </select>
    </label>
  );
}

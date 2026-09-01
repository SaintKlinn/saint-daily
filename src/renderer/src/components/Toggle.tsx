// Interrupteur à bascule (maquette Réglages) — checkbox native masquée en
// accessible (sr-only), pas display:none, pour garder focus clavier et
// lecteur d'écran ; le rond stylé n'est que décoratif (audit ui-ux-pro-max).
export default function Toggle({
  checked,
  onChange,
  label,
  description,
  bordered = true,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  bordered?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-4 py-4 ${bordered ? 'border-b border-ink-700 last:border-b-0' : ''}`}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-champagne">{label}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex h-[22px] w-10 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`h-[22px] w-10 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900 ${checked ? 'bg-accent-bright' : 'bg-ink-700'}`}
        />
        <span
          className={`absolute h-[18px] w-[18px] rounded-full transition-transform ${checked ? 'translate-x-[20px] bg-ink-900' : 'translate-x-[2px] bg-muted'}`}
        />
      </span>
    </label>
  );
}

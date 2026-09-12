import { useEffect, useState } from 'react';
import type { AgendaWidgetItem } from '../env';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Ne passe JAMAIS par les hooks de données : cette fenêtre est un pur
// relais d'affichage, comme l'overlay Pomodoro. Un second client Supabase
// rafraîchirait la même session persistée que la fenêtre principale.
export default function AgendaWidget() {
  const [items, setItems] = useState<AgendaWidgetItem[]>([]);

  useEffect(() => window.api?.agenda?.onState?.(setItems), []);

  return (
    <div
      className="flex h-screen w-screen flex-col gap-2 border border-ink-700 bg-ink-900/95 px-4 py-3 [-webkit-app-region:drag]"
      style={{ borderRadius: 16 }}
    >
      <p className="font-data text-[10px] uppercase tracking-[0.1em] text-muted">Aujourd'hui</p>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">Rien de planifié aujourd'hui.</p>
      ) : (
        // no-drag : sans lui, toute la fenêtre (y compris cette liste
        // scrollable) est une zone de drag Electron — voir le div racine —
        // et un geste de scroll dedans un jour chargé est avalé comme un
        // déplacement de fenêtre au lieu de faire défiler. Même précaution
        // que la bande de boutons de PomodoroOverlay.tsx.
        <ul className="flex flex-col gap-1.5 overflow-y-auto [-webkit-app-region:no-drag]">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2.5">
              <span className="shrink-0 font-data text-[11px] tabular-nums text-muted">
                {formatTime(item.scheduledAt)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${item.done ? 'text-muted line-through' : 'text-champagne'}`}
              >
                {item.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

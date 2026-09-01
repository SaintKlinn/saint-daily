import { NavLink, Outlet } from 'react-router-dom';
import LogoMark from './LogoMark';
import { HomeIcon, ListIcon, GearIcon } from './icons';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-ink-900 text-champagne">
      <nav className="flex w-[72px] min-w-[72px] flex-col items-center gap-10 border-r border-ink-700 bg-ink-900 pt-6">
        <LogoMark width={30} height={20} />
        <div className="flex flex-col items-center gap-[30px]">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                `focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${isActive ? 'text-accent-bright' : 'text-muted hover:text-champagne'}`
              }
            >
              <Icon />
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto px-14 py-12">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import LogoMark from './LogoMark';

const navItems = [
  { to: '/', label: 'Accueil' },
  { to: '/skills', label: 'Skills' },
  { to: '/reglages', label: 'Réglages' },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-ink-900 text-champagne">
      <nav className="flex w-56 flex-col gap-1 border-r border-ink-700 p-4">
        <div className="mb-6 flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-serif text-lg">Saint Daily</span>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-sm ${isActive ? 'bg-ink-700 text-accent-bright' : 'text-muted hover:text-champagne'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

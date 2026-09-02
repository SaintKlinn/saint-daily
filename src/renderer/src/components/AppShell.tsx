import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import RailFlare from './RailFlare';
import UpdateBanner from './UpdateBanner';
import { HomeIcon, ListIcon, GearIcon } from './icons';
import { colors } from '../theme/colors';

// Rail à icônes (maquettes : nav 72px, pas de libellé texte) — remplace la
// nav large en texte de la v1 (audit ui-ux-pro-max, passe V2).
const navItems = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/skills', label: 'Skills', Icon: ListIcon },
  { to: '/reglages', label: 'Réglages', Icon: GearIcon },
];

export default function AppShell() {
  return (
    <div className="flex h-screen flex-col bg-ink-900 text-champagne">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      <nav
        className="relative flex w-[72px] min-w-[72px] flex-col items-center gap-10 overflow-hidden border-r border-ink-700 pt-6"
        style={{ background: `linear-gradient(180deg, ${colors.ink[900]} 0%, #054838 55%, ${colors.ink[950]} 100%)` }}
      >
        <div
          aria-hidden="true"
          className="rail-halo pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 70%)` }}
        />
        <LogoMark width={30} height={20} animated className="relative" />
        <div className="relative flex flex-col items-center gap-1.5">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              aria-label={label}
              className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-[10px]"
                      style={{ background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 72%)` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className={`relative ${isActive ? 'text-accent-bright' : ''}`} />
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-bar"
                      className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-bright"
                      style={{ boxShadow: `0 0 10px ${colors.accent.bright}b3` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
        <RailFlare />
      </nav>
      <main
        className="flex-1 overflow-y-auto px-14 py-12"
        style={{
          backgroundImage: `radial-gradient(ellipse 1100px 560px at 62% -6%, ${colors.accent.bright}1a, transparent 62%), radial-gradient(ellipse 700px 420px at 8% 78%, ${colors.accent.bright}0c, transparent 68%)`,
        }}
      >
        <Outlet />
      </main>
      </div>
    </div>
  );
}

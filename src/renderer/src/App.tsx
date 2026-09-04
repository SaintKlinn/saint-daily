import type { ReactNode } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './lib/auth';
import { PomodoroProvider } from './lib/pomodoro';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './screens/Login';
import DevLogin from './screens/DevLogin';
import PomodoroOverlay from './screens/PomodoroOverlay';
import Accueil from './screens/Accueil';
import Introuvable from './screens/Introuvable';
import NouvelleEntree from './screens/NouvelleEntree';
import DetailSkill from './screens/DetailSkill';
import ListeSkills from './screens/ListeSkills';
import NouveauSkill from './screens/NouveauSkill';
import Pomodoro from './screens/Pomodoro';
import Reglages from './screens/Reglages';

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-900 text-champagne">Chargement…</div>
    );
  }
  // L'écran visé est transmis au login, qui y renvoie après reconnexion —
  // pas de perte du contexte de navigation quand la session expire.
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// L'overlay Pomodoro est une fenêtre Electron à part (voir
// src/main/pomodoroOverlay.ts), toujours créée au démarrage même si elle
// reste cachée — donc si sa route passait par AuthProvider comme le reste
// de l'app, elle instancierait un second client Supabase qui rafraîchit en
// silence la MÊME session persistée que la fenêtre principale. Les refresh
// tokens Supabase étant à usage unique, les deux rafraîchissements
// entraient parfois en collision et invalidaient la session en cours —
// d'où les déconnexions aléatoires au lancement. PomodoroOverlay.tsx n'a de
// toute façon jamais besoin d'auth (pur relais IPC), donc sa route reste en
// dehors de AuthProviderLayout : un seul client Supabase par lancement,
// point.
function AuthProviderLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function Router() {
  return (
    <Routes>
      <Route path="/pomodoro-overlay" element={<PomodoroOverlay />} />
      <Route element={<AuthProviderLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route
          element={
            <AuthGate>
              <PomodoroProvider>
                <AppShell />
              </PomodoroProvider>
            </AuthGate>
          }
        >
          <Route index element={<Accueil />} />
          <Route path="skills" element={<ListeSkills />} />
          <Route path="skills/nouveau" element={<NouveauSkill />} />
          <Route path="skills/:id" element={<DetailSkill />} />
          <Route path="entree/nouvelle" element={<NouvelleEntree />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="*" element={<Introuvable />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* reducedMotion="user" : tous les composants motion.* de l'app
          court-circuitent leurs animations si l'OS demande moins de
          mouvement — même intention que les blocs
          @media (prefers-reduced-motion: reduce) d'index.css, pour les
          animations pilotées par Motion plutôt que par des keyframes CSS. */}
      <MotionConfig reducedMotion="user">
        <HashRouter>
          <Router />
        </HashRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

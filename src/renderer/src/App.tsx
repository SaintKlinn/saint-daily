import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './screens/Login';
import DevLogin from './screens/DevLogin';
import Accueil from './screens/Accueil';
import Introuvable from './screens/Introuvable';
import NouvelleEntree from './screens/NouvelleEntree';
import DetailSkill from './screens/DetailSkill';
import ListeSkills from './screens/ListeSkills';
import NouveauSkill from './screens/NouveauSkill';
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

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dev-login" element={<DevLogin />} />
      <Route
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route index element={<Accueil />} />
        <Route path="skills" element={<ListeSkills />} />
        <Route path="skills/nouveau" element={<NouveauSkill />} />
        <Route path="skills/:id" element={<DetailSkill />} />
        <Route path="entree/nouvelle" element={<NouvelleEntree />} />
        <Route path="reglages" element={<Reglages />} />
        <Route path="*" element={<Introuvable />} />
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
          <AuthProvider>
            <Router />
          </AuthProvider>
        </HashRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

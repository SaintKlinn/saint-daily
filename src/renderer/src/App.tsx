import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './screens/Login';
import Accueil from './screens/Accueil';
import Introuvable from './screens/Introuvable';
import NouvelleEntree from './screens/NouvelleEntree';
import DetailSkill from './screens/DetailSkill';
import ListeSkills from './screens/ListeSkills';
import NouveauSkill from './screens/NouveauSkill';

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-900 text-champagne">Chargement…</div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="*" element={<Introuvable />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { PomodoroProvider } from './lib/pomodoro';
import { useEngagementReminders } from './hooks/useEngagementReminders';
import { useTrayNextEngagement } from './hooks/useTrayNextEngagement';
import { useActionsRapidesTray } from './hooks/useActionsRapidesTray';
import { useAgendaWidgetFeed } from './hooks/useAgendaWidgetFeed';

// Tout ce qui dépend de la connexion — et donc du client Supabase, près de
// 800 Ko sur les 2 Mo du bundle — vit dans ce module, chargé à la demande
// (voir ecrans.ts). Les fenêtres annexes (overlay Pomodoro, widget agenda)
// n'y touchent jamais : sans ce découpage, elles chargeaient et analysaient
// toute l'app pour afficher une ligne de texte.
//
// Les écrans du tout premier affichage (connexion, Accueil) et le rail sont
// importés ici directement, pas à la demande : ils partagent ainsi le même
// fichier que les providers. Surtout, TOUTE la partie connectée n'est qu'un
// seul composant chargé à la demande (`ZoneConnectee`, plus bas). Une
// première version enchaînait quatre composants différés imbriqués
// (authentification, providers, rail, Accueil) : React 19 espace de 300 ms
// l'apparition de chaque bloc en attente, et l'Accueil s'affichait 0,6 s
// plus tard qu'avant le découpage.
import AppShell from './components/AppShell';
import Accueil from './screens/Accueil';
import Login from './screens/Login';
import DevLogin from './screens/DevLogin';
import {
  Bilan,
  Calendrier,
  Corbeille,
  DetailProjet,
  DetailSkill,
  Focus,
  Introuvable,
  Journal,
  ListeProjets,
  ListeSkills,
  NouveauProjet,
  NouveauSkill,
  NouvelleEntree,
  NouvelleTache,
  Pomodoro,
  Reglages,
} from './ecrans';

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

// Petit composant sans rendu pour hisser useEngagementReminders/
// useTrayNextEngagement au même niveau que PomodoroProvider ci-dessous, tout
// en les gardant à l'intérieur d'AuthGate — comme avant ce hoist, ils ne
// doivent tourner qu'une fois authentifié (useTrayNextEngagement ne fait
// aucune vérification de session lui-même). Tant qu'ils étaient montés dans
// `AppShell`, entrer en mode focus démontait ces deux hooks — un rappel dû ou
// l'infobulle du tray restaient silencieux pendant toute la session focus,
// et pire : au retour, le Set de déduplication de `useEngagementReminders`
// repartait vide, donc un rappel dû pendant l'absence était classé périmé
// (plus de 3 minutes de retard, voir REMINDER_TOLERANCE_MS) et marqué comme
// vu sans jamais être montré — une perte silencieuse et définitive.
function EngagementWatchers() {
  useEngagementReminders();
  useTrayNextEngagement();
  useAgendaWidgetFeed();
  const navigate = useNavigate();
  useEffect(() => window.api?.onNavigateRequest?.((path) => navigate(path)), [navigate]);
  return null;
}

// Sous `PomodoroProvider` et non dans `EngagementWatchers` : le menu du
// tray démarre des pomodoros.
function ActionsRapidesTray() {
  useActionsRapidesTray();
  return null;
}

// Sépare « être authentifié et connecté au Pomodoro » de « avoir le rail
// de navigation », pour que le mode focus puisse être l'un sans l'autre.
// Hisser `PomodoroProvider` ici lui fait aussi survivre à l'entrée et à la
// sortie du mode focus : une session en cours n'est pas interrompue. Même
// raison pour `EngagementWatchers` : ce sont des propriétés de « l'app est
// ouverte et authentifiée », pas de « le rail de navigation est affiché ».
function AppProvidersLayout() {
  return (
    <AuthGate>
      <EngagementWatchers />
      <PomodoroProvider>
        <ActionsRapidesTray />
        <Outlet />
      </PomodoroProvider>
    </AuthGate>
  );
}

/**
 * Toute l'app connectée, montée sous la route `/*` d'App.tsx. Les routes
 * sont décrites ici, relativement à cette route parente — mêmes chemins
 * qu'avant le découpage.
 */
export default function ZoneConnectee() {
  return (
    <Routes>
      <Route element={<AuthProviderLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="dev-login" element={<DevLogin />} />
        <Route element={<AppProvidersLayout />}>
          <Route path="focus/:engagementId" element={<Focus />} />
          <Route element={<AppShell />}>
            <Route index element={<Accueil />} />
            <Route path="skills" element={<ListeSkills />} />
            <Route path="skills/nouveau" element={<NouveauSkill />} />
            <Route path="skills/:id" element={<DetailSkill />} />
            <Route path="entree/nouvelle" element={<NouvelleEntree />} />
            <Route path="taches/nouvelle" element={<NouvelleTache />} />
            <Route path="calendrier" element={<Calendrier />} />
            <Route path="projets" element={<ListeProjets />} />
            <Route path="projets/nouveau" element={<NouveauProjet />} />
            <Route path="projets/:id" element={<DetailProjet />} />
            <Route path="bilan" element={<Bilan />} />
            <Route path="journal" element={<Journal />} />
            <Route path="pomodoro" element={<Pomodoro />} />
            <Route path="reglages" element={<Reglages />} />
            <Route path="corbeille" element={<Corbeille />} />
            <Route path="*" element={<Introuvable />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

import { Suspense, type ComponentType } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import ErrorBoundary from './components/ErrorBoundary';
// Les deux fenêtres annexes restent dans le fichier principal : elles sont
// minuscules, et c'est justement pour elles que tout le reste en est sorti.
import PomodoroOverlay from './screens/PomodoroOverlay';
import AgendaWidget from './screens/AgendaWidget';
import { ZoneConnectee } from './ecrans';

// L'authentification, les providers et leurs commentaires vivent dans
// AppConnectee.tsx, chargé à la demande — voir ecrans.ts pour le pourquoi.

// `zoneConnectee` : la zone déjà chargée par main.tsx pour la fenêtre
// principale. Sans elle (fenêtres annexes, ou échec du préchargement), la
// version différée prend le relais si l'adresse y mène.
function Router({ zoneConnectee: Zone }: { zoneConnectee: ComponentType | null }) {
  return (
    <Routes>
      <Route path="/pomodoro-overlay" element={<PomodoroOverlay />} />
      <Route path="/agenda-widget" element={<AgendaWidget />} />
      <Route path="/*" element={Zone ? <Zone /> : <ZoneConnectee />} />
    </Routes>
  );
}

export default function App({ zoneConnectee = null }: { zoneConnectee?: ComponentType | null }) {
  return (
    <ErrorBoundary>
      {/* reducedMotion="user" : tous les composants motion.* de l'app
          court-circuitent leurs animations si l'OS demande moins de
          mouvement — même intention que les blocs
          @media (prefers-reduced-motion: reduce) d'index.css, pour les
          animations pilotées par Motion plutôt que par des keyframes CSS. */}
      <MotionConfig reducedMotion="user">
        <HashRouter>
          {/* `fallback={null}` : les morceaux se chargent depuis le disque en
              quelques millisecondes, un indicateur ne ferait que clignoter.
              AuthGate affiche déjà « Chargement… » pendant la session. */}
          <Suspense fallback={null}>
            <Router zoneConnectee={zoneConnectee} />
          </Suspense>
        </HashRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

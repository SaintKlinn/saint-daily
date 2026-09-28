import React, { type ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './polices';
import './index.css';

// Les fenêtres annexes (voir src/main/pomodoroOverlay.ts et agendaWidget.ts)
// sont ouvertes sur ces adresses : elles n'ont besoin ni de la connexion, ni
// de Supabase, ni des écrans de l'app.
const FENETRES_ANNEXES = ['#/pomodoro-overlay', '#/agenda-widget'];

function afficher(zoneConnectee: ComponentType | null) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App zoneConnectee={zoneConnectee} />
    </React.StrictMode>
  );
}

// Fenêtre principale : la zone connectée est chargée AVANT le premier rendu
// et passée telle quelle au routeur. Rendue par `lazy()`, elle suspendait le
// premier affichage, et React 19 retarde de 300 ms au moins l'apparition
// d'un contenu en attente — l'Accueil arrivait plus tard qu'avec l'ancien
// fichier unique. Ici, rien ne suspend : un seul rendu, une fois tout prêt.
if (FENETRES_ANNEXES.some((adresse) => window.location.hash.startsWith(adresse))) {
  afficher(null);
} else {
  import('./AppConnectee').then(
    (module) => afficher(module.default),
    // Chargement impossible (fichier manquant après une mise à jour
    // interrompue…) : on rend quand même, la version différée retentera et
    // l'ErrorBoundary affichera l'erreur plutôt qu'une fenêtre vide.
    () => afficher(null)
  );
}

import { lazy } from 'react';

// Écrans chargés à la demande. Le bundle unique (2 Mo non minifiés, dont
// 800 Ko de Supabase) était lu et compilé en entier à chaque ouverture, y
// compris par l'overlay Pomodoro et le widget agenda qui n'en utilisent
// presque rien. Chaque `import()` ci-dessous devient un fichier séparé.
//
// Une seule liste, pour que le routeur (App.tsx) et le préchargement
// (`prechargerEcrans`) ne puissent pas diverger.

// Toute la partie connectée (providers, rail, connexion, Accueil et le
// routage des autres écrans) : un seul composant différé, donc une seule
// attente à l'ouverture — voir AppConnectee.tsx.
export const ZoneConnectee = lazy(() => import('./AppConnectee'));

const CHARGEURS = {
  Focus: () => import('./screens/Focus'),
  ListeSkills: () => import('./screens/ListeSkills'),
  NouveauSkill: () => import('./screens/NouveauSkill'),
  DetailSkill: () => import('./screens/DetailSkill'),
  NouvelleEntree: () => import('./screens/NouvelleEntree'),
  NouvelleTache: () => import('./screens/NouvelleTache'),
  Calendrier: () => import('./screens/Calendrier'),
  ListeProjets: () => import('./screens/ListeProjets'),
  NouveauProjet: () => import('./screens/NouveauProjet'),
  DetailProjet: () => import('./screens/DetailProjet'),
  Bilan: () => import('./screens/Bilan'),
  Journal: () => import('./screens/Journal'),
  Pomodoro: () => import('./screens/Pomodoro'),
  Reglages: () => import('./screens/Reglages'),
  Corbeille: () => import('./screens/Corbeille'),
  Introuvable: () => import('./screens/Introuvable'),
};

export const Focus = lazy(CHARGEURS.Focus);
export const ListeSkills = lazy(CHARGEURS.ListeSkills);
export const NouveauSkill = lazy(CHARGEURS.NouveauSkill);
export const DetailSkill = lazy(CHARGEURS.DetailSkill);
export const NouvelleEntree = lazy(CHARGEURS.NouvelleEntree);
export const NouvelleTache = lazy(CHARGEURS.NouvelleTache);
export const Calendrier = lazy(CHARGEURS.Calendrier);
export const ListeProjets = lazy(CHARGEURS.ListeProjets);
export const NouveauProjet = lazy(CHARGEURS.NouveauProjet);
export const DetailProjet = lazy(CHARGEURS.DetailProjet);
export const Bilan = lazy(CHARGEURS.Bilan);
export const Journal = lazy(CHARGEURS.Journal);
export const Pomodoro = lazy(CHARGEURS.Pomodoro);
export const Reglages = lazy(CHARGEURS.Reglages);
export const Corbeille = lazy(CHARGEURS.Corbeille);
export const Introuvable = lazy(CHARGEURS.Introuvable);

let dejaPrecharge = false;

/**
 * Charge en arrière-plan tous les écrans, une fois l'app affichée : la
 * première navigation vers un écran n'attend alors aucun chargement. Appelé
 * par AppShell quand le navigateur est inactif, jamais pendant l'ouverture —
 * c'est tout l'intérêt du découpage.
 */
export function prechargerEcrans(): void {
  if (dejaPrecharge) return;
  dejaPrecharge = true;
  for (const charger of Object.values(CHARGEURS)) void charger().catch(() => {});
}

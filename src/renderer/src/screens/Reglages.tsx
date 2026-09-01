import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../hooks/useSettings';
import Toggle from '../components/Toggle';

export default function Reglages() {
  const { signOut } = useAuth();
  const { settings, loading, error, updateSettings } = useSettings();
  const [autoLaunch, setAutoLaunch] = useState(false);
  // Les trois réglages ci-dessous écrivaient en silence : un échec réseau
  // faisait revenir la case/valeur à son état précédent sans un mot
  // d'explication. Un seul message suffit, ces trois contrôles sont dans
  // la même section (audit ui-ux-pro-max).
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    // window.api est absent si le pont IPC n'a pas pu se charger (ou hors
    // Electron). Sans ces gardes, l'appel levait de façon synchrone dans
    // l'effet et remontait jusqu'à l'ErrorBoundary racine — qui est HORS
    // du HashRouter : toute l'app devenait un écran d'erreur, sans même
    // pouvoir naviguer ailleurs. Même pattern défensif que Login.tsx.
    window.api
      ?.getAutoLaunch?.()
      .then(setAutoLaunch)
      .catch(() => setAutoLaunch(false));
  }, []);

  async function handleReminderChange(value: number) {
    setActionError(null);
    const { error: updateError } = await updateSettings({ reminderThresholdDays: value });
    if (updateError) setActionError(updateError);
  }

  async function handleNotificationsChange(enabled: boolean) {
    setActionError(null);
    const { error: updateError } = await updateSettings({ notificationsEnabled: enabled });
    if (updateError) setActionError(updateError);
  }

  async function handleAutoLaunchChange(enabled: boolean) {
    // Pas de pont IPC : on ne persiste rien plutôt que d'écrire une
    // valeur fausse dans les réglages. État suffisamment inhabituel pour
    // ne pas mériter d'UX dédiée ici ; l'important est que ça ne lève pas.
    if (!window.api?.setAutoLaunch) return;
    setActionError(null);
    const actual = await window.api.setAutoLaunch(enabled);
    setAutoLaunch(actual);
    const { error: updateError } = await updateSettings({ autoLaunchEnabled: actual });
    if (updateError) setActionError(updateError);
  }

  // `!settings` en plus de `loading` : useSettings repasse loading à true
  // à chaque refresh, y compris celui qui suit un changement de réglage —
  // sans ça l'écran clignoterait à chaque case cochée.
  if (loading && !settings) return <p className="text-muted">Chargement…</p>;
  // Même piège que le détail d'un skill : sans ce cas, un échec de
  // chargement laissait « Chargement… » à l'écran indéfiniment.
  if (!settings) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error ?? 'Réglages indisponibles pour le moment.'}
      </p>
    );
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-8">
      <h1 className="font-serif text-[30px] text-champagne">Réglages</h1>

      <section className="flex flex-col gap-0">
        <h2 className="mb-1 font-data text-[11px] uppercase tracking-[0.1em] text-muted">Rappels</h2>
        {actionError && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {actionError}
          </p>
        )}

        <div className="flex items-center justify-between border-b border-ink-700 py-[18px]">
          <div>
            <p className="text-[15px] text-champagne">Seuil de rappel</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Nombre de jours sans pratique avant qu'un skill apparaisse dans les rappels dus
            </p>
          </div>
          <label className="flex items-center gap-2 border border-ink-700 bg-ink-800 px-3.5 py-2">
            <input
              type="number"
              min={1}
              value={settings.reminderThresholdDays}
              onChange={(e) => handleReminderChange(Number(e.target.value))}
              aria-label="Seuil de rappel en jours"
              className="w-10 bg-transparent text-right font-data text-[15px] text-champagne focus:outline-none"
            />
            <span className="font-data text-[15px] text-champagne">jours</span>
          </label>
        </div>

        <Toggle
          checked={settings.notificationsEnabled}
          onChange={handleNotificationsChange}
          label="Notifications natives"
          description="Une notification quand un skill franchit son seuil de rappel"
        />
        <Toggle
          checked={autoLaunch}
          onChange={handleAutoLaunchChange}
          label="Lancement automatique"
          description="Ouvrir Saint Daily au démarrage de session, en arrière-plan dans la zone de notification"
        />
      </section>

      <section className="flex flex-col gap-0">
        <h2 className="mb-1 font-data text-[11px] uppercase tracking-[0.1em] text-muted">À propos</h2>
        <details className="border-b border-ink-700 py-4">
          <summary className="cursor-pointer text-[15px] text-champagne">Confidentialité</summary>
          <p className="mt-2 text-sm text-muted">
            Saint Daily est un outil 100% personnel : tes skills, jalons et entrées de pratique ne sont
            visibles que par toi. Les données sont stockées dans le projet Supabase partagé avec Saint Gym,
            protégées par des règles d'accès (RLS) qui limitent chaque ligne à son propriétaire.
          </p>
        </details>
        <details className="border-b border-ink-700 py-4">
          <summary className="cursor-pointer text-[15px] text-champagne">Conditions d'utilisation</summary>
          <p className="mt-2 text-sm text-muted">
            Projet personnel — pas de service tiers, pas de compte séparé à créer : Saint Daily réutilise le
            compte existant de l'écosystème Saint.
          </p>
        </details>
        <details className="border-b border-ink-700 py-4">
          <summary className="cursor-pointer text-[15px] text-champagne">FAQ</summary>
          <p className="mt-2 text-sm text-muted">
            <strong className="text-champagne">Pourquoi les rappels ne sonnent pas quand l'app est fermée ?</strong>
            <br />
            Les rappels sont calculés pendant que Saint Daily tourne (fenêtre ouverte ou réduite dans le
            system tray). Active le lancement au démarrage ci-dessus pour qu'ils soient toujours actifs.
          </p>
        </details>
      </section>

      <button
        onClick={() => signOut()}
        className="w-fit border border-ink-700 px-4 py-2 text-sm text-muted hover:text-champagne"
      >
        Se déconnecter
      </button>
    </div>
  );
}

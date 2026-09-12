import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import type { Engagement } from '../lib/types';
import BoutonSuppression from '../components/BoutonSuppression';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { ChevronLeftIcon } from '../components/icons';

function typeLabel(engagement: Engagement): string {
  if (engagement.isProject) return 'Projet';
  return engagement.scheduledAt ? 'Tâche' : 'Skill';
}

function formatDeletedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Corbeille() {
  const { deletedEngagements, loading, error, restore, purge } = useEngagements();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRestore(engagement: Engagement) {
    setActionError(null);
    setBusyId(engagement.id);
    const { error: restoreError } = await restore(
      engagement.id,
      engagement.deletedAt as string,
      engagement.isProject
    );
    if (restoreError) setActionError(restoreError);
    setBusyId(null);
  }

  async function handlePurge(engagement: Engagement) {
    setActionError(null);
    setBusyId(engagement.id);
    const { error: purgeError } = await purge(engagement.id, engagement.isProject);
    if (purgeError) setActionError(purgeError);
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/reglages"
        className="flex w-fit items-center gap-2 font-sans text-[13px] text-muted transition-colors duration-150 hover:text-champagne"
      >
        <ChevronLeftIcon />
        Retour aux réglages
      </Link>

      <div>
        <h1 className="font-serif text-[30px] text-champagne">Corbeille</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Rien n'en sort tout seul : un élément y reste jusqu'à ce que tu le restaures ou le supprimes
          définitivement.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {loading && deletedEngagements.length === 0 ? (
        <EmptyState role="status">Chargement…</EmptyState>
      ) : deletedEngagements.length === 0 ? (
        <EmptyState>La corbeille est vide.</EmptyState>
      ) : (
        <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
          {deletedEngagements.map((engagement) => (
            <div key={engagement.id} className="flex items-center gap-4 bg-ink-800 px-[18px] py-4">
              <span className="w-14 shrink-0 font-data text-[10px] uppercase tracking-[0.08em] text-muted">
                {typeLabel(engagement)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-champagne">{engagement.name}</p>
                <p className="mt-0.5 font-data text-[11px] text-muted">
                  Supprimé le {formatDeletedAt(engagement.deletedAt as string)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRestore(engagement)}
                disabled={busyId === engagement.id}
              >
                Restaurer
              </Button>
              <BoutonSuppression
                onConfirm={() => handlePurge(engagement)}
                label="Supprimer définitivement"
                confirmLabel="Définitivement ?"
                busy={busyId === engagement.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

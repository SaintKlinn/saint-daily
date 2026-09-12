import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useMilestones } from '../hooks/useMilestones';
import { usePomodoro } from '../lib/pomodoro';
import MilestoneChecklist from '../components/MilestoneChecklist';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const PHASE_LABELS: Record<string, string> = {
  work: 'Travail',
  shortBreak: 'Pause courte',
  longBreak: 'Pause longue',
};

export default function Focus() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { engagements, loading, error } = useEngagements();
  const engagement = engagements.find((e) => e.id === engagementId) ?? null;
  const { milestones, error: milestonesError, addMilestone, toggleMilestone } = useMilestones(engagementId ?? null);
  const { session, durations, start, resume, advance } = usePomodoro();
  const [actionError, setActionError] = useState<string | null>(null);
  // Le compte à rebours est purement local : l'état Pomodoro n'est poussé
  // qu'aux transitions de phase, pas à chaque seconde.
  const [now, setNow] = useState(() => Date.now());

  const runningHere = session && session.skillId === engagementId ? session : null;
  // Même calcul que Pomodoro.tsx et PomodoroOverlay.tsx : `phaseEndsAt - now`
  // n'est valable que pendant que la phase tourne réellement.
  // - En pause, `phaseEndsAt` est figé au moment de la pause alors que `now`
  //   continue d'avancer : sans ce cas, l'affichage décompterait vers zéro
  //   une valeur qui ne bouge plus vraiment côté minuteur.
  // - En attente de reprise manuelle (`awaitingAdvance`, auto-avance
  //   désactivée dans les Réglages), `phaseEndsAt` n'est pas recalculé tant
  //   qu'on n'a pas cliqué "Continuer" (voir completePhase dans
  //   pomodoroLogic.ts) : il reste dans le passé, donc `phaseEndsAt - now`
  //   resterait bloqué à 0:00 indéfiniment.
  const remainingMs = runningHere
    ? runningHere.status === 'paused' && runningHere.remainingMsAtPause !== null
      ? runningHere.remainingMsAtPause
      : Math.max(0, runningHere.phaseEndsAt - now)
    : 0;

  useEffect(() => {
    if (!runningHere) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningHere]);

  if (loading && engagements.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-900">
        <EmptyState role="status">Chargement…</EmptyState>
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-900 px-8">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted">Cet engagement n'existe plus.</p>
        )}
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  async function handleAddMilestone(label: string) {
    setActionError(null);
    const { error: addError } = await addMilestone(label);
    if (addError) setActionError(addError);
    return { error: addError };
  }

  async function handleToggleMilestone(id: string, completed: boolean) {
    setActionError(null);
    const { error: toggleError } = await toggleMilestone(id, completed);
    if (toggleError) setActionError(toggleError);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 px-8 py-10">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">Mode focus</p>
          <h1 className="mt-2 font-serif text-[38px] leading-tight text-champagne">{engagement.name}</h1>
          {engagement.tags.length > 0 && (
            <p className="mt-2 text-[13px] text-muted">{engagement.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
          {engagement.notes && <p className="mt-4 text-sm text-champagne">{engagement.notes}</p>}
        </div>

        <div className="border border-ink-700 bg-ink-800 px-6 py-5">
          {runningHere ? (
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="font-serif text-[44px] tabular-nums text-accent-bright">
                {formatRemaining(remainingMs)}
              </span>
              <span className="font-data text-[11px] uppercase tracking-[0.1em] text-muted">
                {PHASE_LABELS[runningHere.phase] ?? runningHere.phase}
              </span>
              {runningHere.status === 'paused' && (
                <Button variant="secondary" size="sm" onClick={resume}>
                  Reprendre
                </Button>
              )}
              {runningHere.status === 'awaitingAdvance' && (
                <Button variant="primary" size="sm" onClick={advance}>
                  Continuer
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={!durations}
              onClick={() => durations && start(engagement.id, engagement.name, durations.workMinutes)}
            >
              Démarrer un pomodoro
            </Button>
          )}
        </div>

        <div>
          <MilestoneChecklist
            milestones={milestones}
            onToggle={handleToggleMilestone}
            onAdd={handleAddMilestone}
            error={milestonesError ?? actionError}
          />
        </div>

        <div>
          {/* Un accès direct à /focus/:id (lien profond, rechargement) n'a
              pas d'entrée d'historique à dépiler, et il n'y a pas de rail de
              navigation ici pour s'échapper autrement : navigate(-1) ne
              ferait alors rien. `location.key === 'default'` est le
              signal React Router pour « ceci est la toute première entrée,
              pas poussée par nous » (voir doc react-router). */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
          >
            Quitter le mode focus
          </Button>
        </div>
      </div>
    </div>
  );
}

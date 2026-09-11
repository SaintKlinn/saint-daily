import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import Introuvable from './Introuvable';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import { ChevronLeftIcon } from '../components/icons';

export default function DetailProjet() {
  const { id } = useParams<{ id: string }>();
  const { engagements, loading, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const project = projects.find((p) => p.id === id);
  const children = useMemo(() => engagements.filter((e) => e.projectId === id), [engagements, id]);

  // Même garde que DetailSkill.tsx : `loading` repasse à true à chaque
  // refresh (y compris après une simple modification), donc la comparer
  // seule ferait clignoter tout l'écran sur « Chargement… » à chaque édition.
  if (loading && projects.length === 0) {
    return <EmptyState role="status">Chargement…</EmptyState>;
  }
  if (!project) {
    if (error) {
      return (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      );
    }
    return <Introuvable />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/projets"
        className="flex w-fit items-center gap-2 font-sans text-[13px] text-muted transition-colors duration-150 hover:text-champagne"
      >
        <ChevronLeftIcon />
        Retour
      </Link>

      <div className="relative overflow-hidden border border-ink-700 bg-ink-900 p-6">
        <RayCorner variant={0} />
        <h1 className="relative font-serif text-[30px] text-champagne">{project.name}</h1>
        {project.tags.length > 0 && (
          <p className="relative mt-1.5 text-[13px] text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        {project.notes && <p className="relative mt-3 text-sm text-champagne">{project.notes}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-sans text-sm font-semibold text-champagne">Engagements liés</h2>
        {children.length === 0 ? (
          <EmptyState>Aucun engagement rattaché à ce projet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
            {children.map((child) => (
              <Link
                key={child.id}
                to={child.scheduledAt ? '/calendrier' : `/skills/${child.id}`}
                className="flex items-center gap-3 bg-ink-800 px-[18px] py-4 transition-colors duration-200 hover:bg-ink-700"
              >
                <span className="font-data text-[10px] uppercase tracking-[0.08em] text-muted">
                  {child.scheduledAt ? 'Tâche' : 'Skill'}
                </span>
                <span className="font-serif text-champagne">{child.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

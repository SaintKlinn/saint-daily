import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';

export default function ListeProjets() {
  const { engagements, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[30px] text-champagne">Projets</h1>
        <Link to="/projets/nouveau" className={buttonClassName('primary')}>
          + Nouveau projet
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projets/${project.id}`}
            className="flex items-center gap-5 bg-ink-800 px-[22px] py-5 transition-colors duration-200 hover:bg-ink-700"
          >
            <div className="flex-1">
              <span className="font-serif text-[19px] text-champagne">{project.name}</span>
              {project.tags.length > 0 && (
                <p className="mt-1 text-[13px] text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
              )}
            </div>
          </Link>
        ))}
        {projects.length === 0 && <EmptyState>Aucun projet pour l'instant.</EmptyState>}
      </div>
    </div>
  );
}

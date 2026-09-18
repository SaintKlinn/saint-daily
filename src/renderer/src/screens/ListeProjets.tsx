import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';

export default function ListeProjets() {
  const { engagements, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-titre-ecran text-champagne">Projets</h1>
        <Link to="/projets/nouveau" className={buttonClassName('primary')}>
          + Nouveau projet
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projets/${project.id}`}
            className="flex items-center gap-2 bg-ink-800 p-4 transition-colors duration-200 hover:bg-ink-700"
          >
            <div className="flex-1">
              <span className="font-serif text-titre text-champagne">{project.name}</span>
              {project.tags.length > 0 && (
                <p className="mt-1 text-secondaire text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
              )}
            </div>
          </Link>
        ))}
        {projects.length === 0 && <EmptyState>Aucun projet pour l'instant.</EmptyState>}
      </div>
    </div>
  );
}

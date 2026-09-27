import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import { entreesDuProjet, formatDormance, membresDuProjet, tempsCumuleMinutes } from '../lib/projets';
import { formatMinutes } from '../lib/retrospective';
import { daysSinceLastPractice } from '../lib/streaks';

export default function ListeProjets() {
  const { engagements, error } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);

  const { liaisons } = useLiaisonsProjet();
  const membresParProjet = useMemo(
    () => new Map(projects.map((p) => [p.id, membresDuProjet(engagements, liaisons, p.id)])),
    [projects, engagements, liaisons]
  );
  // Une seule requête pour l'écran entier, et non une par projet : on réunit
  // les identifiants de tous les membres de tous les projets, plus les projets
  // eux-mêmes. Triés et dédoublonnés — `useAllPracticeEntries` mémorise sur
  // `engagementIds.join(',')`, donc un ordre instable relancerait la requête
  // à chaque rendu.
  const idsConcernes = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) {
      ids.add(p.id);
      for (const m of membresParProjet.get(p.id) ?? []) ids.add(m.id);
    }
    return [...ids].sort();
  }, [projects, membresParProjet]);
  const { entriesBySkill } = useAllPracticeEntries(idsConcernes);

  const resumeParProjet = useMemo(() => {
    const resume = new Map<string, string>();
    for (const p of projects) {
      const entrees = entreesDuProjet(entriesBySkill, membresParProjet.get(p.id) ?? [], p.id);
      resume.set(
        p.id,
        `${formatMinutes(tempsCumuleMinutes(entrees))} · ${formatDormance(daysSinceLastPractice(entrees))}`
      );
    }
    return resume;
  }, [projects, membresParProjet, entriesBySkill]);

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
              <p className="mt-1 text-secondaire text-muted">{resumeParProjet.get(project.id)}</p>
            </div>
          </Link>
        ))}
        {projects.length === 0 && <EmptyState>Aucun projet pour l'instant.</EmptyState>}
      </div>
    </div>
  );
}

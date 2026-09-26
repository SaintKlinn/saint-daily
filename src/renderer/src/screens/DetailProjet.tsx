import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { membresDuProjet } from '../lib/projets';
import Introuvable from './Introuvable';
import RayCorner from '../components/RayCorner';
import EmptyState from '../components/EmptyState';
import BoutonSuppression from '../components/BoutonSuppression';
import { ChevronLeftIcon } from '../components/icons';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function DetailProjet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { engagements, loading, error, softDelete, updateEngagement } = useEngagements();
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const project = projects.find((p) => p.id === id);
  const { liaisons, lier, delier, synchroniserColonne } = useLiaisonsProjet();
  // `membresDuProjet` porte la règle de résolution : la liaison fait
  // autorité dès qu'elle est disponible, et `project_id` ne sert que de
  // repli tant que la migration 0016 n'est pas appliquée.
  const children = useMemo(
    () => (id ? membresDuProjet(engagements, liaisons, id) : []),
    [engagements, liaisons, id]
  );
  // Les tâches ne se rattachent pas d'ici : on les rattache depuis le
  // calendrier, là où on les planifie. Le modèle les accepte, c'est
  // l'interface qui choisit de ne pas les proposer.
  const rattachables = useMemo(() => {
    const dejaMembres = new Set(children.map((e) => e.id));
    return engagements.filter(
      (e) => !e.isProject && !e.scheduledAt && !e.archivedAt && !dejaMembres.has(e.id)
    );
  }, [engagements, children]);
  const [actionError, setActionError] = useState<string | null>(null);
  // La navigation n'arrive qu'après l'aller-retour de `softDelete` : sans
  // cet état, le bouton reste armable pendant toute l'attente réseau.
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!project) return;
    setActionError(null);
    setDeleting(true);
    const { error: deleteError } = await softDelete(project.id, true);
    setDeleting(false);
    if (deleteError) {
      setActionError(deleteError);
      return;
    }
    navigate('/projets');
  }

  async function handleLier(engagementId: string) {
    if (!id) return;
    setActionError(null);
    const { error: lierError, liaisons: fraiches } = await lier(engagementId, id);
    if (lierError) {
      setActionError(lierError);
      return;
    }
    const { error: syncError } = await synchroniserColonne(engagementId, fraiches, updateEngagement);
    if (syncError) setActionError(syncError);
  }

  async function handleDelier(engagementId: string) {
    if (!id) return;
    setActionError(null);
    const { error: delierError, liaisons: fraiches } = await delier(engagementId, id);
    if (delierError) {
      setActionError(delierError);
      return;
    }
    const { error: syncError } = await synchroniserColonne(engagementId, fraiches, updateEngagement);
    if (syncError) setActionError(syncError);
  }

  // Même garde que DetailSkill.tsx : `loading` repasse à true à chaque
  // refresh (y compris après une simple modification), donc la comparer
  // seule ferait clignoter tout l'écran sur « Chargement… » à chaque édition.
  if (loading && projects.length === 0) {
    return <EmptyState role="status">Chargement…</EmptyState>;
  }
  if (!project) {
    if (error) {
      return (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      );
    }
    return <Introuvable />;
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/projets"
        className="flex w-fit items-center gap-2 font-sans text-secondaire text-muted transition-colors duration-150 hover:text-champagne"
      >
        <ChevronLeftIcon />
        Retour
      </Link>

      <div className="relative overflow-hidden border border-ink-700 bg-ink-900 p-6">
        <RayCorner variant={0} />
        <h1 className="relative font-serif text-titre-ecran text-champagne">{project.name}</h1>
        {project.tags.length > 0 && (
          <p className="relative mt-2 text-secondaire text-muted">{project.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        {project.notes && <p className="relative mt-3 text-corps text-champagne">{project.notes}</p>}
      </div>

      <div className="flex items-center gap-3">
        <BoutonSuppression onConfirm={handleDelete} busy={deleting} />
        <p className="text-secondaire text-muted">
          Supprimer un projet envoie aussi ses engagements liés à la corbeille.
        </p>
      </div>
      {actionError && (
        <p role="alert" className="text-corps text-danger">
          {actionError}
        </p>
      )}

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Composition</h2>
        {children.length === 0 ? (
          <EmptyState>Aucun engagement rattaché à ce projet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 bg-ink-800 px-4 py-4 transition-colors duration-200 hover:bg-ink-700"
              >
                <Link
                  to={child.scheduledAt ? '/calendrier' : `/skills/${child.id}`}
                  className="flex flex-1 items-center gap-2"
                >
                  <span className="font-data text-libelle uppercase tracking-[0.08em] text-muted">
                    {child.scheduledAt ? 'Tâche' : 'Skill'}
                  </span>
                  <span className="font-serif text-champagne">{child.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelier(child.id)}
                  className={`font-data text-secondaire text-muted transition-colors duration-150 hover:text-champagne ${FOCUS_RING}`}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="mt-3 flex flex-col gap-2">
          <span className="font-data text-libelle uppercase tracking-[0.1em] text-muted">
            Rattacher un skill
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleLier(e.target.value);
            }}
            className={`border border-ink-700 bg-ink-800 px-3 py-2 text-corps text-champagne ${FOCUS_RING}`}
          >
            <option value="">Choisir…</option>
            {rattachables.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}

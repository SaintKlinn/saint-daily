import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useMilestones } from '../hooks/useMilestones';
import {
  avancementProjet,
  entreesDuProjet,
  formatDormance,
  membresDuProjet,
  tempsCumuleMinutes,
} from '../lib/projets';
import { formatMinutes } from '../lib/retrospective';
import { daysSinceLastPractice } from '../lib/streaks';
import { computeGoalProgress } from '../lib/motivation';
import type { GoalMetric, GoalPeriod } from '../lib/types';
import Introuvable from './Introuvable';
import EmptyState from '../components/EmptyState';
import Button, { buttonClassName } from '../components/Button';
import BoutonSuppression from '../components/BoutonSuppression';
import GoalProgress from '../components/GoalProgress';
import GoalSetter from '../components/GoalSetter';
import MilestoneChecklist from '../components/MilestoneChecklist';
import BarreProgression from '../components/BarreProgression';
import { ChevronLeftIcon } from '../components/icons';
import ChampSauvegarde from '../components/ChampSauvegarde';
import { analyserTags } from '../lib/tags';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function DetailProjet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { engagements, deletedEngagements, loading, error, softDelete, updateEngagement, setArchived } = useEngagements();
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
  const [enEditionNom, setEnEditionNom] = useState(false);

  // Les identifiants sont TRIÉS : `useAllPracticeEntries` mémorise sur
  // `engagementIds.join(',')`, donc deux tableaux de même contenu dans un
  // ordre différent produisent deux clés différentes et relancent la requête
  // à chaque rendu où l'ordre change.
  const idsConcernes = useMemo(
    () => (id ? [...new Set([...children.map((c) => c.id), id])].sort() : []),
    [children, id]
  );
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(idsConcernes);
  const entrees = useMemo(
    () => (id ? entreesDuProjet(entriesBySkill, children, id) : []),
    [entriesBySkill, children, id]
  );
  const minutes = useMemo(() => tempsCumuleMinutes(entrees), [entrees]);
  const dormance = useMemo(() => formatDormance(daysSinceLastPractice(entrees)), [entrees]);
  const objectif = useMemo(
    () =>
      project?.goalPeriod && project.goalMetric && project.goalTarget
        ? computeGoalProgress(entrees, project.goalPeriod, project.goalMetric, project.goalTarget)
        : null,
    [entrees, project]
  );

  // L'avancement ne compte QUE les jalons du projet lui-même, jamais ceux
  // de ses membres : ce sont des livrables, pas des étapes d'apprentissage.
  // Voir `avancementProjet`, qui porte la règle et son test.
  const { milestones, error: jalonsError, addMilestone, toggleMilestone } = useMilestones(id ?? null);
  const avancement = useMemo(() => avancementProjet(milestones), [milestones]);

  async function handleToggleJalon(jalonId: string, completed: boolean) {
    setActionError(null);
    const { error: toggleError } = await toggleMilestone(jalonId, completed);
    if (toggleError) setActionError(toggleError);
    return { error: toggleError };
  }

  async function handleGoalChange(patch: {
    goalPeriod: GoalPeriod | null;
    goalMetric: GoalMetric | null;
    goalTarget: number | null;
  }) {
    if (!project) return;
    setActionError(null);
    const { error: goalError } = await updateEngagement(project.id, patch);
    if (goalError) setActionError(goalError);
  }

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

  async function handleRenommer(nom: string | null) {
    if (!project) {
      const message = 'Projet introuvable';
      setActionError(message);
      return { error: message };
    }
    // Un nom vide n'est pas enregistré : `name` est obligatoire à la
    // création, et le rendre effaçable après coup produirait un projet sans
    // nom dans toutes les listes. Le champ ne garde pas sa saisie : le
    // `onBlur` du div englobant l'a déjà démonté, donc le `h1` revient avec
    // `project.name` inchangé. C'est pour ça que le refus passe par
    // `actionError` — c'est le seul endroit encore monté pour le dire.
    if (nom === null) {
      const message = 'Le nom ne peut pas être vide';
      setActionError(message);
      return { error: message };
    }
    setActionError(null);
    const { error: renameError } = await updateEngagement(project.id, { name: nom.trim() });
    if (renameError) setActionError(renameError);
    return { error: renameError };
  }

  async function handleTags(saisie: string | null) {
    if (!project) return { error: 'Projet introuvable' };
    setActionError(null);
    const { error: tagsError } = await updateEngagement(project.id, { tags: analyserTags(saisie ?? '') });
    if (tagsError) setActionError(tagsError);
    return { error: tagsError };
  }

  async function handleArchiver() {
    if (!project) return;
    setActionError(null);
    const { error: archiveError } = await setArchived(project.id, !project.archivedAt);
    if (archiveError) setActionError(archiveError);
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
    return <Introuvable sujet="projet" enCorbeille={deletedEngagements.some((e) => e.id === id)} />;
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

      {actionError && (
        <p role="alert" className="text-corps text-danger">
          {actionError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
          {entriesError}
        </p>
      )}

      {/* En-tête sur le modèle de la fiche d'un skill : le titre à gauche, les
          actions sur le projet à droite. Le titre vivait seul dans un grand
          cadre, et Archiver/Supprimer se trouvaient au milieu de la page,
          avant la composition du projet. */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
            {/* Le nom reste un titre tant qu'on ne le modifie pas : le rendre
                champ en permanence remplacerait un serif 28 px par une boîte
                bordée sur un écran qu'on regarde bien plus qu'on ne le modifie.
                Le mode vit ici et non dans `ChampSauvegarde`, qui ne saurait
                plus s'il est un champ ou un titre.

                Le `onBlur` du div suffit à en sortir : celui de React est un
                `focusout`, donc il remonte depuis le champ. */}
            {enEditionNom ? (
              <div className="relative" onBlur={() => setEnEditionNom(false)}>
                <ChampSauvegarde
                  key={project.id}
                  valeur={project.name}
                  onSave={handleRenommer}
                  ariaLabel="Nom du projet"
                  confirmation="Nom enregistré."
                  autoFocus
                />
              </div>
            ) : (
              <h1 className="relative font-serif text-titre-ecran text-champagne">
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setEnEditionNom(true);
                  }}
                  className={`block text-left ${FOCUS_RING}`}
                >
                  {project.name}
                </button>
              </h1>
            )}
        </div>
        <div className="flex max-w-sm flex-col items-end gap-2">
          {/* Session de chantier : travailler le projet pour lui-même. Le
              temps s'enregistre sur le projet et compte dans son total. Pas
              sur un projet archivé, que le Pomodoro ne propose pas. */}
          {!project.archivedAt && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link to={`/pomodoro?skillId=${project.id}`} className={buttonClassName('secondary', 'sm')}>
                Session de chantier
              </Link>
              <Link to={`/entree/nouvelle?skillId=${project.id}`} className={buttonClassName('secondary', 'sm')}>
                Nouvelle entrée
              </Link>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleArchiver}>
              {project.archivedAt ? 'Désarchiver' : 'Archiver'}
            </Button>
            <BoutonSuppression onConfirm={handleDelete} busy={deleting} />
          </div>
          <p className="text-right text-secondaire text-muted">
            Supprimer le projet envoie aussi à la corbeille les skills et tâches dont il est le projet principal.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-8">
        <div>
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Temps cumulé</p>
          <p className="mt-1 text-corps text-champagne">{formatMinutes(minutes)}</p>
        </div>
        <div>
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Dernière activité</p>
          <p className="mt-1 text-corps text-champagne">{dormance}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Objectif</h2>
        {objectif ? (
          <div className="flex flex-col gap-3">
            <GoalProgress progress={objectif} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => handleGoalChange({ goalPeriod: null, goalMetric: null, goalTarget: null })}
            >
              Retirer l'objectif
            </Button>
          </div>
        ) : (
          <GoalSetter onSubmit={handleGoalChange} />
        )}
      </section>

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Jalons</h2>
        <MilestoneChecklist
          milestones={milestones}
          onToggle={handleToggleJalon}
          onAdd={addMilestone}
          error={jalonsError}
          taille="normale"
        />
        {/* Rien quand le projet n'a aucun jalon : « 0 sur 0 » dirait à tort
            qu'un chantier sans jalon n'a pas avancé, alors qu'il n'a rien à
            mesurer. La forme — libellé à gauche, mesure à droite, rail
            dessous — est celle de `GoalProgress` juste au-dessus, pour que
            les deux proportions de l'écran se lisent pareil. */}
        {avancement.total > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Avancement</span>
              <span className="font-data text-libelle tabular-nums text-champagne">
                {avancement.franchis} jalon{avancement.franchis > 1 ? 's' : ''} sur {avancement.total}
              </span>
            </div>
            <BarreProgression
              ratio={avancement.ratio}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={avancement.total}
              aria-valuenow={avancement.franchis}
              aria-label="Avancement du projet"
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Composition</h2>
        {children.length === 0 ? (
          <EmptyState>Aucun skill ni aucune tâche rattachés à ce projet.</EmptyState>
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

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Tags</h2>
        <ChampSauvegarde
          key={project.id}
          valeur={project.tags.join(', ')}
          onSave={handleTags}
          ariaLabel="Tags du projet"
          placeholder="Maison, Perso"
          confirmation="Tags enregistrés."
        />
      </section>

      <section>
        <h2 className="mb-1 font-sans text-corps font-semibold text-champagne">Notes</h2>
        <ChampSauvegarde
          key={project.id}
          valeur={project.notes ?? ''}
          onSave={(notes) => updateEngagement(project.id, { notes })}
          lignes={4}
          ariaLabel="Notes sur ce projet"
          placeholder="Aucune note. Écris ici ce que ce chantier demande…"
          confirmation="Notes enregistrées."
        />
      </section>


    </div>
  );
}

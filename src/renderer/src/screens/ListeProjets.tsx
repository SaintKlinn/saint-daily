import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useLiaisonsProjet } from '../hooks/useLiaisonsProjet';
import { useAllPracticeEntries } from '../hooks/usePracticeEntries';
import { useAllMilestones } from '../hooks/useMilestones';
import EmptyState from '../components/EmptyState';
import { buttonClassName } from '../components/Button';
import Toggle from '../components/Toggle';
import {
  avancementProjet,
  entreesDuProjet,
  formatDormance,
  membresDuProjet,
  tempsCumuleMinutes,
  trierProjets,
} from '../lib/projets';
import type { CritereTri } from '../lib/projets';
import { formatMinutes } from '../lib/retrospective';
import { daysSinceLastPractice } from '../lib/streaks';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

export default function ListeProjets() {
  const { engagements, loading, error } = useEngagements();
  const [voirArchives, setVoirArchives] = useState(false);
  // Le filtre est EN AMONT du tri, sur les projets et non sur les lignes
  // dérivées : un projet archivé ne doit pas seulement disparaître de
  // l'affichage, il ne doit pas non plus peser sur l'ensemble
  // d'identifiants envoyé aux deux requêtes groupées — celle des entrées de
  // pratique et celle des jalons.
  const projects = useMemo(
    () => engagements.filter((e) => e.isProject && (voirArchives || !e.archivedAt)),
    [engagements, voirArchives]
  );

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
  const { entriesBySkill, error: entriesError } = useAllPracticeEntries(idsConcernes);
  // `idsConcernes` réunit déjà membres et projets : on ne recalcule pas une
  // seconde liste pour les jalons. Les jalons des membres sont ramenés sans
  // être utilisés — c'est le prix d'une requête unique, plus faible que
  // celui d'une seconde requête pour le seul sous-ensemble des projets.
  const { milestonesByEngagement, error: jalonsError } = useAllMilestones(idsConcernes);
  const [critere, setCritere] = useState<CritereTri>('dormance');

  const lignes = useMemo(
    () =>
      projects.map((p) => {
        const entrees = entreesDuProjet(entriesBySkill, membresParProjet.get(p.id) ?? [], p.id);
        // L'avancement ne compte QUE les jalons du projet lui-même, jamais
        // ceux de ses membres : ce sont des livrables, pas des étapes
        // d'apprentissage. Voir `avancementProjet`.
        const { total, ratio } = avancementProjet(milestonesByEngagement[p.id] ?? []);
        return {
          id: p.id,
          nom: p.name,
          minutes: tempsCumuleMinutes(entrees),
          jours: daysSinceLastPractice(entrees),
          // `null` dit « aucun jalon », que le tri range en bas ; `0` dirait
          // « aucun jalon franchi », qui est autre chose.
          avancement: total === 0 ? null : ratio,
        };
      }),
    [projects, membresParProjet, entriesBySkill, milestonesByEngagement]
  );

  const lignesTriees = useMemo(() => trierProjets(lignes, critere), [lignes, critere]);
  const franchisParProjet = useMemo(() => {
    const parProjet = new Map<string, string>();
    for (const p of projects) {
      const { franchis, total } = avancementProjet(milestonesByEngagement[p.id] ?? []);
      if (total > 0) parProjet.set(p.id, `${franchis}/${total}`);
    }
    return parProjet;
  }, [projects, milestonesByEngagement]);
  // `projects` suffit : quand la bascule est fermée il ne contient aucun
  // projet en pause, et quand elle est ouverte il les contient tous — pas
  // besoin de repartir d'`engagements` pour les retrouver.
  const projetsArchives = useMemo(
    () => new Set(projects.filter((p) => p.archivedAt).map((p) => p.id)),
    [projects]
  );
  // Distinguer « rien à montrer parce que tout est en pause » de « rien à
  // montrer parce qu'il n'y a rien » : le premier se corrige avec la
  // bascule, le second en créant un projet.
  const projetsArchivesExistent = useMemo(
    () => engagements.some((e) => e.isProject && e.archivedAt),
    [engagements]
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-titre-ecran text-champagne">Projets</h1>
        <div className="flex items-center gap-3">
          <Toggle
            bordered={false}
            checked={voirArchives}
            onChange={setVoirArchives}
            label="Voir les projets en pause"
          />
          {/* Le défaut est « le plus dormant en haut » : savoir qu'un
              chantier n'a pas bougé depuis trois semaines est l'information
              qui donne une raison d'ouvrir cet écran, et un tri par défaut
              la met sous les yeux au lieu d'attendre qu'on la cherche. Le
              choix ne persiste pas — ce serait une colonne, donc une
              migration, pour épargner un clic. */}
          <label className="flex items-center gap-2 text-libelle uppercase tracking-[0.04em] text-muted">
            Trier par
            <select
              value={critere}
              onChange={(e) => setCritere(e.target.value as CritereTri)}
              aria-label="Critère de tri des projets"
              className={`border border-ink-700 bg-ink-800 px-3 py-2 font-sans normal-case tracking-normal text-corps text-champagne ${FOCUS_RING}`}
            >
              <option value="dormance">Dernière activité</option>
              <option value="temps">Temps cumulé</option>
              <option value="avancement">Avancement</option>
              <option value="nom">Nom</option>
            </select>
          </label>
          <Link to="/projets/nouveau" className={buttonClassName('primary')}>
            + Nouveau projet
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-corps text-danger">
          {error}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
          {entriesError}
        </p>
      )}
      {jalonsError && (
        <p role="alert" className="text-corps text-danger">
          {jalonsError}
        </p>
      )}

      {/* Hors du conteneur de liste, pour la même raison que dans
          ListeSkills : son fond plein dénaturait le cadre de l'EmptyState. */}
      {lignesTriees.length > 0 && (
      <div className="flex flex-col gap-px border border-ink-700 bg-ink-700">
        {lignesTriees.map((ligne) => {
          const archive = projetsArchives.has(ligne.id);
          return (
            <Link
              key={ligne.id}
              to={`/projets/${ligne.id}`}
              className={`flex items-center gap-2 bg-ink-800 p-4 transition-colors duration-200 hover:bg-ink-700 ${archive ? 'opacity-55' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-titre text-champagne">{ligne.nom}</span>
                  {archive && (
                    <span className="font-data text-libelle uppercase tracking-[0.08em] px-2 py-1 border border-muted text-muted">
                      En pause
                    </span>
                  )}
                </div>
                {/* Le point médian sépare des informations de même rang. Un
                    projet sans jalon n'en porte que deux : pas de « 0/0 ». */}
                <p className="mt-1 text-secondaire text-muted">
                  {formatMinutes(ligne.minutes)} · {formatDormance(ligne.jours)}
                  {franchisParProjet.has(ligne.id) ? ` · ${franchisParProjet.get(ligne.id)}` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      )}
      {!loading &&
        lignesTriees.length === 0 &&
        (projetsArchivesExistent ? (
          <EmptyState>Tous tes projets sont en pause. Active « Voir les projets en pause » pour les retrouver.</EmptyState>
        ) : (
          <EmptyState titre="Aucun projet pour l'instant" action={{ libelle: 'Créer un projet', vers: '/projets/nouveau' }}>
            Un projet regroupe des skills et des tâches autour d'un même but, avec ses jalons et son avancement.
          </EmptyState>
        ))}
    </div>
  );
}

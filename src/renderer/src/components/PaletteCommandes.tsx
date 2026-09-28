import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { usePomodoro } from '../lib/pomodoro';
import { getSupabaseClient } from '../lib/supabase';
import { basculerDateRepos, cleJourLocal, ecrireJoursRepos, useJoursRepos } from '../lib/joursRepos';
import { filtrerCommandes, positionsTrouvees, type Commande, type GroupeCommande } from '../lib/palette';
import {
  CalendarIcon,
  ChartIcon,
  FolderIcon,
  GearIcon,
  HomeIcon,
  MoonIcon,
  NotebookIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SkillIcon,
} from './icons';
import Dialogue from './Dialogue';

interface CommandeExecutable extends Commande {
  executer: () => void;
}

// Une icône par ligne : trois « Piano » de suite ne se distinguaient que
// par une mention en petit à droite (audit graphique, M8).
const ICONES: Record<string, ReactNode> = {
  accueil: <HomeIcon size={16} />,
  calendrier: <CalendarIcon size={16} />,
  skill: <SkillIcon size={16} />,
  projet: <FolderIcon size={16} />,
  journal: <NotebookIcon size={16} />,
  bilan: <ChartIcon size={16} />,
  reglages: <GearIcon size={16} />,
  ajout: <PlusIcon size={16} />,
  pomodoro: <PlayIcon size={16} />,
  pause: <PauseIcon size={16} />,
  repos: <MoonIcon size={16} />,
};

const ECRANS: [string, string, string, string[]?][] = [
  ['/', 'Accueil', 'accueil', ['maison', 'aujourd hui']],
  ['/calendrier', 'Calendrier', 'calendrier', ['agenda', 'semaine']],
  ['/skills', 'Skills', 'skill', ['compétences', 'liste']],
  ['/projets', 'Projets', 'projet'],
  ['/journal', 'Journal', 'journal', ['séances', 'historique', 'notes']],
  ['/bilan', 'Bilan', 'bilan', ['statistiques', 'stats', 'heatmap']],
  ['/pomodoro', 'Pomodoro', 'pomodoro', ['minuteur', 'timer']],
  ['/reglages', 'Réglages', 'reglages', ['paramètres', 'préférences', 'options']],
  ['/corbeille', 'Corbeille', 'journal', ['supprimés']],
];

const NB_RECENTS = 5;

/** Le libellé avec ses lettres trouvées en doré. */
function Surligne({ texte, recherche }: { texte: string; recherche: string }) {
  const positions = positionsTrouvees(texte, recherche);
  if (positions.size === 0) return <>{texte}</>;
  return (
    <>
      {[...texte].map((lettre, i) =>
        positions.has(i) ? (
          <mark key={i} className="bg-transparent text-accent-bright">
            {lettre}
          </mark>
        ) : (
          lettre
        )
      )}
    </>
  );
}

/**
 * Palette de commandes : Ctrl+K depuis n'importe quel écran pour aller à un
 * écran, un skill ou un projet, ou lancer une action sans passer par le
 * rail. Montée seulement quand elle est ouverte (voir AppShell) : ses
 * engagements sont chargés à l'ouverture, pas au démarrage de l'app.
 */
export default function PaletteCommandes({ onFermer }: { onFermer: () => void }) {
  const navigate = useNavigate();
  const { engagements, loading } = useEngagements();
  const pomodoro = usePomodoro();
  const repos = useJoursRepos();
  const [recherche, setRecherche] = useState('');
  const [actif, setActif] = useState(0);
  const listeRef = useRef<HTMLUListElement>(null);

  // Les engagements des dernières séances, pour un groupe « Récents » en
  // tête de la liste vide : ce qu'on vient chercher le plus souvent, sans
  // rien taper. Une requête légère, une seule fois à l'ouverture.
  const [idsRecents, setIdsRecents] = useState<string[]>([]);
  useEffect(() => {
    let annule = false;
    void getSupabaseClient()
      .from('practice_entry')
      .select('engagement_id')
      .order('practiced_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!annule && data) setIdsRecents([...new Set((data as { engagement_id: string }[]).map((r) => r.engagement_id))]);
      });
    return () => {
      annule = true;
    };
  }, []);

  const commandes = useMemo<CommandeExecutable[]>(() => {
    const aller = (chemin: string) => () => navigate(chemin);
    const aujourdhui = cleJourLocal(new Date());
    const enRepos = repos.dates.includes(aujourdhui);
    const actifs = engagements.filter((e) => !e.archivedAt);
    const skills = actifs.filter((e) => !e.scheduledAt && !e.isProject);
    const projets = actifs.filter((e) => e.isProject);
    const cheminDe = (e: { id: string; isProject: boolean }) => (e.isProject ? `/projets/${e.id}` : `/skills/${e.id}`);

    const liste: CommandeExecutable[] = [];
    const parId = new Map([...skills, ...projets].map((e) => [e.id, e]));
    for (const id of idsRecents) {
      const e = parId.get(id);
      if (!e) continue;
      liste.push({
        id: `recent-${e.id}`,
        groupe: 'Récents',
        libelle: e.name,
        detail: e.isProject ? 'Projet' : 'Skill',
        icone: e.isProject ? 'projet' : 'skill',
        sansRecherche: true,
        executer: aller(cheminDe(e)),
      });
      if (liste.length === NB_RECENTS) break;
    }

    const session = pomodoro.session;
    if (session && session.status === 'running') {
      liste.push({ id: 'pomodoro-pause', groupe: 'Actions', libelle: 'Mettre le pomodoro en pause', detail: session.skillName, icone: 'pause', executer: pomodoro.pause });
    } else if (session && session.status === 'paused') {
      liste.push({ id: 'pomodoro-reprendre', groupe: 'Actions', libelle: 'Reprendre le pomodoro', detail: session.skillName, icone: 'pomodoro', executer: pomodoro.resume });
    }
    liste.push(
      { id: 'nouvelle-entree', groupe: 'Actions', libelle: 'Nouvelle entrée', motsCles: ['logger', 'séance', 'ajouter'], icone: 'ajout', executer: aller('/entree/nouvelle') },
      { id: 'nouvelle-tache', groupe: 'Actions', libelle: 'Nouvelle tâche', motsCles: ['planifier', 'agenda'], icone: 'ajout', executer: aller('/taches/nouvelle') },
      { id: 'nouveau-skill', groupe: 'Actions', libelle: 'Nouveau skill', motsCles: ['créer', 'compétence'], icone: 'ajout', executer: aller('/skills/nouveau') },
      { id: 'nouveau-projet', groupe: 'Actions', libelle: 'Nouveau projet', motsCles: ['créer'], icone: 'ajout', executer: aller('/projets/nouveau') },
      {
        id: 'repos-aujourdhui',
        groupe: 'Actions',
        libelle: enRepos ? 'Annuler le jour de repos' : 'Jour de repos aujourd’hui',
        motsCles: ['pause', 'série', 'congé'],
        icone: 'repos',
        executer: () => ecrireJoursRepos(basculerDateRepos(repos, aujourdhui)),
      }
    );
    for (const [chemin, libelle, icone, motsCles] of ECRANS) {
      liste.push({ id: `ecran-${chemin}`, groupe: 'Écrans', libelle, motsCles, icone, executer: aller(chemin) });
    }
    for (const skill of skills) {
      liste.push(
        { id: `skill-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Ouvrir la fiche', motsCles: skill.tags, icone: 'skill', executer: aller(`/skills/${skill.id}`) },
        { id: `entree-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Nouvelle entrée', motsCles: ['logger', 'séance'], icone: 'ajout', surRecherche: true, executer: aller(`/entree/nouvelle?skillId=${skill.id}`) },
        { id: `pomodoro-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Démarrer un pomodoro', icone: 'pomodoro', surRecherche: true, executer: aller(`/pomodoro?skillId=${skill.id}`) }
      );
    }
    for (const projet of projets) {
      liste.push(
        { id: `projet-${projet.id}`, groupe: 'Projets', libelle: projet.name, detail: 'Ouvrir le projet', motsCles: projet.tags, icone: 'projet', executer: aller(`/projets/${projet.id}`) },
        { id: `chantier-${projet.id}`, groupe: 'Projets', libelle: projet.name, detail: 'Session de chantier', motsCles: ['pomodoro'], icone: 'pomodoro', surRecherche: true, executer: aller(`/pomodoro?skillId=${projet.id}`) }
      );
    }
    return liste;
  }, [engagements, idsRecents, navigate, pomodoro.session, pomodoro.pause, pomodoro.resume, repos]);

  const resultats = useMemo<CommandeExecutable[]>(() => {
    const trouves = filtrerCommandes(commandes, recherche) as CommandeExecutable[];
    // Rien ne correspond : on propose de créer ce qu'on cherchait plutôt
    // qu'une impasse (audit graphique, M8).
    const saisie = recherche.trim();
    if (trouves.length === 0 && saisie && !loading) {
      return [
        {
          id: 'creer-skill',
          groupe: 'Actions',
          libelle: `Créer le skill « ${saisie} »`,
          detail: 'Rien ne correspond',
          icone: 'ajout',
          executer: () => navigate(`/skills/nouveau?nom=${encodeURIComponent(saisie)}`),
        },
      ];
    }
    return trouves;
  }, [commandes, recherche, loading, navigate]);

  useEffect(() => setActif(0), [recherche]);
  useEffect(() => {
    listeRef.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function executer(commande: CommandeExecutable | undefined) {
    if (!commande) return;
    onFermer();
    commande.executer();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (resultats.length ? (i + 1) % resultats.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (resultats.length ? (i - 1 + resultats.length) % resultats.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executer(resultats[actif]);
    }
  }

  let groupePrecedent: GroupeCommande | null = null;
  const enRecherche = recherche.trim() !== '';

  return (
    <Dialogue
      onFermer={onFermer}
      libelle="Palette de commandes"
      placement="haut"
      className="flex max-h-[70vh] w-full max-w-xl flex-col"
    >
      <div className="flex items-center gap-3 border-b border-ink-700 px-4">
        <SearchIcon className="shrink-0 text-muted" />
        <input
          autoFocus
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Aller à un écran, un skill, une action…"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-resultats"
          aria-activedescendant={resultats[actif] ? `palette-${resultats[actif].id}` : undefined}
          aria-autocomplete="list"
          className="h-12 flex-1 bg-transparent text-corps text-champagne placeholder:text-muted focus:outline-none"
        />
        <kbd className="border border-ink-700 px-1.5 py-0.5 font-data text-libelle text-muted">Échap</kbd>
      </div>
      <ul id="palette-resultats" role="listbox" ref={listeRef} className="flex-1 overflow-y-auto py-2">
        {resultats.length === 0 && (
          <li className="px-4 py-3 text-secondaire text-muted">{loading ? 'Chargement…' : 'Rien ne correspond.'}</li>
        )}
        {resultats.map((commande, index) => {
          const titre = commande.groupe !== groupePrecedent && !enRecherche ? commande.groupe : null;
          groupePrecedent = commande.groupe;
          return (
            <li key={commande.id} role="presentation">
              {titre && (
                <p className="px-4 pb-1 pt-3 font-data text-libelle uppercase tracking-[0.1em] text-muted first:pt-1">
                  {titre}
                </p>
              )}
              <div
                id={`palette-${commande.id}`}
                role="option"
                aria-selected={index === actif}
                data-index={index}
                onMouseMove={() => setActif(index)}
                onClick={() => executer(commande)}
                className={`mx-2 flex cursor-pointer items-center gap-3 px-3 py-2 ${index === actif ? 'bg-ink-700 text-champagne' : 'text-champagne/90'}`}
              >
                <span className={`flex w-4 shrink-0 justify-center ${index === actif ? 'text-accent-bright' : 'text-muted'}`}>
                  {commande.icone ? ICONES[commande.icone] : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-corps">
                  {commande.id === 'creer-skill' ? commande.libelle : <Surligne texte={commande.libelle} recherche={recherche} />}
                </span>
                <span className="shrink-0 font-data text-libelle text-muted">
                  {commande.detail ?? (enRecherche ? commande.groupe : '')}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-ink-700 px-4 py-2 font-data text-libelle text-muted">
        ↑↓ pour choisir · Entrée pour valider · Ctrl+K pour ouvrir ou fermer
      </p>
    </Dialogue>
  );
}

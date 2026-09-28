import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEngagements } from '../hooks/useEngagements';
import { usePomodoro } from '../lib/pomodoro';
import { basculerDateRepos, cleJourLocal, ecrireJoursRepos, useJoursRepos } from '../lib/joursRepos';
import { filtrerCommandes, type Commande, type GroupeCommande } from '../lib/palette';
import { SearchIcon } from './icons';
import { EASE_SORTIE } from '../theme/mouvement';

interface CommandeExecutable extends Commande {
  executer: () => void;
}

const ECRANS: [string, string, string[]?][] = [
  ['/', 'Accueil', ['maison', 'aujourd hui']],
  ['/calendrier', 'Calendrier', ['agenda', 'semaine']],
  ['/skills', 'Skills', ['compétences', 'liste']],
  ['/projets', 'Projets'],
  ['/journal', 'Journal', ['séances', 'historique', 'notes']],
  ['/bilan', 'Bilan', ['statistiques', 'stats', 'heatmap']],
  ['/pomodoro', 'Pomodoro', ['minuteur', 'timer']],
  ['/reglages', 'Réglages', ['paramètres', 'préférences', 'options']],
  ['/corbeille', 'Corbeille', ['supprimés']],
];

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

  const commandes = useMemo<CommandeExecutable[]>(() => {
    const aller = (chemin: string) => () => navigate(chemin);
    const aujourdhui = cleJourLocal(new Date());
    const enRepos = repos.dates.includes(aujourdhui);
    const liste: CommandeExecutable[] = [
      { id: 'nouvelle-entree', groupe: 'Actions', libelle: 'Nouvelle entrée', motsCles: ['logger', 'séance', 'ajouter'], executer: aller('/entree/nouvelle') },
      { id: 'nouvelle-tache', groupe: 'Actions', libelle: 'Nouvelle tâche', motsCles: ['planifier', 'agenda'], executer: aller('/taches/nouvelle') },
      { id: 'nouveau-skill', groupe: 'Actions', libelle: 'Nouveau skill', motsCles: ['créer', 'compétence'], executer: aller('/skills/nouveau') },
      { id: 'nouveau-projet', groupe: 'Actions', libelle: 'Nouveau projet', motsCles: ['créer'], executer: aller('/projets/nouveau') },
      {
        id: 'repos-aujourdhui',
        groupe: 'Actions',
        libelle: enRepos ? 'Annuler le jour de repos' : 'Jour de repos aujourd’hui',
        motsCles: ['pause', 'série', 'congé'],
        executer: () => ecrireJoursRepos(basculerDateRepos(repos, aujourdhui)),
      },
    ];
    const session = pomodoro.session;
    if (session && session.status === 'running') {
      liste.unshift({ id: 'pomodoro-pause', groupe: 'Actions', libelle: 'Mettre le pomodoro en pause', detail: session.skillName, executer: pomodoro.pause });
    } else if (session && session.status === 'paused') {
      liste.unshift({ id: 'pomodoro-reprendre', groupe: 'Actions', libelle: 'Reprendre le pomodoro', detail: session.skillName, executer: pomodoro.resume });
    }
    for (const [chemin, libelle, motsCles] of ECRANS) {
      liste.push({ id: `ecran-${chemin}`, groupe: 'Écrans', libelle, motsCles, executer: aller(chemin) });
    }
    const actifs = engagements.filter((e) => !e.archivedAt);
    for (const skill of actifs.filter((e) => !e.scheduledAt && !e.isProject)) {
      liste.push(
        { id: `skill-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Ouvrir la fiche', motsCles: skill.tags, executer: aller(`/skills/${skill.id}`) },
        { id: `entree-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Nouvelle entrée', motsCles: ['logger', 'séance'], surRecherche: true, executer: aller(`/entree/nouvelle?skillId=${skill.id}`) },
        { id: `pomodoro-${skill.id}`, groupe: 'Skills', libelle: skill.name, detail: 'Démarrer un pomodoro', surRecherche: true, executer: aller(`/pomodoro?skillId=${skill.id}`) }
      );
    }
    for (const projet of actifs.filter((e) => e.isProject)) {
      liste.push(
        { id: `projet-${projet.id}`, groupe: 'Projets', libelle: projet.name, detail: 'Ouvrir le projet', motsCles: projet.tags, executer: aller(`/projets/${projet.id}`) },
        { id: `chantier-${projet.id}`, groupe: 'Projets', libelle: projet.name, detail: 'Session de chantier', motsCles: ['pomodoro'], surRecherche: true, executer: aller(`/pomodoro?skillId=${projet.id}`) }
      );
    }
    return liste;
  }, [engagements, navigate, pomodoro.session, pomodoro.pause, pomodoro.resume, repos]);

  // Sans recherche, les skills et projets restent accessibles mais après
  // les actions et les écrans ; la liste est bornée pour rester lisible.
  const resultats = useMemo(() => filtrerCommandes(commandes, recherche) as CommandeExecutable[], [commandes, recherche]);

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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onFermer();
    }
  }

  let groupePrecedent: GroupeCommande | null = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/60 px-6 pt-[12vh]" onClick={onFermer}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: EASE_SORTIE }}
        className="flex max-h-[70vh] w-full max-w-xl flex-col border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
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
          <kbd className="font-data text-libelle text-muted">Échap</kbd>
        </div>
        <ul id="palette-resultats" role="listbox" ref={listeRef} className="flex-1 overflow-y-auto py-2">
          {resultats.length === 0 && (
            <li className="px-4 py-3 text-secondaire text-muted">
              {loading ? 'Chargement…' : 'Rien ne correspond.'}
            </li>
          )}
          {resultats.map((commande, index) => {
            const titre = commande.groupe !== groupePrecedent && !recherche.trim() ? commande.groupe : null;
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
                  className={`mx-2 flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 ${index === actif ? 'bg-ink-700 text-champagne' : 'text-champagne/90'}`}
                >
                  <span className="truncate text-corps">{commande.libelle}</span>
                  <span className="shrink-0 font-data text-libelle text-muted">
                    {commande.detail ?? (recherche.trim() ? commande.groupe : '')}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-ink-700 px-4 py-2 font-data text-libelle text-muted">
          ↑↓ pour choisir · Entrée pour valider · Ctrl+K pour ouvrir ou fermer
        </p>
      </motion.div>
    </div>
  );
}

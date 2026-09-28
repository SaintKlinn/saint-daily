import { Fragment, Suspense, useEffect, useRef, useState, type JSX } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import RailFlare from './RailFlare';
import UpdateBanner from './UpdateBanner';
import FondAmbiant from './FondAmbiant';
import PaletteCommandes from './PaletteCommandes';
import {
  HomeIcon,
  SkillIcon,
  CalendarIcon,
  FolderIcon,
  ChartIcon,
  NotebookIcon,
  GearIcon,
  ChevronsIcon,
} from './icons';
import { GROUPES_NAV, type CleIcone } from '../lib/navigation';
import { colors } from '../theme/colors';
import { EASE_SORTIE } from '../theme/mouvement';
import { prechargerEcrans } from '../ecrans';
import { useEngagements } from '../hooks/useEngagements';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, planMissingOccurrences } from '../lib/recurrence';
import { ecrireRailEpingle, lireRailEpingle } from '../lib/preferencesAffichage';

// La correspondance clé -> composant vit ici et non dans navigation.ts,
// qui doit rester libre de React pour être testable sans moteur de rendu.
// Le `Record<CleIcone, …>` la rend exhaustive : ajouter une clé sans son
// icône ne compile pas.
const ICONES: Record<CleIcone, (props: { size?: number; className?: string }) => JSX.Element> = {
  accueil: HomeIcon,
  calendrier: CalendarIcon,
  skill: SkillIcon,
  projets: FolderIcon,
  journal: NotebookIcon,
  bilan: ChartIcon,
  reglages: GearIcon,
};

// Constantes de MISE EN PAGE, pas crans d'espacement — le 72 d'origine ne
// l'a jamais été non plus. 200 se calcule : 16 de marge + 40 d'icône + 12
// d'écart + 96 de colonne de libellé + 16 de marge = 180, arrondis à 200
// pour que « Calendrier » en 13 px ne soit pas serré contre le bord.
const RAIL_REPLIE = 72;
const RAIL_DEPLIE = 200;

export default function AppShell() {
  const { engagements, loading, createEngagements } = useEngagements();
  const hasSyncedRecurrenceRef = useRef(false);

  // Initialisation paresseuse : la lecture du stockage ne doit avoir lieu
  // qu'une fois, pas à chaque rendu du shell.
  const [epingle, setEpingle] = useState(() => lireRailEpingle());

  // Persistance dans un effet, et non dans l'updater de `setEpingle` :
  // React exige que les updaters soient purs et les invoque deux fois sous
  // StrictMode pour faire apparaître les effets de bord qui s'y cachent —
  // l'écriture y aurait donc eu lieu deux fois par bascule en développement.
  // Le dépôt s'est déjà fait prendre par cette double invocation, voir
  // hooks/useSettings.ts. L'updater reste fonctionnel pour ne pas capturer
  // un `epingle` périmé sur deux clics rapprochés.
  useEffect(() => {
    ecrireRailEpingle(epingle);
  }, [epingle]);

  // Transition d'écran : entrée seule, sans sortie. Une sortie animée
  // (AnimatePresence) retiendrait l'ancien écran le temps de son départ,
  // donc retarderait chaque navigation — sur un outil qu'on ouvre dix fois
  // par jour, la réactivité passe avant la chorégraphie. La clé est le
  // chemin et non la route : passer d'un skill à un autre rejoue aussi
  // l'entrée, ce qui signale que le contenu a changé.
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // `<main>` défile, pas la fenêtre : sans remise à zéro, un écran s'ouvrait
  // à la hauteur où l'on avait laissé le précédent.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Une fois le rail et le premier écran affichés, les autres écrans sont
  // chargés quand le navigateur n'a rien d'autre à faire : l'ouverture reste
  // légère, et aucune navigation n'attend ensuite son fichier.
  useEffect(() => {
    const planifier = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    const id = planifier(() => prechargerEcrans());
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, []);

  // Le logo du rail joue deux cycles quand on revient sur la fenêtre ou
  // qu'on survole le rail, puis se pose (voir `.logo-ray-regard`). Pas de
  // relance pendant qu'il joue encore : repartir en plein milieu ferait
  // sauter les traits. 9 s = deux cycles de 4,5 s.
  const [relanceLogo, setRelanceLogo] = useState(0);
  const derniereRelanceRef = useRef(Date.now());
  function relancerLogo() {
    if (Date.now() - derniereRelanceRef.current < 9000) return;
    derniereRelanceRef.current = Date.now();
    setRelanceLogo((n) => n + 1);
  }
  useEffect(() => {
    window.addEventListener('focus', relancerLogo);
    return () => window.removeEventListener('focus', relancerLogo);
  }, []);

  // Palette de commandes : Ctrl+K (Cmd+K sur macOS) l'ouvre et la ferme.
  // Pas en mode focus, route sœur hors d'AppShell : ce mode veut justement
  // qu'on ne parte nulle part. À la fermeture, le focus revient là où il
  // était, pour qu'un clavier ne se retrouve pas en haut de la page.
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const focusAvantPaletteRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setPaletteOuverte((ouverte) => {
        if (!ouverte) focusAvantPaletteRef.current = document.activeElement as HTMLElement | null;
        return !ouverte;
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => {
    if (!paletteOuverte) focusAvantPaletteRef.current?.focus?.();
  }, [paletteOuverte]);

  function basculerEpinglage() {
    setEpingle((actuel) => !actuel);
  }

  // useEngagementReminders et useTrayNextEngagement sont montés dans
  // AppProvidersLayout (App.tsx), pas ici : ce sont des propriétés de « l'app
  // est ouverte et authentifiée », pas de « le rail de navigation est
  // affiché ». Les garder ici les aurait démontés en entrant en mode focus
  // (route soeur, hors AppShell), et donc silencieusement fait manquer tout
  // rappel ou mise à jour d'infobulle pendant la session focus.

  useEffect(() => {
    if (loading || hasSyncedRecurrenceRef.current) return;
    hasSyncedRecurrenceRef.current = true;
    async function syncRecurringSeries() {
      const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
      const planned = planMissingOccurrences(engagements, windowEnd);
      const inputs = [];
      for (const occurrence of planned) {
        const template = engagements.find((e) => e.id === occurrence.templateId);
        if (!template) continue;
        inputs.push({
          name: template.name,
          tags: template.tags,
          priority: template.priority,
          projectId: template.projectId,
          scheduledAt: occurrence.scheduledAt,
          scheduledEndsAt: occurrence.scheduledEndsAt,
          recurrenceSeriesId: occurrence.seriesId,
          recurrenceType: template.recurrenceType,
          recurrenceInterval: template.recurrenceInterval,
          recurrenceWeekdays: template.recurrenceWeekdays,
        });
      }
      if (inputs.length > 0) {
        await createEngagements(inputs);
      }
    }
    syncRecurringSeries();
    // `hasSyncedRecurrenceRef` (pas seulement `loading` en dépendance) est
    // ce qui garantit un seul passage : `createEngagement` appelle son
    // propre `refresh()` en interne, qui fait basculer `loading` à chaque
    // occurrence créée (false -> true -> false), donc `[loading]` seul
    // aurait refait tourner cet effet en pleine boucle et pu créer des
    // occurrences en double pour une série avec plusieurs occurrences de
    // retard (le cas normal, la fenêtre fait 56 jours). Le ref bloque tout
    // second déclenchement indépendamment de ces bascules ultérieures.
  }, [loading]);

  return (
    <div className="flex h-screen flex-col bg-ink-900 text-champagne">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      <motion.nav
        // Tween et non ressort : un ressort dépasse sa cible, et chaque
        // image de dépassement force un recalcul de mise en page de tout
        // <main>. 0,16/1/0,3/1 est la courbe déjà employée par
        // logo-ray-reveal et l'en-tête d'Accueil.
        animate={{ width: epingle ? RAIL_DEPLIE : RAIL_REPLIE }}
        initial={false}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex shrink-0 flex-col items-center gap-10 overflow-hidden border-r border-ink-700 pt-6"
        onMouseEnter={relancerLogo}
        style={{
          background: `linear-gradient(180deg, ${colors.ink[900]} 0%, #054838 55%, ${colors.ink[950]} 100%)`,
        }}
      >
        <div
          aria-hidden="true"
          className="rail-halo pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 70%)` }}
        />
        {/* `shrink-0` : sans lui, le logo est le seul enfant rétrécissable de
            ce `flex-col` et devient donc le premier sacrifié quand le rail
            manque de hauteur. Mesuré : à 637 px de fenêtre il garde ses
            32 px, à 632 px il tombe à 27. La fenêtre impose `minHeight: 640`
            (main/index.ts), soit trois pixels de marge — la prochaine entrée
            ajoutée au rail (40 + 8) l'écraserait silencieusement à la taille
            minimale autorisée. */}
        <LogoMark width={48} height={32} animation="regard" relance={relanceLogo} className="relative shrink-0" />
        {/* `flex-1` : c'est ce bloc, et non la ligne de compte, qui porte
            la poussée vers le bas — `mt-auto` s'applique au groupe
            Réglages à l'intérieur. */}
        <div className="relative flex w-full flex-1 flex-col items-center gap-3">
          {GROUPES_NAV.map((groupe, index) => (
            <Fragment key={groupe.entrees[0].to}>
              {/* Filet entre les deux premiers groupes. 12 px de part et
                  d'autre (cran 3) : la distance entre groupes se lit 24 px,
                  plus l'épaisseur du trait, qui est un filet et non un
                  espacement — même statut que `gap-px` dans la spec
                  typographique. Pas de filet devant le groupe ancré en
                  bas : `mt-auto` l'éloigne déjà sans ambiguïté. */}
              {index > 0 && !groupe.ancreEnBas && (
                <span aria-hidden="true" className="h-px w-8 shrink-0 bg-ink-700" />
              )}
              <div
                className={`flex w-full flex-col items-center gap-2 ${groupe.ancreEnBas ? 'mt-auto' : ''}`}
              >
                {groupe.entrees.map(({ to, libelle, icone, exact }) => {
                  const Icon = ICONES[icone];
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={exact}
                      title={epingle ? undefined : libelle}
                      aria-label={libelle}
                      // Pleine largeur, et rien d'autre que l'icône à droite
                      // quand le rail est replié : c'est ce qui permet
                      // d'ancrer la barre active au bord du RAIL et non au
                      // bord de l'icône, donc de lui garder le même x dans
                      // les deux largeurs. `px-4` (16 px) de chaque côté
                      // d'une icône de 40 donne exactement les 72 px du
                      // rail replié.
                      //
                      // `focus-visible:ring-inset` : la ligne est pleine
                      // largeur et flush avec un rail qui masque son
                      // dépassement (`overflow-hidden`) — un anneau vers
                      // l'extérieur serait donc coupé des deux côtés. On le
                      // dessine plutôt vers l'intérieur.
                      className="relative flex h-10 w-full items-center rounded-[10px] px-4 text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:ring-inset"
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="nav-active-bar"
                              // PIÈGE : surtout pas de `-translate-y-1/2`
                              // ici. Motion pilote `transform` en propre
                              // pendant une animation de `layoutId` et le
                              // remet à `none` quand l'animation de layout
                              // se pose, ce qui laissait la barre 10 px
                              // trop bas — le défaut que cette tâche
                              // corrige. Le centrage passe donc par
                              // `top-0 bottom-0 my-auto`, qui ne touche
                              // pas à `transform`.
                              className="absolute left-1 top-0 bottom-0 my-auto h-5 w-[3px] rounded-full bg-accent-bright"
                              style={{ boxShadow: `0 0 10px ${colors.accent.bright}b3` }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          {isActive && (
                            // La pastille est posée sur le LIEN et non sur
                            // la case d'icône : elle couvre donc la ligne
                            // entière et s'étend d'elle-même à 200 px quand
                            // le rail est déplié, pour que l'état actif
                            // porte icône ET libellé.
                            //
                            // Conséquence visible à contrôler en live : le
                            // halo de l'élément actif fait désormais 72 px
                            // de large au lieu de 40 même rail replié.
                            // C'est voulu — c'est une ligne active, plus
                            // une case active.
                            <motion.span
                              layoutId="nav-active-pill"
                              className="absolute inset-0 rounded-[10px]"
                              style={{
                                background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 72%)`,
                              }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                            <Icon className={`relative ${isActive ? 'text-accent-bright' : ''}`} />
                          </span>
                          {/* Monté dans les deux états, jamais démonté :
                              le démonter couperait la transition en deux
                              et ferait apparaître le texte d'un bloc à la
                              fin. `aria-hidden` dans les deux états aussi,
                              parce que l'`aria-label` du lien est déjà le
                              nom accessible — sans quoi il serait annoncé
                              deux fois une fois le rail déplié. */}
                          <span
                            aria-hidden="true"
                            className={`ml-3 truncate text-secondaire transition-opacity duration-200 ${
                              epingle ? 'opacity-100' : 'pointer-events-none opacity-0'
                            } ${isActive ? 'text-accent-bright' : ''}`}
                          >
                            {libelle}
                          </span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
        {/* Pas de pastille de compte ici : l'identité vit dans le héros
            d'Accueil (« Bon retour <Pseudo> », cliquable) et dans la section
            Compte en tête de Réglages. Une troisième porte d'entrée en bas du
            rail ferait doublon avec les deux, et le bas du rail appartient à
            la commande de dépliage. */}
        <button
          type="button"
          onClick={basculerEpinglage}
          aria-pressed={epingle}
          aria-label={epingle ? 'Replier le rail de navigation' : 'Déplier le rail de navigation'}
          title={epingle ? 'Replier le rail' : 'Déplier le rail'}
          className="relative mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
        >
          <ChevronsIcon direction={epingle ? 'gauche' : 'droite'} />
        </button>
        <RailFlare />
      </motion.nav>
      {/* Le fond d'ambiance vit à côté de <main> et non dedans : <main>
          défile, et le halo doit rester en haut de la fenêtre. */}
      <div className="relative min-w-0 flex-1">
      <FondAmbiant />
      <main ref={mainRef} className="relative h-full overflow-y-auto px-12 py-12">
        {/* Fondu court et 6 px seulement : les écrans ont déjà leurs
            propres cascades (Accueil, Bilan), cette entrée ne fait que
            lier la navigation à l'apparition du contenu sans la doubler. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_SORTIE }}
          // `h-full` : Introuvable centre son contenu sur la hauteur de
          // <main>, ce que ce conteneur intercalé ne doit pas lui retirer.
          className="h-full"
        >
          {/* Le rail reste en place pendant qu'un écran se charge. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
      </div>
      </div>
      {paletteOuverte && <PaletteCommandes onFermer={() => setPaletteOuverte(false)} />}
    </div>
  );
}

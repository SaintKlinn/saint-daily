import { Fragment, useEffect, useRef, type JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import LogoMark from './LogoMark';
import PastilleCompte from './PastilleCompte';
import RailFlare from './RailFlare';
import UpdateBanner from './UpdateBanner';
import {
  HomeIcon,
  SkillIcon,
  CalendarIcon,
  FolderIcon,
  ChartIcon,
  NotebookIcon,
  GearIcon,
} from './icons';
import { GROUPES_NAV, type CleIcone } from '../lib/navigation';
import { colors } from '../theme/colors';
import { useEngagements } from '../hooks/useEngagements';
import { addDays } from '../lib/calendarLayout';
import { RECURRENCE_WINDOW_DAYS, planMissingOccurrences } from '../lib/recurrence';

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

export default function AppShell() {
  const { engagements, loading, createEngagements } = useEngagements();
  const hasSyncedRecurrenceRef = useRef(false);

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
      <nav
        className="relative flex w-[72px] min-w-[72px] flex-col items-center gap-10 overflow-hidden border-r border-ink-700 pt-6"
        style={{ background: `linear-gradient(180deg, ${colors.ink[900]} 0%, #054838 55%, ${colors.ink[950]} 100%)` }}
      >
        <div
          aria-hidden="true"
          className="rail-halo pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${colors.accent.bright}29, transparent 70%)` }}
        />
        <LogoMark width={30} height={20} animated className="relative" />
        {/* `flex-1` : c'est ce bloc, et non la pastille, qui porte
            désormais la poussée vers le bas — `mt-auto` s'applique au
            groupe Réglages à l'intérieur. */}
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
                      title={libelle}
                      aria-label={libelle}
                      // Pleine largeur dès maintenant, même si rien n'est
                      // encore affiché à droite de l'icône : c'est ce qui
                      // permet d'ancrer la barre active au bord du RAIL et
                      // non au bord de l'icône, donc de lui garder le même
                      // x quand la tâche 5 introduira la seconde largeur.
                      // `px-4` (16 px) de chaque côté d'une icône de 40
                      // donne exactement les 72 px du rail replié.
                      className="relative flex h-10 w-full items-center rounded-[10px] px-4 text-muted transition-colors hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
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
                            // entière, et s'étendra d'elle-même à 200 px
                            // quand la tâche 5 dépliera le rail, pour que
                            // l'état actif porte icône ET libellé.
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
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
        <PastilleCompte />
        <RailFlare />
      </nav>
      <main
        className="flex-1 overflow-y-auto px-12 py-12"
        style={{
          backgroundImage: `radial-gradient(ellipse 1100px 560px at 62% -6%, ${colors.accent.bright}1a, transparent 62%), radial-gradient(ellipse 700px 420px at 8% 78%, ${colors.accent.bright}0c, transparent 68%)`,
        }}
      >
        <Outlet />
      </main>
      </div>
    </div>
  );
}

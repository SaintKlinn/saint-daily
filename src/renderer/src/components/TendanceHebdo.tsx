import { motion } from 'motion/react';
import { formatMinutes, type WeekBucket } from '../lib/retrospective';
import { EASE_SORTIE } from '../theme/mouvement';

interface TendanceHebdoProps {
  semaines: WeekBucket[];
}

// Hauteur en pixels plutôt qu'en pourcentage, pour la même raison que
// MeilleureHeureProductivite : chaque colonne porte aussi son compteur, la
// hauteur résolue du parent flex serait fragile.
const BAR_MAX_PX = 112;

function libelleSemaine(debut: Date): string {
  return debut.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function titreColonne(semaine: WeekBucket): string {
  const debut = semaine.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const prefixe = semaine.isCurrent ? 'Semaine en cours' : `Semaine du ${debut}`;
  if (semaine.sessions === 0) return `${prefixe} — aucune séance`;
  return `${prefixe} — ${formatMinutes(semaine.minutes)} · ${semaine.sessions} séance${semaine.sessions > 1 ? 's' : ''}`;
}

export default function TendanceHebdo({ semaines }: TendanceHebdoProps) {
  const max = Math.max(...semaines.map((semaine) => semaine.minutes), 0);
  const total = semaines.reduce((somme, semaine) => somme + semaine.minutes, 0);
  if (total === 0) {
    return <p className="text-secondaire text-muted">Aucun temps de pratique sur les douze dernières semaines.</p>;
  }
  const moyenne = Math.round(total / semaines.length);
  const hauteurMoyenne = Math.round((moyenne / max) * BAR_MAX_PX);
  const meilleure = semaines.reduce((a, b) => (b.minutes > a.minutes ? b : a));

  // La phrase porte l'information que le graphique dessine : moyenne et
  // meilleure semaine sont lisibles sans percevoir les hauteurs de barres.
  const resume = `Moyenne de ${formatMinutes(moyenne)} par semaine. Meilleure semaine : ${
    meilleure.isCurrent ? 'celle-ci' : `celle du ${meilleure.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
  }, avec ${formatMinutes(meilleure.minutes)}.`;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`Temps de pratique par semaine sur les douze dernières semaines. ${resume}`}
        className="flex flex-col gap-2"
      >
        {/* Zone de hauteur fixe, barres posées sur son bord bas : la ligne
            de moyenne s'y positionne en absolu depuis ce même bord, donc sur
            la même échelle que les barres. Les 20 px en plus sont la place
            du compteur (11 px × 1,45 d'interlignage + 4 px d'écart) au-dessus
            de la plus haute barre. */}
        <div className="relative flex items-end gap-2" style={{ height: BAR_MAX_PX + 20 }}>
          {/* Filet pointillé et non plein : il se lit comme un repère, pas
              comme une donnée de plus. `muted` pour rester en retrait des
              barres or, qui portent la donnée. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/60"
            style={{ bottom: hauteurMoyenne }}
          >
            <span className="absolute -top-5 right-0 bg-ink-800 pl-2 font-data text-libelle text-muted">moy.</span>
          </div>
          {semaines.map((semaine, index) => {
            const hauteur = max === 0 ? 0 : Math.round((semaine.minutes / max) * BAR_MAX_PX);
            const delai = 0.15 + index * 0.035;
            return (
              <div
                key={semaine.weekStart.toISOString()}
                title={titreColonne(semaine)}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                {/* Le compteur arrive avec sa barre : affiché avant elle, il
                    flottait au-dessus d'un vide le temps de la cascade. */}
                <motion.span
                  className="max-w-full truncate font-data text-libelle tabular-nums text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: delai }}
                >
                  {semaine.minutes === 0 ? '—' : formatMinutes(semaine.minutes)}
                </motion.span>
                {/* Rien à zéro minute plutôt qu'un filet : même règle que
                    MeilleureHeureProductivite, un trait d'or se lirait comme
                    une activité minuscule. Minimum de 3 px sinon, pour qu'une
                    petite semaine face à une grosse reste visible.

                    Pousse depuis la base (`originY: 1`), une colonne après
                    l'autre : le regard suit la chronologie de gauche à
                    droite. `scaleY` est une transformation, donc coupée
                    d'office par <MotionConfig reducedMotion="user">. */}
                {semaine.minutes > 0 && (
                  // 40 px au plus : en pleine largeur, douze barres côte à
                  // côte formaient un seul bloc d'or où l'œil ne distinguait
                  // plus les semaines.
                  <motion.div
                    className="w-full max-w-10 bg-accent-bright"
                    style={{ height: Math.max(hauteur, 3), originY: 1 }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, ease: EASE_SORTIE, delay: delai }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          {semaines.map((semaine) => (
            <div key={semaine.weekStart.toISOString()} className="flex min-w-0 flex-1 justify-center">
              {/* La semaine en cours est désignée par la pastille bordée,
                  l'idiome de MeilleureHeureProductivite, et non par une
                  teinte de barre différente : deux ors voisins ne se
                  distinguent pas (voir BarreProgression). */}
              <span
                className={`max-w-full truncate border px-1 font-data text-libelle tabular-nums ${
                  semaine.isCurrent ? 'border-accent-bright text-accent-bright' : 'border-transparent text-muted'
                }`}
              >
                {libelleSemaine(semaine.weekStart)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-secondaire text-muted">{resume}</p>
    </div>
  );
}

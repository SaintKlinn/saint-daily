import { motion } from 'motion/react';
import { formatMinutes } from '../lib/retrospective';
import type { JourAffiche } from '../lib/historiquePomodoro';
import { EASE_SORTIE } from '../theme/mouvement';

interface PomodorosSemaineProps {
  jours: JourAffiche[];
}

// Même construction que TendanceHebdo, en plus petit : compteur au-dessus,
// barre qui pousse depuis sa base, jour en dessous, aujourd'hui encadré.
const BAR_MAX_PX = 72;

function libelleJour(date: Date): string {
  // « lun. », « mar. »… : l'initiale seule confondrait mardi et mercredi.
  return date.toLocaleDateString('fr-FR', { weekday: 'short' });
}

export default function PomodorosSemaine({ jours }: PomodorosSemaineProps) {
  const total = jours.reduce((s, j) => s + j.cycles, 0);
  const minutes = jours.reduce((s, j) => s + j.minutes, 0);
  const aujourdhui = jours[jours.length - 1];
  if (total === 0) {
    return (
      <p className="text-secondaire text-muted">
        Aucun pomodoro terminé ces sept derniers jours sur cet ordinateur.
      </p>
    );
  }
  const max = Math.max(...jours.map((j) => j.cycles), 1);
  const resume = `${total} pomodoro${total > 1 ? 's' : ''} terminé${total > 1 ? 's' : ''} en sept jours (${formatMinutes(
    minutes
  )}), dont ${aujourdhui.cycles} aujourd'hui.`;
  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={resume} className="flex flex-col gap-2">
        <div className="flex items-end gap-2" style={{ height: BAR_MAX_PX + 20 }}>
          {jours.map((jour, index) => {
            const hauteur = Math.round((jour.cycles / max) * BAR_MAX_PX);
            const delai = 0.15 + index * 0.05;
            return (
              <div
                key={jour.date.toISOString()}
                title={`${jour.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — ${
                  jour.cycles
                } pomodoro${jour.cycles > 1 ? 's' : ''}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <motion.span
                  className="font-data text-libelle tabular-nums text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: delai }}
                >
                  {jour.cycles === 0 ? '—' : jour.cycles}
                </motion.span>
                {jour.cycles > 0 && (
                  <motion.div
                    className="w-full max-w-8 bg-accent-bright"
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
          {jours.map((jour) => (
            <div key={jour.date.toISOString()} className="flex min-w-0 flex-1 justify-center">
              <span
                className={`max-w-full truncate border px-1 font-data text-libelle ${
                  jour.estAujourdhui ? 'border-accent-bright text-accent-bright' : 'border-transparent text-muted'
                }`}
              >
                {libelleJour(jour.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-secondaire text-muted">
        {resume} <span className="whitespace-nowrap">Compté sur cet ordinateur.</span>
      </p>
    </div>
  );
}

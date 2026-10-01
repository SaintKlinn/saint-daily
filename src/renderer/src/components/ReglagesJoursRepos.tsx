import { useState, type FormEvent } from 'react';
import Toggle from './Toggle';
import Button from './Button';
import {
  basculerDateRepos,
  basculerJourHebdo,
  cleJourLocal,
  ecrireJoursRepos,
  useJoursRepos,
} from '../lib/joursRepos';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

// Lundi en premier, comme le calendrier ; la valeur suit `getUTCDay`.
const JOURS = [
  { valeur: 1, court: 'Lun', long: 'lundi' },
  { valeur: 2, court: 'Mar', long: 'mardi' },
  { valeur: 3, court: 'Mer', long: 'mercredi' },
  { valeur: 4, court: 'Jeu', long: 'jeudi' },
  { valeur: 5, court: 'Ven', long: 'vendredi' },
  { valeur: 6, court: 'Sam', long: 'samedi' },
  { valeur: 0, court: 'Dim', long: 'dimanche' },
];

// Les dates passées depuis plus longtemps ne sont plus listées : elles
// comptent encore pour les records, mais les afficher encombrerait.
const JOURS_PASSES_AFFICHES = 30;

function libelleDate(cle: string): string {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Section « Jours de repos » des Réglages : jours de la semaine récurrents,
 * aujourd'hui en un geste, et jours ponctuels à l'avance (vacances, malade).
 */
export default function ReglagesJoursRepos() {
  const repos = useJoursRepos();
  const [nouvelleDate, setNouvelleDate] = useState('');
  const aujourdhui = cleJourLocal(new Date());
  const limite = cleJourLocal(new Date(Date.now() - JOURS_PASSES_AFFICHES * 86_400_000));
  const dates = repos.dates.filter((d) => d >= limite && d !== aujourdhui);

  function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!nouvelleDate || repos.dates.includes(nouvelleDate)) return;
    ecrireJoursRepos(basculerDateRepos(repos, nouvelleDate));
    setNouvelleDate('');
  }

  return (
    <section className="flex flex-col gap-0">
      <h2 className="mb-1 font-data text-libelle uppercase tracking-[0.1em] text-muted">Jours de repos</h2>
      <p className="text-secondaire text-muted">
        Un jour de repos sans séance ne casse pas tes séries ; une séance ce jour-là compte quand même. Réglage
        propre à cet ordinateur.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700 py-4">
        <p className="text-corps text-champagne">Chaque semaine</p>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Jours de repos chaque semaine">
          {JOURS.map((jour) => {
            const actif = repos.hebdo.includes(jour.valeur);
            return (
              <button
                key={jour.valeur}
                type="button"
                aria-pressed={actif}
                aria-label={`Repos chaque ${jour.long}`}
                onClick={() => ecrireJoursRepos(basculerJourHebdo(repos, jour.valeur, cleJourLocal(new Date())))}
                className={`w-12 py-2 font-data text-secondaire transition-colors duration-150 ${FOCUS_RING} ${actif ? 'bg-accent-bright text-ink-900' : 'border border-ink-700 text-muted hover:text-champagne'}`}
              >
                {jour.court}
              </button>
            );
          })}
        </div>
      </div>

      <Toggle
        checked={repos.dates.includes(aujourdhui)}
        onChange={() => ecrireJoursRepos(basculerDateRepos(repos, aujourdhui))}
        label="Repos aujourd'hui"
        description="Une pause imprévue : la série t'attend demain"
      />

      <div className="flex flex-col gap-3 py-4">
        <form onSubmit={ajouter} className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-corps text-champagne">Un autre jour</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={nouvelleDate}
              onChange={(e) => setNouvelleDate(e.target.value)}
              aria-label="Date du jour de repos"
              className={`h-10 border border-ink-700 bg-ink-800 px-3 font-data text-corps text-champagne [color-scheme:dark] ${FOCUS_RING}`}
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!nouvelleDate} aria-label="Ajouter ce jour de repos">
              Ajouter
            </Button>
          </div>
        </form>
        {dates.length > 0 && (
          <ul className="flex flex-col">
            {dates.map((cle) => (
              <li key={cle} className="flex items-center justify-between border-t border-ink-700 py-2">
                <span className={`text-corps first-letter:uppercase ${cle < aujourdhui ? 'text-muted' : 'text-champagne'}`}>
                  {libelleDate(cle)}
                </span>
                <button
                  type="button"
                  onClick={() => ecrireJoursRepos(basculerDateRepos(repos, cle))}
                  aria-label={`Retirer le repos du ${libelleDate(cle)}`}
                  className={`font-data text-libelle text-muted underline-offset-4 hover:text-champagne hover:underline ${FOCUS_RING}`}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

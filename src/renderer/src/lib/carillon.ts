// Carillons de l'app (fin de phase du Pomodoro, palier de série), synthétisés avec Web Audio plutôt
// que lu depuis un fichier : aucun fichier son à embarquer dans l'installeur,
// et un timbre doux (sinusoïdes à attaque et extinction progressives) qui
// signale sans faire sursauter.

export type Carillon = 'travail' | 'pause' | 'palier';

export interface NoteCarillon {
  frequence: number; // Hz
  debut: number; // secondes après le déclenchement
  duree: number; // secondes
}

// Montant vers le travail (on repart), descendant vers la pause (on
// relâche) : les deux se distinguent à l'oreille sans regarder l'écran.
const NOTES: Record<Carillon, NoteCarillon[]> = {
  travail: [
    { frequence: 523.25, debut: 0, duree: 0.5 }, // do5
    { frequence: 659.25, debut: 0.14, duree: 0.5 }, // mi5
    { frequence: 783.99, debut: 0.28, duree: 0.8 }, // sol5
  ],
  pause: [
    { frequence: 783.99, debut: 0, duree: 0.5 }, // sol5
    { frequence: 659.25, debut: 0.16, duree: 0.5 }, // mi5
    { frequence: 523.25, debut: 0.32, duree: 0.9 }, // do5
  ],
  // Palier de série : le même arpège que `travail`, plus serré, prolongé
  // jusqu'à l'octave — reconnaissable comme un son de l'app, mais plus
  // lumineux et qui « s'ouvre » au lieu de simplement repartir.
  palier: [
    { frequence: 523.25, debut: 0, duree: 0.45 }, // do5
    { frequence: 659.25, debut: 0.09, duree: 0.45 }, // mi5
    { frequence: 783.99, debut: 0.18, duree: 0.5 }, // sol5
    { frequence: 1046.5, debut: 0.27, duree: 1.3 }, // do6
  ],
};

export function notesCarillon(type: Carillon): NoteCarillon[] {
  return NOTES[type];
}

const VOLUME = 0.12;

/** Joue le carillon. Ne lève jamais : un son manqué ne doit pas casser la
 *  transition de phase qui l'a demandé. */
export function jouerCarillon(type: Carillon): void {
  try {
    const AudioContextCtor = globalThis.AudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    // Un contexte créé sans geste de l'utilisateur peut naître suspendu (le
    // palier s'affiche à l'ouverture de l'Accueil) : on le relance.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    let fin = 0;
    for (const note of notesCarillon(type)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.frequence;
      // Attaque de 20 ms puis extinction exponentielle : pas de clic à
      // l'attaque, et la note s'éteint comme une cloche plutôt que coupée net.
      gain.gain.setValueAtTime(0.0001, t0 + note.debut);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + note.debut + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.debut + note.duree);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + note.debut);
      osc.stop(t0 + note.debut + note.duree + 0.05);
      fin = Math.max(fin, note.debut + note.duree);
    }
    // Un contexte audio garde des ressources système tant qu'il est ouvert.
    setTimeout(() => void ctx.close().catch(() => {}), (fin + 0.3) * 1000);
  } catch {
    // Pas de sortie audio, contexte refusé : on reste silencieux.
  }
}

// Polices IBM Plex embarquées dans l'app plutôt que chargées depuis Google
// Fonts : la feuille de style distante bloquait le premier affichage à
// chaque ouverture, le temps d'un aller-retour réseau — et, hors ligne,
// jusqu'à l'échec de la requête.
//
// Seulement les graisses réellement utilisées (400, 500, 600 ; italique 400
// pour le serif) et les alphabets latin et latin étendu : le français en a
// besoin (œ, Œ), pas du cyrillique ni du grec. Chaque fichier ne se charge
// que si un caractère de son alphabet apparaît à l'écran (`unicode-range`).
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/ibm-plex-serif/latin-400.css';
import '@fontsource/ibm-plex-serif/latin-ext-400.css';
import '@fontsource/ibm-plex-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-serif/latin-ext-400-italic.css';
import '@fontsource/ibm-plex-serif/latin-500.css';
import '@fontsource/ibm-plex-serif/latin-ext-500.css';
import '@fontsource/ibm-plex-serif/latin-600.css';
import '@fontsource/ibm-plex-serif/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';

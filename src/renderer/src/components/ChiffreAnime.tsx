import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { EASE_SORTIE } from '../theme/mouvement';

interface ChiffreAnimeProps {
  valeur: number;
  // Le formatage s'applique à chaque image : les minutes défilent donc en
  // « 1h 05 », « 1h 06 »… plutôt qu'en nombre brut converti à la fin.
  format?: (valeur: number) => string;
}

/**
 * Nombre qui compte jusqu'à sa valeur à l'apparition, puis d'une valeur à
 * l'autre quand la donnée change. `animate()` est impératif et échappe donc
 * à <MotionConfig reducedMotion="user"> : sans `useReducedMotion`, le
 * compteur tournerait même quand l'OS demande moins de mouvement.
 *
 * Le parent doit poser `tabular-nums` : sans chiffres à chasse fixe, la
 * largeur du texte change à chaque image et fait trembler ce qui l'entoure.
 */
export default function ChiffreAnime({ valeur, format = String }: ChiffreAnimeProps) {
  const reduire = useReducedMotion();
  const [affiche, setAffiche] = useState(() => (reduire ? valeur : 0));
  // La dernière valeur AFFICHÉE et non la dernière valeur cible : si la
  // donnée change en plein comptage, le nouveau départ se fait d'où le
  // chiffre est réellement, sans saut en arrière.
  const afficheRef = useRef(affiche);

  useEffect(() => {
    if (reduire) {
      afficheRef.current = valeur;
      setAffiche(valeur);
      return;
    }
    const controles = animate(afficheRef.current, valeur, {
      duration: 0.9,
      ease: EASE_SORTIE,
      onUpdate: (v) => {
        const arrondi = Math.round(v);
        afficheRef.current = arrondi;
        setAffiche(arrondi);
      },
    });
    return () => controles.stop();
  }, [valeur, reduire]);

  return <>{format(affiche)}</>;
}

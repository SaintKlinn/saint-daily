import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import RayCorner from './RayCorner';
import Button from './Button';
import BoutonSuppression from './BoutonSuppression';
import { FormField, SelectField, TextAreaField } from './FormField';
import { modifierSeance, supprimerSeance } from '../hooks/usePracticeEntries';
import { analyserTags } from '../lib/tags';
import { depuisChampDateHeure, erreurSaisieSeance, HUMEURS, MOOD_LABELS, versChampDateHeure } from '../lib/seances';
import type { Mood, PracticeEntry } from '../lib/types';
import { EASE_SORTIE } from '../theme/mouvement';

interface EditeurSeanceProps {
  seance: PracticeEntry;
  // Nom du skill ou de la tâche, pour le titre : l'éditeur s'ouvre aussi
  // depuis le Journal, où plusieurs engagements se côtoient.
  nom: string;
  onFermer: () => void;
  // Appelé après une modification ou une suppression réussie : l'écran
  // appelant recharge ses séances.
  onChange: () => void;
}

/**
 * Corriger ou supprimer une séance déjà enregistrée : durée, date et heure,
 * humeur, tags, note. Ouvert depuis le Journal et depuis la fiche d'un skill.
 */
export default function EditeurSeance({ seance, nom, onFermer, onChange }: EditeurSeanceProps) {
  const [duree, setDuree] = useState(String(seance.durationMinutes));
  const [dateHeure, setDateHeure] = useState(versChampDateHeure(seance.practicedAt));
  const [humeur, setHumeur] = useState<Mood | ''>(seance.mood ?? '');
  const [tags, setTags] = useState(seance.tags.join(', '));
  const [note, setNote] = useState(seance.note ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Échap ferme, comme toute fenêtre de ce type ; pas pendant un
  // enregistrement, pour ne pas laisser croire qu'il a été annulé.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !occupe) onFermer();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFermer, occupe]);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const invalide = erreurSaisieSeance({ duree, dateHeure });
    if (invalide) {
      setErreur(invalide);
      return;
    }
    setOccupe(true);
    setErreur(null);
    const { error } = await modifierSeance(seance.id, {
      durationMinutes: Number(duree),
      practicedAt: depuisChampDateHeure(dateHeure) as string,
      note: note.trim() ? note : null,
      mood: humeur || null,
      tags: analyserTags(tags),
    });
    setOccupe(false);
    if (error) {
      // La saisie reste dans le formulaire : rien n'est perdu, on peut
      // réessayer.
      setErreur(error);
      return;
    }
    onChange();
    onFermer();
  }

  async function supprimer() {
    setOccupe(true);
    setErreur(null);
    const { error } = await supprimerSeance(seance.id);
    setOccupe(false);
    if (error) {
      setErreur(error);
      return;
    }
    onChange();
    onFermer();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-6" onClick={() => !occupe && onFermer()}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editeur-seance-titre"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE_SORTIE }}
        className="relative flex max-h-full w-full max-w-md flex-col gap-6 overflow-y-auto border border-ink-700 bg-ink-900 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <RayCorner variant={0} />
        <div className="relative">
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Modifier la séance</p>
          <h2 id="editeur-seance-titre" className="mt-2 font-serif text-titre-ecran text-champagne">
            {nom}
          </h2>
        </div>
        <form onSubmit={enregistrer} className="relative flex flex-col gap-6">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <FormField
              label="Date et heure"
              type="datetime-local"
              value={dateHeure}
              onChange={(e) => setDateHeure(e.target.value)}
              required
            />
            <FormField
              label="Durée (min)"
              type="number"
              min={0}
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              required
              autoFocus
            />
          </div>
          <SelectField label="Humeur (optionnelle)" value={humeur} onChange={(e) => setHumeur(e.target.value as Mood | '')}>
            <option value="">Non précisée</option>
            {HUMEURS.map((h) => (
              <option key={h} value={h}>
                {MOOD_LABELS[h]}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Tags de la séance (séparés par des virgules)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="technique, difficile"
          />
          <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          {erreur && (
            <p role="alert" className="text-corps text-danger">
              {erreur}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <BoutonSuppression onConfirm={supprimer} busy={occupe} label="Supprimer" />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={onFermer} disabled={occupe}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" disabled={occupe}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

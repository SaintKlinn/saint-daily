import { useState, type FormEvent } from 'react';
import RayCorner from './RayCorner';
import Dialogue from './Dialogue';
import Button from './Button';
import BoutonSuppression from './BoutonSuppression';
import { FormField, TextAreaField } from './FormField';
import { ChoixDuree, ChoixHumeur } from './ChampsSeance';
import { modifierSeance, supprimerSeance } from '../hooks/usePracticeEntries';
import { analyserTags } from '../lib/tags';
import { depuisChampDateHeure, erreurSaisieSeance, versChampDateHeure } from '../lib/seances';
import type { Mood, PracticeEntry } from '../lib/types';
import { dateCourte } from '../lib/echeances';

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
    // Échap et clic à côté ferment, sauf pendant un enregistrement, pour ne
    // pas laisser croire qu'il a été annulé.
    <Dialogue
      onFermer={onFermer}
      titreId="editeur-seance-titre"
      fermable={!occupe}
      className="flex max-h-full w-full max-w-md flex-col gap-6 overflow-y-auto p-8"
    >
        <RayCorner variant={0} />
        <div className="relative">
          <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">Modifier la séance</p>
          <h2 id="editeur-seance-titre" className="mt-2 font-serif text-titre-ecran text-champagne">
            {nom}
          </h2>
          {/* La séance d'origine, pour savoir laquelle on corrige même après
              avoir changé la date dans le champ. */}
          <p className="mt-1 font-data text-secondaire text-muted">{dateCourte(seance.practicedAt, true)}</p>
        </div>
        <form onSubmit={enregistrer} className="relative flex flex-col gap-6">
          <FormField
            label="Date et heure"
            type="datetime-local"
            value={dateHeure}
            onChange={(e) => setDateHeure(e.target.value)}
            required
          />
          <ChoixDuree valeur={duree} onChange={setDuree} />
          <ChoixHumeur valeur={humeur} onChange={setHumeur} />
          <FormField
            label="Tags de la séance (séparés par des virgules)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Aucun tag"
          />
          <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          {erreur && (
            <p role="alert" className="text-corps text-danger">
              {erreur}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <BoutonSuppression onConfirm={supprimer} busy={occupe} label="Supprimer" taille="md" variante="texte" />
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
    </Dialogue>
  );
}

// Le type d'un engagement en petite capitale devant son nom, là où skills,
// projets et tâches se mélangent (Journal, sélecteur du Pomodoro). Même
// style que dans la composition d'un projet : un projet ne ressemblait
// sinon trait pour trait à un skill (audit graphique, M5).
const LIBELLES = { skill: 'Skill', projet: 'Projet', tache: 'Tâche' } as const;

export type TypeEngagement = keyof typeof LIBELLES;

export function typeEngagement(e: { isProject: boolean; scheduledAt: string | null }): TypeEngagement {
  return e.isProject ? 'projet' : e.scheduledAt ? 'tache' : 'skill';
}

export default function EtiquetteType({ type, className = '' }: { type: TypeEngagement; className?: string }) {
  return (
    <span className={`font-data text-libelle uppercase tracking-[0.08em] text-muted ${className}`}>{LIBELLES[type]}</span>
  );
}

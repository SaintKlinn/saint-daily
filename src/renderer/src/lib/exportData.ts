import { fetchAllPages } from '../hooks/usePracticeEntries';
import { getSupabaseClient } from './supabase';
import { toFrenchError } from './errors';
import type { Mood } from './types';

export interface ExportMilestone {
  id: string;
  label: string;
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface ExportEntry {
  id: string;
  engagementId: string;
  durationMinutes: number;
  note: string | null;
  mood: Mood | null;
  practicedAt: string;
  createdAt: string;
}

export interface ExportEngagement {
  id: string;
  name: string;
  notes: string | null;
  tags: string[];
  genericLevel: string;
  archivedAt: string | null;
  scheduledAt: string | null;
  scheduledEndsAt: string | null;
  priority: string;
  recurrenceType: string;
  isProject: boolean;
  projectId: string | null;
  createdAt: string;
  milestones: ExportMilestone[];
  entries: ExportEntry[];
}

export interface ExportBundle {
  exportedAt: string;
  engagements: ExportEngagement[];
}

interface RawEngagement {
  id: string;
  name: string;
  notes: string | null;
  tags: string[] | null;
  generic_level: string;
  archived_at: string | null;
  deleted_at?: string | null;
  scheduled_at: string | null;
  scheduled_ends_at: string | null;
  priority: string;
  recurrence_type: string;
  is_project: boolean;
  project_id: string | null;
  created_at: string;
}

interface RawEntry {
  id: string;
  engagement_id: string;
  duration_minutes: number;
  note: string | null;
  // Optionnelle : la migration qui ajoute cette colonne n'est pas encore
  // appliquée à la base live, donc la propriété peut être absente de la
  // ligne — même raison que dans `usePracticeEntries.fromRow`.
  mood?: Mood | null;
  practiced_at: string;
  created_at: string;
}

interface RawMilestone {
  id: string;
  engagement_id: string;
  label: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

/**
 * Assemble tout l'historique de l'utilisateur en une structure imbriquée.
 *
 * Les engagements archivés sont inclus — l'archivage met en pause, il
 * n'efface pas — mais pas ceux en corbeille, qui sont en instance de
 * suppression. Ce tri se fait côté client, comme dans `useEngagements` :
 * nommer `deleted_at` dans la requête ferait échouer tout l'export tant
 * que la migration de la corbeille n'est pas appliquée.
 */
export async function fetchExportBundle(
  now: Date = new Date()
): Promise<{ bundle: ExportBundle | null; error: string | null }> {
  const supabase = getSupabaseClient();

  const { rows: engagementRows, error: engagementError } = await fetchAllPages<RawEngagement>((from, to) =>
    supabase.from('engagement').select('*').order('created_at', { ascending: true }).range(from, to)
  );
  if (engagementError) return { bundle: null, error: engagementError };

  const { rows: entryRows, error: entryError } = await fetchAllPages<RawEntry>((from, to) =>
    supabase.from('practice_entry').select('*').order('practiced_at', { ascending: true }).range(from, to)
  );
  if (entryError) return { bundle: null, error: entryError };

  const { rows: milestoneRows, error: milestoneError } = await fetchAllPages<RawMilestone>((from, to) =>
    supabase
      .from('engagement_milestone')
      .select('*')
      // `position` seul n'est pas assez unique pour paginer de façon
      // stable : deux jalons peuvent la partager (jalons d'engagements
      // différents, ou valeurs dupliquées au sein d'un même engagement), et
      // l'ordre PostgreSQL entre lignes à égalité n'est pas garanti d'une
      // page à l'autre — des lignes peuvent alors se dupliquer ou manquer
      // à la frontière entre deux pages. `id` est unique et départage.
      .order('position', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
  if (milestoneError) return { bundle: null, error: milestoneError };

  const kept = engagementRows.filter((row) => !row.deleted_at);
  const keptIds = new Set(kept.map((row) => row.id));

  const entriesByEngagement = new Map<string, ExportEntry[]>();
  for (const row of entryRows) {
    if (!keptIds.has(row.engagement_id)) continue;
    const list = entriesByEngagement.get(row.engagement_id) ?? [];
    list.push({
      id: row.id,
      engagementId: row.engagement_id,
      durationMinutes: row.duration_minutes,
      note: row.note,
      mood: row.mood ?? null,
      practicedAt: row.practiced_at,
      createdAt: row.created_at,
    });
    entriesByEngagement.set(row.engagement_id, list);
  }

  const milestonesByEngagement = new Map<string, ExportMilestone[]>();
  for (const row of milestoneRows) {
    if (!keptIds.has(row.engagement_id)) continue;
    const list = milestonesByEngagement.get(row.engagement_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      completedAt: row.completed_at,
      position: row.position,
      createdAt: row.created_at,
    });
    milestonesByEngagement.set(row.engagement_id, list);
  }

  return {
    bundle: {
      exportedAt: now.toISOString(),
      engagements: kept.map((row) => ({
        id: row.id,
        name: row.name,
        notes: row.notes,
        tags: row.tags ?? [],
        genericLevel: row.generic_level,
        archivedAt: row.archived_at,
        scheduledAt: row.scheduled_at,
        scheduledEndsAt: row.scheduled_ends_at,
        priority: row.priority,
        recurrenceType: row.recurrence_type,
        isProject: row.is_project,
        projectId: row.project_id,
        createdAt: row.created_at,
        milestones: milestonesByEngagement.get(row.id) ?? [],
        entries: entriesByEngagement.get(row.id) ?? [],
      })),
    },
    error: null,
  };
}

export function toJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

const CSV_HEADER = ['Date', 'Engagement', 'Tags', 'Durée (min)', 'Note', 'Humeur'];

// Mêmes libellés que le sélecteur de NouvelleEntree et que le journal de
// DetailSkill — l'un des trois endroits où l'humeur choisie doit apparaître
// enfin quelque part.
const MOOD_LABELS: Record<Mood, string> = {
  difficile: 'Difficile',
  moyen: 'Moyen',
  correct: 'Correct',
  bien: 'Bien',
  excellent: 'Excellent',
};

// Encadre et double les guillemets dès que la valeur contient un
// séparateur, un guillemet ou un saut de ligne : sans ça, une note
// contenant un point-virgule décale toutes les colonnes suivantes.
function csvCell(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Vue tabulaire des séances : une ligne par entrée, la plus ancienne en
 * premier. Le JSON reste le format d'archive complet ; ce CSV existe pour
 * être ouvert dans un tableur, d'où le BOM en tête — sans lui Excel sous
 * Windows lit le fichier en ANSI et massacre tous les accents. Séparateur
 * `;` plutôt que `,` pour la même raison : l'app est entièrement en
 * français, et Excel en locale française (comme toute locale qui utilise
 * la virgule comme séparateur décimal) attend `;` comme séparateur de
 * liste — avec une virgule, un double-clic vide tout dans la colonne A,
 * ce qui annule l'intérêt même du CSV. On n'utilise pas l'en-tête
 * `sep=,` : c'est une astuce propre à Excel qui apparaîtrait comme une
 * ligne parasite dans Google Sheets ou pandas.
 */
export function toCsv(bundle: ExportBundle): string {
  const rows: string[][] = [];
  for (const engagement of bundle.engagements) {
    for (const entry of engagement.entries) {
      rows.push([
        entry.practicedAt,
        engagement.name,
        // ', ' reste lisible et sans ambiguïté maintenant que `;` est le
        // séparateur de colonnes : une virgule à l'intérieur d'une cellule
        // ne fait éclater aucune colonne.
        engagement.tags.join(', '),
        String(entry.durationMinutes),
        entry.note ?? '',
        entry.mood ? MOOD_LABELS[entry.mood] : '',
      ]);
    }
  }
  // Comparaison `<`/`>` plutôt que `localeCompare` : `localeCompare`
  // applique des règles linguistiques qui ne respectent pas l'ordre
  // chronologique réel d'un timestamp ISO-8601 — `09:00:00.5+00:00` s'y
  // retrouverait avant `09:00:00+00:00` alors qu'il lui est postérieur.
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return '\ufeff' + [CSV_HEADER, ...rows].map((cells) => cells.map(csvCell).join(';')).join('\r\n');
}

export function exportFileName(extension: 'json' | 'csv', now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `saint-daily-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Révoqué au tick suivant plutôt qu'immédiatement : révoquer dans la
  // même tâche annule parfois le téléchargement avant que Chromium ait
  // fini de lire le blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

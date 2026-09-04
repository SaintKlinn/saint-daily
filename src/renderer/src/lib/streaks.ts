export interface PracticeEntryLike {
  practicedAt: string; // ISO 8601
}

/**
 * Jours consécutifs (jusqu'à aujourd'hui) avec au moins une entrée de
 * pratique. Une absence aujourd'hui ne casse pas un streak déjà en cours
 * (on n'a peut-être pas encore pratiqué) ; une absence hier le remet à 0.
 * Tout est calculé en UTC pour rester déterministe quel que soit le fuseau
 * de la machine qui exécute le code.
 */
export function calculateStreak(entries: PracticeEntryLike[], now: Date = new Date()): number {
  if (entries.length === 0) return 0;

  const practicedDays = new Set(entries.map((e) => toDayKey(new Date(e.practicedAt))));

  let streak = 0;
  const cursor = startOfUtcDay(now);

  if (!practicedDays.has(toDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (practicedDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

/** Vrai seulement si `current` dépasse une valeur précédente connue —
 *  `previous: null` encode "pas encore de valeur de référence" (premier
 *  rendu), pour ne jamais déclencher un pulse de récompense à l'ouverture
 *  de l'écran. */
export function streakJustExtended(previous: number | null, current: number): boolean {
  return previous !== null && current > previous;
}

/** Nombre de jours pleins écoulés depuis la dernière pratique. null si aucune entrée. */
export function daysSinceLastPractice(entries: PracticeEntryLike[], now: Date = new Date()): number | null {
  if (entries.length === 0) return null;

  const lastPracticedAt = entries.reduce(
    (latest, e) => (e.practicedAt > latest ? e.practicedAt : latest),
    entries[0].practicedAt
  );

  const last = startOfUtcDay(new Date(lastPracticedAt));
  const today = startOfUtcDay(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((today.getTime() - last.getTime()) / msPerDay);
}

/** Filtre par tag, correspondance exacte insensible à la casse. Pas de tag = liste inchangée. */
export function filterByTag<T extends { tags: string[] }>(
  items: T[],
  tag: string | null | undefined
): T[] {
  if (!tag) return items;
  const needle = tag.toLowerCase();
  return items.filter((s) => s.tags.some((t) => t.toLowerCase() === needle));
}

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

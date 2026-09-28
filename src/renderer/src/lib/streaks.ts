import { AUCUN_REPOS, estJourDeRepos, type JoursRepos } from './joursRepos';

export interface PracticeEntryLike {
  practicedAt: string; // ISO 8601
}

/**
 * Jours consécutifs (jusqu'à aujourd'hui) avec au moins une entrée de
 * pratique. Une absence aujourd'hui ne casse pas un streak déjà en cours
 * (on n'a peut-être pas encore pratiqué) ; une absence hier le remet à 0,
 * sauf si c'était un jour de repos (lib/joursRepos.ts) : un jour de repos
 * sans pratique est sauté, ni compté ni bloquant.
 * Tout est calculé en UTC pour rester déterministe quel que soit le fuseau
 * de la machine qui exécute le code.
 */
export function calculateStreak(
  entries: PracticeEntryLike[],
  now: Date = new Date(),
  repos: JoursRepos = AUCUN_REPOS
): number {
  return parcourirSerie(entries, now, repos)?.jours ?? 0;
}

/**
 * Premier jour (clé UTC YYYY-MM-DD) de la série en cours, ou null s'il n'y
 * en a pas. Mêmes règles que `calculateStreak` : une absence aujourd'hui ne
 * coupe pas la série, un jour de repos non plus. Identifie UNE série : deux
 * séries successives de 7 jours ont des débuts différents, ce qui permet de
 * fêter chacune.
 */
export function currentStreakStart(
  entries: PracticeEntryLike[],
  now: Date = new Date(),
  repos: JoursRepos = AUCUN_REPOS
): string | null {
  return parcourirSerie(entries, now, repos)?.debut ?? null;
}

/** Remonte le temps depuis aujourd'hui : chaque jour pratiqué compte, un
 *  jour de repos sans pratique est sauté, le premier autre jour vide arrête.
 *  null s'il n'y a aucune série en cours. */
function parcourirSerie(
  entries: PracticeEntryLike[],
  now: Date,
  repos: JoursRepos
): { jours: number; debut: string } | null {
  if (entries.length === 0) return null;
  const practicedDays = new Set(entries.map((e) => toDayKey(new Date(e.practicedAt))));
  // Borne de la remontée : sans elle, sept jours de repos par semaine
  // feraient boucler sans fin.
  const plusAncien = entries.reduce(
    (min, e) => Math.min(min, startOfUtcDay(new Date(e.practicedAt)).getTime()),
    Infinity
  );
  const cursor = startOfUtcDay(now);
  let jours = 0;
  let debut: string | null = null;
  let premier = true;
  while (cursor.getTime() >= plusAncien) {
    if (practicedDays.has(toDayKey(cursor))) {
      jours += 1;
      // `toDayKey` est une clé interne (mois à partir de 0, sans zéros) :
      // la valeur publique est une vraie date ISO, stable et lisible en
      // stockage.
      debut = cursor.toISOString().slice(0, 10);
    } else if (!premier && !estJourDeRepos(cursor, repos)) {
      break;
    }
    premier = false;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return debut ? { jours, debut } : null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Plus longue suite de jours consécutifs pratiqués **de toute l'histoire**,
 * pas seulement celle qui se termine aujourd'hui — c'est le record, pas le
 * streak en cours. Les jours de repos entre deux jours pratiqués ne
 * rompent pas la suite, comme pour `calculateStreak`.
 *
 * Travaille sur des index de jour entiers plutôt que sur des clés texte :
 * une suite se détecte alors par une simple différence de 1, sans
 * arithmétique de dates sensible aux mois de longueurs inégales. En UTC,
 * comme `calculateStreak`, pour rester déterministe quel que soit le fuseau.
 */
export function calculateBestStreak(entries: PracticeEntryLike[], repos: JoursRepos = AUCUN_REPOS): number {
  if (entries.length === 0) return 0;
  const dayIndexes = [
    ...new Set(entries.map((e) => Math.floor(startOfUtcDay(new Date(e.practicedAt)).getTime() / MS_PER_DAY))),
  ].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < dayIndexes.length; i++) {
    run = seSuivent(dayIndexes[i - 1], dayIndexes[i], repos) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Deux jours pratiqués se suivent s'ils sont consécutifs, ou si tous les
 *  jours qui les séparent sont des jours de repos. */
function seSuivent(avant: number, apres: number, repos: JoursRepos): boolean {
  for (let jour = avant + 1; jour < apres; jour++) {
    if (!estJourDeRepos(new Date(jour * MS_PER_DAY), repos)) return false;
  }
  return true;
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

/** Skills actifs (jamais archivés) dont le nom correspond à la recherche,
 *  insensible à la casse. Pas de recherche = tous les skills actifs. */
export function filterSkillsForPicker<T extends { name: string; archivedAt: string | null }>(
  skills: T[],
  search: string
): T[] {
  const active = skills.filter((s) => !s.archivedAt);
  if (!search.trim()) return active;
  const needle = search.trim().toLowerCase();
  return active.filter((s) => s.name.toLowerCase().includes(needle));
}

/** Dernière pratique la plus récente d'abord ; jamais pratiqués en
 *  dernier. Égalité (y compris deux "jamais") départagée alphabétiquement
 *  pour un ordre déterministe. */
export function sortSkillsByRecentPractice<T extends { id: string; name: string }>(
  skills: T[],
  entriesBySkill: Record<string, PracticeEntryLike[]>,
  now: Date = new Date()
): T[] {
  return [...skills].sort((x, y) => {
    const xDays = daysSinceLastPractice(entriesBySkill[x.id] ?? [], now);
    const yDays = daysSinceLastPractice(entriesBySkill[y.id] ?? [], now);
    if (xDays === null && yDays === null) return x.name.localeCompare(y.name);
    if (xDays === null) return 1;
    if (yDays === null) return -1;
    if (xDays !== yDays) return xDays - yDays;
    return x.name.localeCompare(y.name);
  });
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

/** Engagement dont l'entrée la plus récente est la plus récente de toutes.
 *  null si rien n'a jamais été pratiqué. */
export function lastPracticedEngagementId(
  entriesByEngagement: Record<string, PracticeEntryLike[]>
): string | null {
  let bestId: string | null = null;
  let bestAt = '';
  for (const [engagementId, entries] of Object.entries(entriesByEngagement)) {
    for (const entry of entries) {
      // Comparaison lexicographique d'ISO-8601 : équivalente à l'ordre
      // chronologique et sans conversion de date à chaque entrée.
      if (entry.practicedAt > bestAt) {
        bestAt = entry.practicedAt;
        bestId = engagementId;
      }
    }
  }
  return bestId;
}

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

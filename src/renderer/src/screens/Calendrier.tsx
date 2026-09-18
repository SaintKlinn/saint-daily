import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { useAllPracticeEntries, usePracticeEntries } from '../hooks/usePracticeEntries';
import { useSettings } from '../hooks/useSettings';
import { addDays, blockPositionFromDuration, blockPositionFromRange, dayIndexInWeek, startOfDay, startOfWeek } from '../lib/calendarLayout';
import { findNextFreeSlot, overlappingTaskNames } from '../lib/scheduling';
import {
  RECURRENCE_WINDOW_DAYS,
  detectConflicts,
  generateOccurrences,
  isNextOccurrenceInSeries,
  nextAnchorDate,
  type RecurrenceRule,
} from '../lib/recurrence';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/priority';
import Button from '../components/Button';
import TaskPopover from '../components/TaskPopover';
import Toggle from '../components/Toggle';
import { ChevronLeftIcon } from '../components/icons';
import type { Engagement, Priority } from '../lib/types';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_PX = 64; // doit rester en phase avec la classe Tailwind h-16 ci-dessous
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

const MAX_SNOOZE_DAYS_AHEAD = 30;

function formatSnoozeConfirmation(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Reporté au ${day}, ${time}`;
}

export default function Calendrier() {
  const navigate = useNavigate();
  const {
    engagements,
    error: engagementsError,
    setArchived,
    setSkipped,
    updateEngagement,
    createEngagements,
    deleteEngagements,
    softDelete,
  } = useEngagements();
  const { settings, updateSettings, error: settingsError } = useSettings();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const projects = useMemo(() => engagements.filter((e) => e.isProject), [engagements]);
  const scheduledTasks = useMemo(
    () => activeEngagements.filter((e) => e.scheduledAt && e.scheduledEndsAt),
    [activeEngagements]
  );
  const {
    entriesBySkill,
    refresh: refreshEntries,
    error: entriesError,
  } = useAllPracticeEntries(activeEngagements.map((e) => e.id));
  const { logEntry } = usePracticeEntries(null);
  const [popoverTask, setPopoverTask] = useState<Engagement | null>(null);
  const [completing, setCompleting] = useState(false);
  // Threadé jusqu'à `BoutonSuppression` dans le popover, comme `completing`
  // l'est déjà pour « Marquer comme faite » : sans lui, le bouton reste
  // armable pendant tout l'aller-retour réseau de `softDelete`.
  const [deletingTask, setDeletingTask] = useState(false);
  // Même raison que `deletingTask` ci-dessus : sans lui, le bouton reste
  // armable pendant tout l'aller-retour réseau de `setSkipped`.
  const [skipping, setSkipping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [snoozeMessage, setSnoozeMessage] = useState<string | null>(null);
  const [recurrenceMessage, setRecurrenceMessage] = useState<string | null>(null);
  const [recurrenceBusy, setRecurrenceBusy] = useState(false);
  // Clé `jour-heure` du créneau actuellement survolé pendant un
  // glissement : sans retour visuel, on dépose à l'aveugle.
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Vrai pendant toute la durée d'un glissement de bloc : sert à laisser
  // les blocs transparents aux événements de glissement (voir leur
  // `className`).
  const [dragging, setDragging] = useState(false);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekDaysList = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const tasksByDay = useMemo(() => {
    const byDay: Record<number, typeof scheduledTasks> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const task of scheduledTasks) {
      const index = dayIndexInWeek(weekStart, task.scheduledAt as string);
      if (index !== null) byDay[index].push(task);
    }
    return byDay;
  }, [scheduledTasks, weekStart]);

  const practiceEntriesByDay = useMemo(() => {
    const byDay: Record<number, { id: string; skillName: string; practicedAt: string; durationMinutes: number }[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    if (!settings?.showPracticeInCalendar) return byDay;
    for (const skill of activeEngagements) {
      if (skill.scheduledAt) continue; // seuls les skills ont un historique de pratique, pas les tâches
      for (const entry of entriesBySkill[skill.id] ?? []) {
        const index = dayIndexInWeek(weekStart, entry.practicedAt);
        if (index !== null) {
          byDay[index].push({
            id: entry.id,
            skillName: skill.name,
            practicedAt: entry.practicedAt,
            durationMinutes: entry.durationMinutes,
          });
        }
      }
    }
    return byDay;
  }, [activeEngagements, entriesBySkill, settings?.showPracticeInCalendar, weekStart]);

  const weekRangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }, [weekStart]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 7 * HOUR_ROW_PX;
  }, []);

  function handleEmptySlotClick(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    navigate(`/taches/nouvelle?scheduledAt=${encodeURIComponent(start.toISOString())}`);
  }

  async function handleDropOnSlot(day: Date, hour: number, taskId: string) {
    setDropTarget(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task?.scheduledAt || !task.scheduledEndsAt) return;

    // La durée est préservée : seul l'horaire de début change, comme pour
    // le report rapide.
    const durationMs = new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime();
    const newStart = new Date(day);
    newStart.setHours(hour, 0, 0, 0);
    const scheduledAt = newStart.toISOString();
    // Déposer une tâche sur son propre créneau ne doit rien écrire.
    if (scheduledAt === task.scheduledAt) return;
    const scheduledEndsAt = new Date(newStart.getTime() + durationMs).toISOString();

    setActionError(null);

    // `planMissingOccurrences` s'ancre sur l'occurrence la plus tardive
    // d'une série. Déposer celle-ci au-delà de la fenêtre de génération
    // ferait renvoyer une liste vide à `generateOccurrences` : la série
    // cesserait silencieusement de produire des occurrences jusqu'à ce que
    // le temps rattrape. On refuse plutôt que de casser sans le dire.
    if (task.recurrenceSeriesId) {
      const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
      if (newStart.getTime() > windowEnd.getTime()) {
        setSnoozeMessage(null);
        setActionError(
          `Trop loin pour une occurrence récurrente : au-delà de ${RECURRENCE_WINDOW_DAYS} jours, la série cesserait de générer ses occurrences suivantes. Modifie plutôt sa récurrence.`
        );
        return;
      }
    }

    const { error } = await updateEngagement(taskId, { scheduledAt, scheduledEndsAt });
    if (error) {
      // Sans cet effacement, un « Déplacé au lundi… » vert resterait à côté
      // de l'erreur rouge qui vient de s'afficher.
      setSnoozeMessage(null);
      setActionError(error);
      return;
    }

    // Glisser une occurrence ne déplace qu'elle : `updateEngagement` ne
    // touche qu'une ligne, et les sœurs de la série gardent leur créneau.
    // Une occurrence passée est exclue des conflits : elle n'occupe plus
    // son créneau du point de vue de l'utilisateur.
    const clashes = overlappingTaskNames(
      { scheduledAt, scheduledEndsAt },
      activeEngagements.filter((e) => e.id !== taskId && !e.skippedAt)
    );
    const when = newStart.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    // Un chevauchement avertit sans jamais interdire, comme le fait déjà
    // la détection de conflits de la récurrence.
    setSnoozeMessage(
      clashes.length > 0
        ? `Déplacé au ${when}, en conflit avec ${clashes.join(', ')}.`
        : `Déplacé au ${when}.`
    );
  }

  async function handleTogglePracticeInCalendar(checked: boolean) {
    const { error } = await updateSettings({ showPracticeInCalendar: checked });
    if (error) setActionError(error);
  }

  async function handleChangePriority(taskId: string, priority: Priority) {
    const { error } = await updateEngagement(taskId, { priority });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    // `popoverTask` est un instantané local, pas dérivé de `engagements` —
    // sans cette mise à jour, le sélecteur du popover resterait affiché
    // sur l'ancienne priorité jusqu'à sa fermeture/réouverture, alors que
    // l'écriture a bien réussi.
    setPopoverTask((current) => (current && current.id === taskId ? { ...current, priority } : current));
  }

  async function handleChangeProject(taskId: string, projectId: string | null) {
    const { error } = await updateEngagement(taskId, { projectId });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    setPopoverTask((current) => (current && current.id === taskId ? { ...current, projectId } : current));
  }

  async function handleSnooze(taskId: string, mode: 'aujourdhui' | 'demain') {
    setSnoozeMessage(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task || !task.scheduledAt || !task.scheduledEndsAt) return;
    const durationMinutes = (new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime()) / 60_000;
    const now = new Date();
    const searchFrom = new Date(Math.max(now.getTime(), new Date(task.scheduledEndsAt).getTime()));
    const fromDate = mode === 'aujourdhui' ? searchFrom : startOfDay(addDays(now, 1));
    const otherTasks = scheduledTasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({ scheduledAt: t.scheduledAt as string, scheduledEndsAt: t.scheduledEndsAt as string }));
    const slot = findNextFreeSlot(fromDate, durationMinutes, otherTasks, MAX_SNOOZE_DAYS_AHEAD);
    if (!slot) {
      setActionError(`Aucun créneau libre dans les ${MAX_SNOOZE_DAYS_AHEAD} prochains jours.`);
      return;
    }
    const { error } = await updateEngagement(taskId, { scheduledAt: slot.scheduledAt, scheduledEndsAt: slot.scheduledEndsAt });
    if (error) {
      setActionError(error);
      return;
    }
    setActionError(null);
    setPopoverTask(null);
    setSnoozeMessage(formatSnoozeConfirmation(slot.scheduledAt));
  }

  async function handleChangeRecurrence(taskId: string, rule: RecurrenceRule) {
    if (recurrenceBusy) return;
    setRecurrenceBusy(true);
    setActionError(null);
    setRecurrenceMessage(null);
    const task = activeEngagements.find((e) => e.id === taskId);
    if (!task || !task.scheduledAt || !task.scheduledEndsAt) {
      setRecurrenceBusy(false);
      return;
    }

    if (task.recurrenceSeriesId) {
      const siblingIds = activeEngagements
        .filter((e) => e.recurrenceSeriesId === task.recurrenceSeriesId && e.id !== taskId)
        .map((e) => e.id);
      const { error: deleteError } = await deleteEngagements(siblingIds);
      if (deleteError) {
        setActionError(deleteError);
        setRecurrenceBusy(false);
        return;
      }
    }

    const seriesId = task.recurrenceSeriesId ?? crypto.randomUUID();
    const { error: updateError } = await updateEngagement(taskId, {
      recurrenceSeriesId: seriesId,
      recurrenceType: rule.type,
      recurrenceInterval: rule.interval,
      recurrenceWeekdays: rule.weekdays,
    });
    if (updateError) {
      setActionError(updateError);
      setRecurrenceBusy(false);
      return;
    }

    setPopoverTask((current) =>
      current && current.id === taskId
        ? { ...current, recurrenceSeriesId: seriesId, recurrenceType: rule.type, recurrenceInterval: rule.interval, recurrenceWeekdays: rule.weekdays }
        : current
    );

    if (rule.type === 'aucune') {
      setRecurrenceBusy(false);
      return;
    }

    const durationMs = new Date(task.scheduledEndsAt).getTime() - new Date(task.scheduledAt).getTime();
    const windowEnd = addDays(new Date(), RECURRENCE_WINDOW_DAYS);
    const anchor = nextAnchorDate(rule, new Date(task.scheduledAt));
    const dates = generateOccurrences(rule, anchor, windowEnd);
    const occurrenceSlots = dates.map((date) => ({
      seriesId,
      scheduledAt: date.toISOString(),
      scheduledEndsAt: new Date(date.getTime() + durationMs).toISOString(),
    }));
    const otherTasks = activeEngagements.filter((e) => e.id !== taskId && e.recurrenceSeriesId !== seriesId);
    const conflicts = detectConflicts(occurrenceSlots, otherTasks);
    if (occurrenceSlots.length > 0) {
      await createEngagements(
        occurrenceSlots.map((slot) => ({
          name: task.name,
          tags: task.tags,
          priority: task.priority,
          projectId: task.projectId,
          scheduledAt: slot.scheduledAt,
          scheduledEndsAt: slot.scheduledEndsAt,
          recurrenceSeriesId: seriesId,
          recurrenceType: rule.type,
          recurrenceInterval: rule.interval,
          recurrenceWeekdays: rule.weekdays,
        }))
      );
    }
    if (conflicts.length > 0) {
      setRecurrenceMessage(
        `${conflicts.length} occurrence${conflicts.length > 1 ? 's' : ''} en conflit avec une autre tâche déjà planifiée.`
      );
    }
    setRecurrenceBusy(false);
  }

  async function handleCompleteTask(taskId: string) {
    setCompleting(true);
    const { error } = await logEntry({ engagementId: taskId, durationMinutes: 0, note: null });
    if (error) {
      setActionError(error);
      setCompleting(false);
      return;
    }
    const { error: archiveError } = await setArchived(taskId, true);
    setCompleting(false);
    if (archiveError) {
      setActionError(archiveError);
      return;
    }
    setActionError(null);
    setPopoverTask(null);
    await refreshEntries();
  }

  async function handleDeleteTask(taskId: string) {
    setActionError(null);
    setDeletingTask(true);
    const { error } = await softDelete(taskId, false);
    setDeletingTask(false);
    if (error) {
      setActionError(error);
      return;
    }
    setPopoverTask(null);
  }

  async function handleToggleSkip(task: Engagement) {
    setActionError(null);
    setSkipping(true);
    const { error } = await setSkipped(task.id, !task.skippedAt);
    setSkipping(false);
    // Retour tôt sur échec, comme la suppression juste au-dessus : sinon le
    // popover disparaît et l'erreur s'affiche en haut de l'écran, détachée
    // du geste qui l'a provoquée.
    if (error) {
      setActionError(error);
      return;
    }
    setPopoverTask(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-titre-ecran text-champagne">Calendrier</h1>
          <p className="mt-1 font-data text-secondaire text-muted">{weekRangeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            checked={settings?.showPracticeInCalendar ?? false}
            onChange={handleTogglePracticeInCalendar}
            label="Inclure l'historique de pratique"
            bordered={false}
          />
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Aujourd'hui
          </Button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
            className="flex h-9 w-9 items-center justify-center border border-ink-700 text-muted transition-colors hover:text-champagne"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
            className="flex h-9 w-9 items-center justify-center border border-ink-700 text-muted transition-colors hover:text-champagne"
          >
            <ChevronLeftIcon className="rotate-180" />
          </button>
        </div>
      </div>

      {engagementsError && (
        <p role="alert" className="text-corps text-danger">
          {engagementsError}
        </p>
      )}
      {entriesError && (
        <p role="alert" className="text-corps text-danger">
          {entriesError}
        </p>
      )}
      {settingsError && (
        <p role="alert" className="text-corps text-danger">
          {settingsError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-corps text-danger">
          {actionError}
        </p>
      )}
      {snoozeMessage && (
        <p role="status" className="text-corps text-accent-bright">
          {snoozeMessage}
        </p>
      )}
      {recurrenceMessage && (
        <p role="alert" className="text-corps text-danger">
          {recurrenceMessage}
        </p>
      )}

      <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto border border-ink-700">
        <div className="grid grid-cols-[50px_repeat(7,1fr)]">
          <div className="sticky top-0 z-10 bg-ink-900" />
          {weekDaysList.map((day, i) => (
            <div key={`header-${i}`} className="sticky top-0 z-10 border-l border-ink-700 bg-ink-900 py-2 text-center">
              <p className="font-data text-libelle uppercase tracking-[0.1em] text-muted">{DAY_LABELS[i]}</p>
              <p className="font-serif text-titre text-champagne">{day.getDate()}</p>
            </div>
          ))}
          <div>
            {HOURS.map((h) => (
              <div key={h} className="h-16 border-b border-ink-800 pr-2 text-right font-data text-libelle text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {weekDaysList.map((day, dayIndex) => (
            <div key={dayIndex} className="relative border-l border-ink-800">
              {HOURS.map((h) => (
                <div
                  key={h}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEmptySlotClick(day, h)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEmptySlotClick(day, h);
                    }
                  }}
                  aria-label={`Créer une tâche le ${day.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} à ${String(h).padStart(2, '0')}:00`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropTarget(`${dayIndex}-${h}`);
                  }}
                  onDragLeave={() => setDropTarget((current) => (current === `${dayIndex}-${h}` ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) void handleDropOnSlot(day, h, taskId);
                  }}
                  className={`h-16 cursor-pointer border-b border-ink-800 hover:bg-ink-800/50 ${FOCUS_RING} focus-visible:relative focus-visible:z-20 ${dropTarget === `${dayIndex}-${h}` ? 'bg-accent-bright/20' : ''}`}
                />
              ))}
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                const priorityColor = PRIORITY_COLORS[task.priority];
                return (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(true);
                    }}
                    // Couvre aussi l'abandon (Échap, dépôt hors grille) et
                    // le dépôt d'un objet étranger, deux cas où aucun
                    // `drop` utile ne survient et où la cible resterait
                    // sinon allumée indéfiniment.
                    onDragEnd={() => {
                      setDragging(false);
                      setDropTarget(null);
                    }}
                    onClick={() => setPopoverTask(task)}
                    aria-label={`${task.name}${task.skippedAt ? ' — passée' : ''}${
                      priorityColor ? ` — priorité ${PRIORITY_LABELS[task.priority]}` : ''
                    }`}
                    // `pointer-events-none` pendant un glissement : les blocs
                    // sont positionnés en absolu AU-DESSUS des cellules
                    // d'heure, en frères et non en enfants. Sans ça, chaque
                    // pixel couvert par un bloc est un non-cible, et déposer
                    // sur un créneau déjà occupé est silencieusement refusé —
                    // alors que la règle est d'avertir sans jamais interdire.
                    className={`absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-2 py-1 text-left ${priorityColor ? 'border-l-[3px]' : ''} ${task.skippedAt ? 'opacity-60' : ''} ${dragging ? 'pointer-events-none' : ''}`}
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      ...(priorityColor ? { borderLeftColor: priorityColor } : {}),
                    }}
                  >
                    <p
                      className={`truncate font-sans text-libelle font-semibold ${task.skippedAt ? 'line-through text-muted' : 'text-champagne'}`}
                    >
                      {task.name}
                    </p>
                  </button>
                );
              })}
              {practiceEntriesByDay[dayIndex].map((entry) => {
                const { topPercent, heightPercent } = blockPositionFromDuration(entry.practicedAt, entry.durationMinutes);
                return (
                  <div
                    key={entry.id}
                    // Même raison que les blocs de tâches : activer
                    // l'historique de pratique ajouterait sinon autant de
                    // zones mortes invisibles sur la grille.
                    className={`absolute inset-x-0.5 overflow-hidden border border-ink-700 bg-ink-800/60 px-2 py-1 text-left opacity-70 ${dragging ? 'pointer-events-none' : ''}`}
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-data text-libelle text-muted">{entry.skillName}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {popoverTask && (
        <TaskPopover
          task={popoverTask}
          onClose={() => setPopoverTask(null)}
          onComplete={() => handleCompleteTask(popoverTask.id)}
          completing={completing}
          onPriorityChange={(priority) => handleChangePriority(popoverTask.id, priority)}
          onSnooze={(mode) => handleSnooze(popoverTask.id, mode)}
          canEditRecurrence={isNextOccurrenceInSeries(popoverTask, activeEngagements)}
          onRecurrenceChange={(rule) => handleChangeRecurrence(popoverTask.id, rule)}
          recurrenceBusy={recurrenceBusy}
          projects={projects}
          onProjectChange={(projectId) => handleChangeProject(popoverTask.id, projectId)}
          onToggleSkip={() => handleToggleSkip(popoverTask)}
          skipping={skipping}
          onDelete={() => handleDeleteTask(popoverTask.id)}
          deleting={deletingTask}
          error={actionError}
        />
      )}
    </div>
  );
}

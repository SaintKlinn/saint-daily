import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngagements } from '../hooks/useEngagements';
import { addDays, blockPositionFromRange, dayIndexInWeek, startOfWeek } from '../lib/calendarLayout';
import Button from '../components/Button';
import { ChevronLeftIcon } from '../components/icons';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_PX = 64; // doit rester en phase avec la classe Tailwind h-16 ci-dessous

export default function Calendrier() {
  const navigate = useNavigate();
  const { engagements, error: engagementsError } = useEngagements();
  const activeEngagements = useMemo(() => engagements.filter((e) => !e.archivedAt), [engagements]);
  const scheduledTasks = useMemo(
    () => activeEngagements.filter((e) => e.scheduledAt && e.scheduledEndsAt),
    [activeEngagements]
  );

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-champagne">Calendrier</h1>
          <p className="mt-1 font-data text-[13px] text-muted">{weekRangeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
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
        <p role="alert" className="text-sm text-danger">
          {engagementsError}
        </p>
      )}

      <div className="grid grid-cols-[50px_repeat(7,1fr)] border border-ink-700">
        <div />
        {weekDaysList.map((day, i) => (
          <div key={i} className="border-l border-ink-700 py-2 text-center">
            <p className="font-data text-[11px] uppercase text-muted">{DAY_LABELS[i]}</p>
            <p className="font-serif text-lg text-champagne">{day.getDate()}</p>
          </div>
        ))}
      </div>

      <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto border border-t-0 border-ink-700">
        <div className="grid grid-cols-[50px_repeat(7,1fr)]">
          <div>
            {HOURS.map((h) => (
              <div key={h} className="h-16 border-b border-ink-800 pr-2 text-right font-data text-[11px] text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {weekDaysList.map((day, dayIndex) => (
            <div key={dayIndex} className="relative border-l border-ink-800">
              {HOURS.map((h) => (
                <div
                  key={h}
                  onClick={() => handleEmptySlotClick(day, h)}
                  className="h-16 cursor-pointer border-b border-ink-800 hover:bg-ink-800/50"
                />
              ))}
              {tasksByDay[dayIndex].map((task) => {
                const { topPercent, heightPercent } = blockPositionFromRange(
                  task.scheduledAt as string,
                  task.scheduledEndsAt as string
                );
                return (
                  <div
                    key={task.id}
                    className="absolute inset-x-0.5 overflow-hidden border border-accent-bright/40 bg-accent-bright/15 px-1.5 py-0.5 text-left"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <p className="truncate font-sans text-[11px] font-semibold text-champagne">{task.name}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

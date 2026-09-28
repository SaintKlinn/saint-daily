import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  checkpointNoteLabel,
  completePhase,
  consolidateDuration,
  extendPhase,
  nextPhase,
  partialMinutesElapsed,
  pauseSession,
  phaseDurationMinutes,
  phaseTotalMs,
  restoreSession,
  resumeSession,
  skipBreak,
  startSession,
  type PomodoroDurations,
  type PomodoroSession,
} from './pomodoroLogic';

const durations: PomodoroDurations = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

function baseSession(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    skillId: 'skill-1',
    skillName: 'Piano',
    phase: 'work',
    status: 'running',
    cycleIndex: 0,
    phaseEndsAt: 0,
    remainingMsAtPause: null,
    loggedEntryIds: [],
    extensionMs: 0,
    completedCycles: 0,
    ...overrides,
  };
}

describe('startSession', () => {
  it('starts in the work phase, cycle 0, running, with no logged entries', () => {
    const now = Date.parse('2026-09-02T10:00:00Z');
    const session = startSession('skill-1', 'Piano', durations, now);
    expect(session.phase).toBe('work');
    expect(session.status).toBe('running');
    expect(session.cycleIndex).toBe(0);
    expect(session.phaseEndsAt).toBe(now + 25 * 60_000);
    expect(session.remainingMsAtPause).toBeNull();
    expect(session.loggedEntryIds).toEqual([]);
  });
});

describe('phaseDurationMinutes', () => {
  it('returns the right duration per phase', () => {
    expect(phaseDurationMinutes('work', durations)).toBe(25);
    expect(phaseDurationMinutes('shortBreak', durations)).toBe(5);
    expect(phaseDurationMinutes('longBreak', durations)).toBe(15);
  });
});

describe('nextPhase', () => {
  it('goes from work to a short break before the last cycle of the round', () => {
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 0 }), durations)).toEqual({
      phase: 'shortBreak',
      cycleIndex: 0,
    });
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 2 }), durations)).toEqual({
      phase: 'shortBreak',
      cycleIndex: 2,
    });
  });

  it('goes from work to a long break on the last cycle of the round', () => {
    expect(nextPhase(baseSession({ phase: 'work', cycleIndex: 3 }), durations)).toEqual({
      phase: 'longBreak',
      cycleIndex: 3,
    });
  });

  it('goes from a short break back to work, incrementing the cycle index', () => {
    expect(nextPhase(baseSession({ phase: 'shortBreak', cycleIndex: 1 }), durations)).toEqual({
      phase: 'work',
      cycleIndex: 2,
    });
  });

  it('goes from a long break back to work, resetting the cycle index to 0', () => {
    expect(nextPhase(baseSession({ phase: 'longBreak', cycleIndex: 3 }), durations)).toEqual({
      phase: 'work',
      cycleIndex: 0,
    });
  });
});

describe('completePhase', () => {
  it('reports 25 logged minutes when a work phase completes, and auto-advances when asked', () => {
    const now = Date.parse('2026-09-02T10:25:00Z');
    const session = baseSession({ phase: 'work', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, true, now);
    expect(result.loggedMinutes).toBe(25);
    expect(result.next.phase).toBe('shortBreak');
    expect(result.next.status).toBe('running');
    expect(result.next.phaseEndsAt).toBe(now + 5 * 60_000);
  });

  it('reports 0 logged minutes when a break completes', () => {
    const now = Date.parse('2026-09-02T10:30:00Z');
    const session = baseSession({ phase: 'shortBreak', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, true, now);
    expect(result.loggedMinutes).toBe(0);
    expect(result.next.phase).toBe('work');
    expect(result.next.cycleIndex).toBe(1);
  });

  it('sets status to awaitingAdvance and does not set a new phaseEndsAt when auto-advance is off', () => {
    const now = Date.parse('2026-09-02T10:25:00Z');
    const session = baseSession({ phase: 'work', cycleIndex: 0, phaseEndsAt: now });
    const result = completePhase(session, durations, false, now);
    expect(result.next.status).toBe('awaitingAdvance');
    expect(result.next.phase).toBe('shortBreak');
    expect(result.next.phaseEndsAt).toBe(now); // unchanged, unused while awaitingAdvance
  });
});

describe('advancePhase', () => {
  it('starts the current (already-updated) phase running from now', () => {
    const now = Date.parse('2026-09-02T10:26:00Z');
    const session = baseSession({ phase: 'shortBreak', status: 'awaitingAdvance', phaseEndsAt: 0 });
    const result = advancePhase(session, durations, now);
    expect(result.status).toBe('running');
    expect(result.phaseEndsAt).toBe(now + 5 * 60_000);
  });
});

describe('pauseSession / resumeSession', () => {
  it('freezes the remaining time on pause and recomputes phaseEndsAt on resume', () => {
    const phaseEndsAt = Date.parse('2026-09-02T10:25:00Z');
    const pauseAt = Date.parse('2026-09-02T10:10:00Z'); // 15 min remaining
    const session = baseSession({ phaseEndsAt });
    const paused = pauseSession(session, pauseAt);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMsAtPause).toBe(15 * 60_000);

    const resumeAt = Date.parse('2026-09-02T10:12:00Z');
    const resumed = resumeSession(paused, resumeAt);
    expect(resumed.status).toBe('running');
    expect(resumed.remainingMsAtPause).toBeNull();
    expect(resumed.phaseEndsAt).toBe(resumeAt + 15 * 60_000);
  });
});

describe('partialMinutesElapsed', () => {
  it('rounds elapsed time to the nearest minute while running', () => {
    const now = Date.parse('2026-09-02T10:12:40Z'); // 12m40s into a 25m phase
    const session = baseSession({ phaseEndsAt: now + (25 * 60_000 - (12 * 60_000 + 40_000)) });
    expect(partialMinutesElapsed(session, durations, now)).toBe(13);
  });

  it('returns 0 when less than 30 seconds have elapsed', () => {
    const now = Date.parse('2026-09-02T10:00:20Z');
    const session = baseSession({ phaseEndsAt: now + (25 * 60_000 - 20_000) });
    expect(partialMinutesElapsed(session, durations, now)).toBe(0);
  });

  it('uses remainingMsAtPause instead of the clock when paused', () => {
    const session = baseSession({
      status: 'paused',
      phaseEndsAt: 0,
      remainingMsAtPause: 25 * 60_000 - 15 * 60_000, // 15 minutes elapsed
    });
    expect(partialMinutesElapsed(session, durations, Date.parse('2026-09-02T12:00:00Z'))).toBe(15);
  });

  it('credits the full phase duration when now has reached phaseEndsAt exactly', () => {
    const now = Date.parse('2026-09-02T10:25:00Z');
    const session = baseSession({ phaseEndsAt: now });
    expect(partialMinutesElapsed(session, durations, now)).toBe(25);
  });

  it('still credits the full phase duration when now is past phaseEndsAt (an overdue, not-yet-ticked phase — e.g. a throttled timer while the window was backgrounded)', () => {
    const phaseEndsAt = Date.parse('2026-09-02T10:25:00Z');
    const now = Date.parse('2026-09-02T10:27:00Z'); // 2 minutes late
    const session = baseSession({ phaseEndsAt });
    expect(partialMinutesElapsed(session, durations, now)).toBe(25);
  });
});

describe('consolidateDuration', () => {
  it('sums the logged minutes', () => {
    expect(consolidateDuration([25, 25, 13])).toBe(63);
  });

  it('returns 0 for no logged minutes', () => {
    expect(consolidateDuration([])).toBe(0);
  });
});

describe('checkpointNoteLabel', () => {
  it('formats as cycle N/M, 1-based', () => {
    expect(checkpointNoteLabel(0, 4)).toBe('Pomodoro — cycle 1/4');
    expect(checkpointNoteLabel(3, 4)).toBe('Pomodoro — cycle 4/4');
  });
});

describe('extendPhase', () => {
  const now = Date.parse('2026-09-02T10:00:00Z');

  it('pushes the end of a running phase back by five minutes', () => {
    const session = baseSession({ phaseEndsAt: now + 60_000 });
    const extended = extendPhase(session);
    expect(extended.phaseEndsAt).toBe(now + 6 * 60_000);
    expect(extended.extensionMs).toBe(5 * 60_000);
  });

  it('adds to the frozen remaining time of a paused phase', () => {
    const session = baseSession({ status: 'paused', remainingMsAtPause: 30_000 });
    const extended = extendPhase(session, 10);
    expect(extended.remainingMsAtPause).toBe(30_000 + 10 * 60_000);
    expect(extended.extensionMs).toBe(10 * 60_000);
  });

  it('does nothing while waiting for the next phase to start', () => {
    const session = baseSession({ phase: 'shortBreak', status: 'awaitingAdvance' });
    expect(extendPhase(session)).toBe(session);
  });

  it('is counted in the phase total, in the credited minutes and in a partial stop', () => {
    const extended = extendPhase(baseSession({ phaseEndsAt: now }));
    expect(phaseTotalMs(extended, durations)).toBe(30 * 60_000);
    expect(completePhase(extended, durations, true, now).loggedMinutes).toBe(30);
    // 10 minutes restantes sur 30 : 20 minutes faites.
    expect(partialMinutesElapsed({ ...extended, phaseEndsAt: now + 10 * 60_000 }, durations, now)).toBe(20);
  });

  it('is reset when the phase changes', () => {
    const extended = extendPhase(baseSession({ phaseEndsAt: now }));
    expect(completePhase(extended, durations, true, now).next.extensionMs).toBe(0);
    expect(completePhase(extended, durations, false, now).next.extensionMs).toBe(0);
  });
});

describe('skipBreak', () => {
  const now = Date.parse('2026-09-02T10:00:00Z');

  it('starts the next work cycle right away from a running short break', () => {
    const session = baseSession({ phase: 'shortBreak', cycleIndex: 1, phaseEndsAt: now + 60_000 });
    const skipped = skipBreak(session, durations, now);
    expect(skipped).toMatchObject({ phase: 'work', cycleIndex: 2, status: 'running', extensionMs: 0 });
    expect(skipped.phaseEndsAt).toBe(now + 25 * 60_000);
  });

  it('resets the cycle count after a long break, like finishing it would', () => {
    const session = baseSession({ phase: 'longBreak', cycleIndex: 3, status: 'paused', remainingMsAtPause: 1000 });
    const skipped = skipBreak(session, durations, now);
    expect(skipped).toMatchObject({ phase: 'work', cycleIndex: 0, status: 'running', remainingMsAtPause: null });
  });

  it('skips a break that has not started yet', () => {
    const session = baseSession({ phase: 'shortBreak', status: 'awaitingAdvance', cycleIndex: 0 });
    expect(skipBreak(session, durations, now)).toMatchObject({ phase: 'work', cycleIndex: 1, status: 'running' });
  });

  it('does nothing during a work phase', () => {
    const session = baseSession({ phase: 'work' });
    expect(skipBreak(session, durations, now)).toBe(session);
  });
});

describe('restoreSession', () => {
  const lastSeenAt = Date.parse('2026-09-02T10:00:00Z');

  it('brings a running phase back paused where the app was last alive', () => {
    const saved = baseSession({ phaseEndsAt: lastSeenAt + 7 * 60_000 });
    expect(restoreSession(saved, lastSeenAt)).toMatchObject({ status: 'paused', remainingMsAtPause: 7 * 60_000 });
  });

  it('brings a phase that ended before the app closed back paused at zero', () => {
    const saved = baseSession({ phaseEndsAt: lastSeenAt - 60_000 });
    expect(restoreSession(saved, lastSeenAt)).toMatchObject({ status: 'paused', remainingMsAtPause: 0 });
  });

  it('keeps paused and waiting sessions as they were', () => {
    const paused = baseSession({ status: 'paused', remainingMsAtPause: 1234 });
    const waiting = baseSession({ phase: 'shortBreak', status: 'awaitingAdvance' });
    expect(restoreSession(paused, lastSeenAt)).toBe(paused);
    expect(restoreSession(waiting, lastSeenAt)).toBe(waiting);
  });

  it('never credits time spent with the app closed', () => {
    const saved = baseSession({ phaseEndsAt: lastSeenAt + 20 * 60_000 }); // 5 min faites sur 25
    const restored = restoreSession(saved, lastSeenAt);
    const muchLater = lastSeenAt + 3 * 60 * 60_000;
    expect(partialMinutesElapsed(restored, durations, muchLater)).toBe(5);
  });
});

describe('completedCycles', () => {
  const now = Date.parse('2026-09-02T10:00:00Z');

  it('counts a work phase that runs to its end, in both advance modes', () => {
    const session = baseSession({ phase: 'work', completedCycles: 2, phaseEndsAt: now });
    expect(completePhase(session, durations, true, now).next.completedCycles).toBe(3);
    expect(completePhase(session, durations, false, now).next.completedCycles).toBe(3);
  });

  it('does not count the end of a break, nor a skipped one', () => {
    const pause = baseSession({ phase: 'shortBreak', completedCycles: 2, phaseEndsAt: now });
    expect(completePhase(pause, durations, true, now).next.completedCycles).toBe(2);
    expect(skipBreak(pause, durations, now).completedCycles).toBe(2);
  });

  it('starts at zero', () => {
    expect(startSession('s', 'Piano', durations, now).completedCycles).toBe(0);
  });
});

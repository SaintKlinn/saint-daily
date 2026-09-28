import { describe, expect, it } from 'vitest';
import {
  CLE_SESSION_POMODORO,
  ecrireSessionPersistee,
  effacerSessionPersistee,
  lireSessionPersistee,
  type SessionPersistee,
  type StockageSession,
} from './pomodoroPersistance';

function stockageMemoire(): StockageSession & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    getItem: (cle) => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => void valeurs.set(cle, valeur),
    removeItem: (cle) => void valeurs.delete(cle),
  };
}

const stockageQuiLeve: StockageSession = {
  getItem: () => {
    throw new Error('refusé');
  },
  setItem: () => {
    throw new Error('refusé');
  },
  removeItem: () => {
    throw new Error('refusé');
  },
};

const donnees: SessionPersistee = {
  userId: 'u1',
  session: {
    skillId: 'skill-1',
    skillName: 'Piano',
    phase: 'work',
    status: 'running',
    cycleIndex: 1,
    phaseEndsAt: 1_000_000,
    remainingMsAtPause: null,
    loggedEntryIds: ['e1'],
    extensionMs: 0,
    completedCycles: 1,
  },
  durations: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4 },
  note: 'gammes',
  lastSeenAt: 999_000,
};

describe('pomodoroPersistance', () => {
  it('reads back what was written, for the same account', () => {
    const stockage = stockageMemoire();
    ecrireSessionPersistee(donnees, stockage);
    expect(lireSessionPersistee('u1', stockage)).toEqual(donnees);
  });

  it('ignores a session saved by another account, or when signed out', () => {
    const stockage = stockageMemoire();
    ecrireSessionPersistee(donnees, stockage);
    expect(lireSessionPersistee('u2', stockage)).toBeNull();
    expect(lireSessionPersistee(undefined, stockage)).toBeNull();
  });

  it('returns null when nothing is saved', () => {
    expect(lireSessionPersistee('u1', stockageMemoire())).toBeNull();
  });

  it('rejects unreadable or malformed values instead of restarting a broken timer', () => {
    const stockage = stockageMemoire();
    stockage.valeurs.set(CLE_SESSION_POMODORO, '{pas du json');
    expect(lireSessionPersistee('u1', stockage)).toBeNull();

    stockage.valeurs.set(
      CLE_SESSION_POMODORO,
      JSON.stringify({ ...donnees, session: { ...donnees.session, phaseEndsAt: 'bientôt' } })
    );
    expect(lireSessionPersistee('u1', stockage)).toBeNull();

    const { extensionMs: _ignore, ...sansExtension } = donnees.session;
    stockage.valeurs.set(CLE_SESSION_POMODORO, JSON.stringify({ ...donnees, session: sansExtension }));
    expect(lireSessionPersistee('u1', stockage)).toBeNull();

    stockage.valeurs.set(
      CLE_SESSION_POMODORO,
      JSON.stringify({ ...donnees, session: { ...donnees.session, loggedEntryIds: [42] } })
    );
    expect(lireSessionPersistee('u1', stockage)).toBeNull();
  });

  it('clears the saved session', () => {
    const stockage = stockageMemoire();
    ecrireSessionPersistee(donnees, stockage);
    effacerSessionPersistee(stockage);
    expect(lireSessionPersistee('u1', stockage)).toBeNull();
  });

  it('never throws when storage is refused', () => {
    expect(() => ecrireSessionPersistee(donnees, stockageQuiLeve)).not.toThrow();
    expect(() => effacerSessionPersistee(stockageQuiLeve)).not.toThrow();
    expect(lireSessionPersistee('u1', stockageQuiLeve)).toBeNull();
  });
});

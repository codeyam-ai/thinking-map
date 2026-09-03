import { describe, expect, it } from 'vitest';
import { roundEndNote, roundIsFinished } from './roundEnd';
import { PHASES, PHASE_ASK, PHASE_LABELS } from './mapKinds';

describe('roundIsFinished', () => {
  // The moment the feature exists for.
  it('is true once the last open question is answered in this sitting', () => {
    expect(
      roundIsFinished({ open: 0, answeredThisRound: 1, waiting: false }),
    ).toBe(true);
  });

  // Answering a lot is not the same as answering everything — the trigger is
  // the board running out of questions, so a busy round with one card left
  // must not end on the strength of the count alone.
  it('is false while anything is still open, however much was answered', () => {
    expect(
      roundIsFinished({ open: 1, answeredThisRound: 5, waiting: false }),
    ).toBe(false);
  });

  // The clause most likely to be dropped as redundant, and the one that decides
  // whether this is automation for a participant or at a reader. Every map
  // someone reopens is in exactly this state.
  it('is false on a board that merely ARRIVES fully answered', () => {
    expect(
      roundIsFinished({ open: 0, answeredThisRound: 0, waiting: false }),
    ).toBe(false);
  });

  // A round already handed over is over. Without this the board would keep
  // re-satisfying the condition while it waited and write the same note onto
  // the log again and again.
  it('is false once the round has already been handed to the partner', () => {
    expect(
      roundIsFinished({ open: 0, answeredThisRound: 3, waiting: true }),
    ).toBe(false);
  });
});

describe('roundEndNote', () => {
  // The failure this whole note exists to prevent: a partner that answers "your
  // turn" with another row of questions, forever, because nothing ever told it
  // a decision was due.
  it('names BOTH branches of the fork, not just "your turn"', () => {
    const note = roundEndNote('map');
    expect(note).toMatch(/add what is still missing/i);
    expect(note).toMatch(/draw the conclusion/i);
    expect(note).toMatch(/decision, not another round/i);
  });

  // "Draw the conclusion" alone is not actionable — which conclusion, of what?
  // Naming the destination phase is what turns the note from an exhortation
  // into an instruction the partner can act on.
  it('names the phase the map is due to reach, so the ask is specific', () => {
    expect(roundEndNote('map')).toContain(PHASE_LABELS.research);
    expect(roundEndNote('research')).toContain(PHASE_LABELS.explore);
    expect(roundEndNote('explore')).toContain(PHASE_LABELS['next-steps']);
  });

  // Sourced from PHASE_ASK rather than written a second time here, so the
  // sentence the person reads on the button and the one the agent reads on the
  // log cannot drift apart.
  it('opens with the phase sentence the button already shows', () => {
    for (const phase of PHASES) {
      expect(roundEndNote(phase)).toContain(PHASE_ASK[phase].sentence);
    }
  });

  // The arc terminates. An invitation to move on would point at nothing here,
  // and "keep going" is the exact instruction that must not be given.
  it('tells the terminal phase to conclude rather than to move on', () => {
    const note = roundEndNote('next-steps');
    expect(note).toMatch(/no phase after this one/i);
    expect(note).toMatch(/rather than opening more questions/i);
    expect(note).not.toMatch(/move the map on to/i);
  });

  // The case above pins `next-steps` by name; this holds the same rule for the
  // whole arc, so a phase added later with no `next` cannot quietly start
  // telling the partner to move on to nothing.
  it('never invites a move for a phase that has nowhere to go', () => {
    for (const phase of PHASES) {
      const note = roundEndNote(phase);
      if (PHASE_ASK[phase].next) continue;
      expect(note).not.toMatch(/move the map on/i);
    }
  });
});

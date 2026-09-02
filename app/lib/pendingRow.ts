// What the page may honestly claim while it waits for the next round.
//
// The shimmering row beneath a finished round is a promise, and WebMCP is
// pull-only: the page cannot wake an agent, cannot start its turn, and has no
// way of knowing whether one is coming. So a row that shimmers indefinitely is
// a lie — it says "something is being written" when the truthful statement is
// "your answers are on the log". The shimmer is therefore BOUNDED, and what it
// resolves into depends on what is actually true about the bridge.
//
// Pure and dependency-free, modelled on `askPresence.ts`, which already does
// exactly this job for the ask composer: the wording IS the interface, and a
// regression here is a person being told an answer is coming when nobody is
// listening. Keeping the rule out of the component is what lets a test pin it
// rather than a screenshot.

import type { Phase } from './mapKinds';

/** How long the placeholders may shimmer before they have to say something.
 *  The poll is 1500ms, so a genuinely-writing agent lands a round long before
 *  this; the window is generous enough to cover a slow turn and short enough
 *  that nobody watches a lie. */
export const SETTLE_AFTER_MS = 20_000;

export type PendingRow =
  /** Nothing to reach for — the round is not finished, or the loop has ended. */
  | { kind: 'hidden' }
  /** Shimmering placeholders: the answers are in, and a round may be coming. */
  | { kind: 'waiting' }
  /** The shimmer's time is up, and this is the honest statement of what is
   *  actually true about who can hear the answers. */
  | { kind: 'settled'; note: string };

export interface PendingRowInput {
  /** How many rounds the map has. Zero means nothing has been drawn yet. */
  roundCount: number;
  /** Open questions in the NEWEST round only. A question skipped three rounds
   *  ago must not hold the loop hostage — it stays answerable in place and
   *  stops gating progress. */
  openInNewestRound: number;
  /** The phase as the page has resolved it. */
  phase: Phase;
  /** Whether an agent can reach this page, and whether it is mid-turn. */
  status: 'unavailable' | 'connected' | 'working';
  /** How long the newest round has been complete. */
  waitedMs: number;
}

/**
 * `working` is an agent whose turn is running right now, so it has genuinely
 * been handed what is there. `connected` is an agent attached to the page but
 * not in a turn — it will see it when its turn next comes round, which is a
 * weaker and different claim. `unavailable` is nobody at all, and is the state
 * every preview and capture actually produces, so it is the one most at risk of
 * being quietly dressed up as one of the other two.
 *
 * "What you have added" rather than "your answers", deliberately. The pending
 * row also appears on a DAY-ONE map — a seed idea nobody has picked up, which
 * has no answers on it at all — and telling that person their answers are on
 * the log names something that does not exist. The vaguer phrase is the one
 * that is true in both cases, and true beats concrete here.
 *
 * Exported so the isolated-component fixtures can cite the REAL sentence rather
 * than a hand-copy. Nine hand-copied duplicates is how the wording above came
 * to be wrong in one place and right in another.
 */
export function settledNote(status: PendingRowInput['status']): string {
  if (status === 'working') {
    return 'An agent is working and has everything you have added.';
  }
  if (status === 'connected') {
    return 'An agent is attached but is not in a turn. What you have added is waiting for it.';
  }
  return 'No agent can reach this page. What you have added is on the log until one reads it.';
}

/**
 * What to draw beneath the newest round.
 *
 * Hidden while the round is still being answered — the cards are the action
 * then, and a placeholder below them would be reaching for something the person
 * has not finished giving. Hidden at `next-steps` too: that is where the loop
 * arrives, so there is no next round to reach for.
 */
export function pendingRow(input: PendingRowInput): PendingRow {
  const { roundCount, openInNewestRound, phase, status, waitedMs } = input;

  if (roundCount === 0) return { kind: 'hidden' };
  if (phase === 'next-steps') return { kind: 'hidden' };
  if (openInNewestRound > 0) return { kind: 'hidden' };

  if (waitedMs < SETTLE_AFTER_MS) return { kind: 'waiting' };

  return { kind: 'settled', note: settledNote(status) };
}

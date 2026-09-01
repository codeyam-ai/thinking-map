'use client';

import PendingCards from './PendingCards';
import PendingNote from './PendingNote';
import type { PendingRow as PendingRowState } from '../lib/pendingRow';

/**
 * The row the map reaches for before it has one.
 *
 * The whole point is that the page moves first: a round gets finished and the
 * next row appears immediately, as placeholders, so the column visibly grows
 * downward instead of sitting still while the person wonders whether anything
 * registered.
 *
 * What it must never do is imply an agent is writing — it cannot know that,
 * because the page has no way to start anyone's turn. So the shimmer is
 * bounded, and what it resolves into is decided by `pendingRow`, where the
 * three sentences are pinned by tests. This file only draws the choice.
 */
export default function PendingRow({ state }: { state: PendingRowState }) {
  if (state.kind === 'hidden') return null;

  return (
    <section className="mb-8" data-pending-row={state.kind}>
      {state.kind === 'settled' ? (
        <PendingNote note={state.note} />
      ) : (
        <PendingCards />
      )}
    </section>
  );
}

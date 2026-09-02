'use client';

import PhaseAdvance from './PhaseAdvance';
import RowProgress from './RowProgress';
import type { NoteWriter } from '../hooks/useAdvancePhase';
import type { Phase } from '../lib/mapKinds';
import type { PendingRow as PendingRowState } from '../lib/pendingRow';

/**
 * What to do when the round is done, under the round it is done with.
 *
 * Composition and one choice: which of the two things below a round is the
 * right one right now.
 *
 * - Still being answered → the count. The cards are the action.
 * - Answered, and the map may still be reaching → NOTHING. The pending row
 *   above is already saying it, and a second line would say it twice.
 * - Answered, and nothing more is coming → the phase's action.
 *
 * No presence line lives here. The action only ever appears once the pending
 * row has SETTLED, and the settled row directly above already says who can hear
 * the log — in a sentence covering all three states rather than only absence.
 */
export default function RowFooter({
  phase,
  answered,
  questions,
  pending,
  mapId,
  contribute,
}: {
  phase: Phase;
  /** Answered questions in the newest round. */
  answered: number;
  /** How many questions that round asked. Zero for a round of statements. */
  questions: number;
  /** The same decision the pending row is drawn from, so the two cannot
   *  disagree about whether the wait is over. */
  pending: PendingRowState;
  mapId?: string;
  contribute?: NoteWriter;
}) {
  if (questions > 0 && answered < questions) {
    return <RowProgress answered={answered} questions={questions} />;
  }

  if (pending.kind !== 'settled') return null;

  return <PhaseAdvance phase={phase} mapId={mapId} contribute={contribute} />;
}

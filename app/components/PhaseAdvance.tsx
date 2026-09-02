'use client';

import { useAdvancePhase, type NoteWriter } from '../hooks/useAdvancePhase';
import { PHASE_ASK, type Phase } from '../lib/mapKinds';

/**
 * The one action worth taking when a phase's work is done.
 *
 * It sits at the bottom of the round you just finished rather than up in the
 * chrome: with the map drawn as a column you answer in place, the eye is
 * already here, and "you have finished this — here is what is next" belongs
 * where the eye already is.
 *
 * The sentence and the label both come from `PHASE_ASK`, beside the phase
 * labels, so the step the nav names and the step this offers to leave cannot
 * drift apart. What the press actually does — note first, then the phase —
 * lives in `useAdvancePhase`.
 */
export default function PhaseAdvance({
  phase,
  mapId,
  contribute,
}: {
  phase: Phase;
  /** Absent in an isolated scenario, where there is no map to advance. */
  mapId?: string;
  contribute?: NoteWriter;
}) {
  const ask = PHASE_ASK[phase];
  const { advance, busy, error } = useAdvancePhase(ask.next, mapId, contribute);

  // `idea` has not reached the map yet and `next-steps` is where the loop
  // arrives — neither has a page-side way to end, so neither draws a button.
  if (!ask.action || !ask.next) return null;

  return (
    <div className="mb-8">
      <p className="mb-3 text-[12.5px] leading-snug text-muted">
        {ask.sentence}
      </p>

      <button
        type="button"
        onClick={() => void advance()}
        disabled={busy || !mapId}
        className="rounded-full border border-ink bg-ink px-5 py-2 text-[13px] font-semibold text-surface transition hover:opacity-80 disabled:opacity-40"
      >
        {busy ? 'Moving on…' : ask.action}
      </button>

      {error ? (
        <p className="mt-2 text-[11px] leading-snug text-muted">{error}</p>
      ) : null}
    </div>
  );
}

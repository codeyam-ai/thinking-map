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
 *
 * `tone` exists because this now has two homes with opposite grounds. The
 * column is paper; the board's chat panel is near-black, where `bg-ink` is a
 * black button on a black panel. Same component, same words, same action —
 * only the two colour pairs differ, which is the smallest thing that can
 * differ and still leave the control visible in both places.
 */
export default function PhaseAdvance({
  phase,
  mapId,
  contribute,
  tone = 'paper',
}: {
  phase: Phase;
  /** Absent in an isolated scenario, where there is no map to advance. */
  mapId?: string;
  contribute?: NoteWriter;
  /** `paper` for the light column, `board` for the dark chat panel. */
  tone?: 'paper' | 'board';
}) {
  const ask = PHASE_ASK[phase];
  const { advance, busy, error } = useAdvancePhase(ask.next, mapId, contribute);

  // `idea` has not reached the map yet and `next-steps` is where the loop
  // arrives — neither has a page-side way to end, so neither draws a button.
  if (!ask.action || !ask.next) return null;

  const board = tone === 'board';

  return (
    <div className={board ? '' : 'mb-8'}>
      <p
        className={`mb-3 text-[12.5px] leading-snug ${
          board ? 'text-white/45' : 'text-muted'
        }`}
      >
        {ask.sentence}
      </p>

      <button
        type="button"
        onClick={() => void advance()}
        disabled={busy || !mapId}
        className={`rounded-full px-5 py-2 text-[13px] font-semibold transition hover:opacity-80 disabled:opacity-40 ${
          board
            ? 'border border-white/25 bg-transparent text-white'
            : 'border border-ink bg-ink text-surface'
        }`}
      >
        {busy ? 'Moving on…' : ask.action}
      </button>

      {error ? (
        <p
          className={`mt-2 text-[11px] leading-snug ${
            board ? 'text-white/45' : 'text-muted'
          }`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

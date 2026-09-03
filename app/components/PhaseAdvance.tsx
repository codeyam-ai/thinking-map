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
  /** `paper` for the light column, `board` for the dark chat panel, `bar` for
   *  the one line over the map.
   *
   *  `bar` drops the sentence and keeps the button. The sentence explains WHY
   *  the phase is done — worth a paragraph where there is room for one — but in
   *  the bar it competed with the count for the same line and turned the one
   *  place that says where to go into a paragraph. The button still says where
   *  it goes, which is the part that has to survive. */
  tone?: 'paper' | 'board' | 'bar';
}) {
  const ask = PHASE_ASK[phase];
  const { advance, busy, error } = useAdvancePhase(ask.next, mapId, contribute);

  // `idea` has not reached the map yet and `next-steps` is where the loop
  // arrives — neither has a page-side way to end, so neither draws a button.
  if (!ask.action || !ask.next) return null;

  const board = tone === 'board';
  const bar = tone === 'bar';

  return (
    <div className={board || bar ? 'min-w-0' : 'mb-8'}>
      {/* Dropped in the bar. The sentence is one line of reasoning about a
          phase that is finished, and in a bar it would push the one control
          that says where to go off the end of the row. */}
      {bar ? null : (
        <p
          className={`mb-3 text-[12.5px] leading-snug ${
            board ? 'text-white/45' : 'text-muted'
          }`}
        >
          {ask.sentence}
        </p>
      )}

      <button
        type="button"
        onClick={() => void advance()}
        disabled={busy || !mapId}
        // In the bar it wears the lime, because it is now the one thing on the
        // board asking for the person — the same slot, and the same treatment,
        // the waiting-questions count has when there are questions waiting.
        className={`rounded-full font-semibold transition hover:opacity-80 disabled:opacity-40 ${
          bar
            ? 'shrink-0 whitespace-nowrap bg-[#D5F560] px-4 py-1.5 text-[12.5px] text-black'
            : board
              ? 'border border-white/25 bg-transparent px-5 py-2 text-[13px] text-white'
              : 'border border-ink bg-ink px-5 py-2 text-[13px] text-surface'
        }`}
      >
        {busy ? 'Moving on…' : ask.action}
      </button>

      {error ? (
        <p
          className={`mt-2 text-[11px] leading-snug ${
            board || bar ? 'text-white/45' : 'text-muted'
          }`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

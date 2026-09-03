// What the far end of the board says before the partner has written anything.
//
// Presentational and stateless, in the manner of `PendingRow`: the clock that
// decides which of these two things is true lives in `InsightStack`, and what
// the elapsed time MEANS is decided there too. Splitting it that way is what
// lets both states be captured — a component that owned its own twenty-second
// timer could only ever be photographed in the first one.
//
// The rule it holds is the same rule the pending row holds, for the same
// reason. WebMCP is pull-only: this page cannot summon an agent, cannot start
// its turn, and has no way of knowing whether one is coming. So the marker is
// BOUNDED, and what it resolves into is a statement about who can actually
// hear this board — not a promise that something is on its way.

import { settledNote } from '../lib/pendingRow';
import type { BridgeStatus } from './WebMcpBridge';

export default function InsightStackEmpty({
  settled,
  status,
}: {
  /** Whether the marker's time is up. */
  settled: boolean;
  status: BridgeStatus;
}) {
  if (settled) {
    // The tested sentence itself, never a hand-copy. Nine hand-copied
    // duplicates is how this wording came to be wrong in one place and right
    // in another.
    return (
      <p className="text-[15px] leading-relaxed text-white/45">
        {settledNote(status)}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span
        className="block h-[14px] w-[14px] shrink-0 rounded-full"
        style={{ background: 'rgba(255,255,255,0.22)' }}
      />
      {/* Names the place rather than the wait. "Composing…" would be the same
          lie the cycling word was on a board nobody is attached to: it claims
          something is being written, and this page cannot know that. */}
      <span className="text-[15px] text-white/35">
        What the partner makes of this will land here
      </span>
    </div>
  );
}

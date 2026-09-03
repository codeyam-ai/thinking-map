'use client';

// The thinking behind one insight: what it came out of, where it could go, and
// the box for asking the partner to go further.
//
// Its own component because it is what OPENING a card reveals, and a component
// that could only be reached by clicking its parent could only ever be
// photographed in the closed state. Splitting it is the same move `PendingRow`
// makes against `ThinkingMapView` and `InsightStackEmpty` against
// `InsightStack`: the parent owns the state, this owns the rendering, and both
// halves can be captured on their own.
//
// Composition only. Each section below decides for itself whether it has
// anything to say — `InsightSources` and `InsightWaysForward` both render
// nothing rather than an empty heading — so the order here is the argument and
// nothing else: what this IS, what it came OUT of, where it GOES, and how to
// push on it.

import InsightSources from './InsightSources';
import InsightWaysForward from './InsightWaysForward';
import InsightGoDeeper from './InsightGoDeeper';
import type { BoardInsight } from './InsightCard';

export default function InsightDetail({
  insight,
  hue = 62,
  onChoose,
  onClose,
}: {
  insight: BoardInsight;
  hue?: number;
  /** Taking one of the ways forward. Not an answer: nothing on the map is
   *  being closed, a direction is being taken, and what the partner does next
   *  depends on which. `BoardWorkspace` turns it into a `user.note`. */
  onChoose?: (choice: string) => void;
  /** Collapsing the card this sits in — what the composer's × means here. */
  onClose: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-5">
      {insight.detail ? (
        <p className="text-[13.5px] leading-relaxed text-white/60">
          {insight.detail}
        </p>
      ) : null}

      <InsightSources sources={insight.from} hue={hue} />

      <InsightWaysForward
        choices={insight.choices}
        hue={hue}
        onChoose={onChoose}
      />

      <InsightGoDeeper
        nodeId={insight.id}
        label={insight.label}
        onClose={onClose}
      />
    </div>
  );
}

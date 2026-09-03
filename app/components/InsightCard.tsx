'use client';

// One thing the partner is willing to say about the idea as a whole.
//
// Collapsed it is a claim. Opened it is the thinking behind the claim — see
// `InsightDetail`, which is that half.
//
// Opening is deliberately NOT the same act as asking. A single click that fired
// a request at the agent would spend the person's one attention-getting channel
// on a card they may only have wanted to read, and WebMCP gives them exactly
// one: a contribution wakes an agent parked on `await_user_activity`, and there
// is no way to un-send it. So the click expands to what is already on the
// board, and the composer underneath is what sends.

import { useState } from 'react';
import InsightCardEyebrow from './InsightCardEyebrow';
import InsightDetail from './InsightDetail';
import type { Insight } from '../lib/insightStream';

/** An insight as the BOARD holds one.
 *
 *  `insightStream` reads the fields staleness and citation need and no more —
 *  it is shared with the server's `read_map`, where a card's ways forward mean
 *  nothing. The board has them, because they are on the node it passed in and
 *  the stream spreads it. Optional, so a plain `Insight` is still one of these
 *  and the server-side callers are untouched. */
export type BoardInsight = Insight & { choices?: string[] | null };

export default function InsightCard({
  insight,
  hue = 62,
  onChoose,
}: {
  insight: BoardInsight;
  hue?: number;
  /** Taking one of the ways forward. Not an answer: nothing on the map is
   *  being closed, a direction is being taken, and what the partner does next
   *  depends on which. `BoardWorkspace` turns it into a `user.note`. */
  onChoose?: (choice: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    // A plain div, and deliberately NOT role="button" — the same rule
    // `QuestionCard` sets out at length. An element's accessible name is
    // computed from its contents, so a card announcing itself as a button would
    // swallow the ways-forward buttons, the prompts and the composer's own
    // field into one enormous label. The card is a container that takes a
    // click; the controls inside it are what a keyboard or a screen reader
    // should find.
    <div
      onClick={() => setOpen((o) => !o)}
      // The handle for the thing that has no role and no accessible name. A
      // container that takes a click is exactly what a fixture or a render
      // test cannot reach by label, and the alternative — giving it a role so
      // it could be found — is the accessibility bug the comment above rules
      // out. `data-no-pan` beside it is the board's own drag guard.
      data-insight-card
      data-no-pan={open ? '' : undefined}
      className="w-full rounded-[20px] border p-5 text-left transition-colors"
      style={{
        background: '#0b0b0c',
        borderColor: open
          ? `hsl(${hue} 80% 60% / 0.55)`
          : 'rgba(255,255,255,0.12)',
      }}
    >
      <InsightCardEyebrow
        kind={insight.kind}
        answersSince={insight.answersSince}
        hue={hue}
      />

      <p className="mt-2.5 text-[17px] font-semibold leading-snug text-white">
        {insight.label}
      </p>

      {open ? (
        <InsightDetail
          insight={insight}
          hue={hue}
          onChoose={onChoose}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

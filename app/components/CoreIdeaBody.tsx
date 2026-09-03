'use client';

import { coreIdeaFontSize } from '@/app/lib/coreIdeaType';
import { useClippedText } from './useClippedText';

// What is written on the core's paper: the question, and the answer to it.
//
// The eyebrow is the label that replaced the shape. The core used to be the one
// ROUND object on a board of rectangles, and that is how you knew at any zoom
// which thing everything else was about. A card cannot say that with its
// outline, so it says it in words — the literal question the first card asked,
// quoted back, which makes the idea legible as an ANSWER rather than a caption.
//
// It is set in sentence case, not the board's usual uppercase eyebrow: putting
// a question in caps turns it into a section heading, and this is a question.
//
// The idea itself is regular weight. Bold was survivable on one sentence inside
// a disc; over a paragraph of somebody's own words it reads as shouting.

/** The question the first card asked, carried over as the card's own label. */
const EYEBROW_TEXT = 'What are you trying to figure out?';

/** How far up from the bottom edge the text starts dissolving. */
const FADE_DEPTH = 64;
const FADE = `linear-gradient(to bottom, #000 calc(100% - ${FADE_DEPTH}px), transparent)`;

export default function CoreIdeaBody({ seedIdea }: { seedIdea: string }) {
  const { ref, clipped, onScroll } = useClippedText<HTMLParagraphElement>([
    seedIdea,
  ]);

  return (
    <>
      <p className="mb-6 text-[17px] font-medium" style={{ color: 'var(--ink-soft)' }}>
        {EYEBROW_TEXT}
      </p>

      {/* `min-h-0` is what makes the card's height cap work at all: a flex
          child defaults to min-height:auto and refuses to shrink below its own
          content, so without it a very long idea would overflow the cap instead
          of scrolling inside it — the same spill this card was rebuilt to end.

          The fade IS the affordance for that cut-off. Masking the text itself,
          rather than laying a paper-coloured panel over it, means the cue can
          never be a hair off the card's own fill. It appears only when text is
          genuinely hidden and lifts the moment you reach the end, so a finished
          sentence is never left dimmed. */}
      <p
        ref={ref}
        onScroll={onScroll}
        className="min-h-0 overflow-y-auto text-left leading-[1.45]"
        style={{
          fontSize: coreIdeaFontSize(seedIdea),
          maskImage: clipped ? FADE : undefined,
          WebkitMaskImage: clipped ? FADE : undefined,
        }}
      >
        {seedIdea}
      </p>
    </>
  );
}

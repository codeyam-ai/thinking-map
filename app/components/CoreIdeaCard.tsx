// The idea the whole board orbits.
//
// PAPER, and the only paper object here. This used to be a white disc, and the
// shape did the labelling: on a board of rectangles, the thing that was not a
// card was the thing everything else was about. That argument was real, but it
// was paid for by the text — a fixed circle can only hold a longer idea by
// shrinking the type, and past a few hundred words it stopped even doing that
// and simply spilled the person's own sentence onto the black.
//
// So the shape stops carrying the meaning and the surface does. Every other
// card here is white or coloured; this one is `--paper`, the product's own
// ground, which still makes it the one object of its kind at any zoom. What the
// shape used to say, the eyebrow now says in words — see `CoreIdeaBody`.
//
// The rule is inverted from what it was. The type has a floor and the card
// grows downward to hold what it must, because the idea a person typed is the
// one thing on this board that is entirely theirs and it has to stay readable.
//
// The WIDTH does not move. `fanPath` starts every connector at the core's
// horizontal edge and `layOutGalaxy` builds its bounds from the same radius, so
// a fixed width is what keeps every horizontal relationship on the board — hub
// distance, fan curves, frame-all's left and right — untouched by an idea's
// length. Only the height responds.

import { coreCopyText } from '@/app/lib/boardCopyText';
import { CARD_SIZE } from '@/app/lib/galaxyLayout';
import CoreAttachments, { type Attachment } from './CoreAttachments';
import CopyTextButton from './CopyTextButton';
import CoreIdeaBadge from './CoreIdeaBadge';
import CoreIdeaBody from './CoreIdeaBody';

const CORE_RADIUS = 250;

/**
 * Past this the card stops growing and the idea scrolls inside it. One person
 * with a two-thousand-word idea should not turn the centre of the board into a
 * mile of paper that every other card has to be found around.
 */
const MAX_HEIGHT = 950;

// The partner's reading of the idea used to be printed here as well, under the
// circle. It is not any more: the far end of the board now carries a live stack
// of insights, and a board that also printed the newest one on the core would
// be drawing the same node twice on one plane. Two homes for one insight is
// worse than either home on its own, and the far end is the one the board's
// left-to-right argument points at.

export default function CoreIdeaCard({
  seedIdea,
  mapId,
  attachments = [],
}: {
  seedIdea: string;
  mapId?: string;
  attachments?: Attachment[];
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: 0, top: 0, width: CORE_RADIUS * 2 }}
    >
      {/* Height is deliberately absent: the card is as tall as the idea needs,
          up to MAX_HEIGHT. Everything hung below it reads its real bottom off
          this element rather than guessing at a constant.

          `group` is what reveals the copy control on hover — see below. */}
      <div
        className="group relative flex flex-col rounded-[36px]"
        style={{
          background: 'var(--paper)',
          color: 'var(--ink)',
          padding: 40,
          maxHeight: MAX_HEIGHT,
          // No ring. The heavy border existed to stop a white disc dissolving
          // into its own glow; a large paper rectangle on black has an edge
          // already, and only needs the shadow to sit above the board.
          boxShadow: '0 0 150px rgba(255,255,255,0.10)',
        }}
      >
        <CoreIdeaBody seedIdea={seedIdea} />
        <CoreIdeaBadge />

        {/* Dragging the board suppresses text selection, so the idea in the
            person's own words can no longer be swiped over — this is what
            replaces that.

            It sits at a plain top-right corner inset, the same one QuestionCard
            uses. On the disc this had to be pulled in to roughly 16% on both
            axes, because a rectangle's corner offset lands OUTSIDE a circle;
            now that the core is a rectangle that workaround is not just
            unnecessary, it would float the control away from the edge it
            belongs to. Top-RIGHT specifically: the badge is parked on the
            top-left corner, and the eyebrow runs from the left.

            Black rather than a theme hue, because the core is still the one
            object on this board that takes no colour — see the note at the top
            of the file — so an accent here would be the first thing to
            contradict it.

            Only ONE button, not the two the original plan described: the
            partner's reading of the idea is no longer printed here, it lives at
            the far end of the board, and its copy button went with it onto
            `InsightCard`. `coreCopyText` still takes the reading so the pairing
            survives wherever it IS printed. */}
        <CopyTextButton
          text={coreCopyText({ seedIdea })}
          label="Copy this idea"
          accent="rgba(0,0,0,0.5)"
          className="absolute right-6 top-6"
        />
      </div>

      {/* What came in with the idea, directly under the card and above the
          partner's reading of it: it is the person's own material, and it
          belongs nearer to their words than to the answer.

          `top-full` is the point of this wrapper — it reads the card's REAL
          bottom. The old `CORE_RADIUS * 2 + 26` hardcoded the disc's 500-unit
          height, so the moment the card's height varied it would either land on
          top of the idea or float away from it. */}
      {mapId ? (
        <div
          className="absolute left-1/2 top-full -translate-x-1/2"
          style={{ marginTop: 26 }}
        >
          <CoreAttachments mapId={mapId} attachments={attachments} />
        </div>
      ) : null}

      {/* Referenced so the import stays honest about what sizes this file is
          laid out against. */}
      <span className="hidden">{CARD_SIZE.width}</span>
    </div>
  );
}

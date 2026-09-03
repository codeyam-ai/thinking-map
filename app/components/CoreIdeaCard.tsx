// The idea the whole board orbits.
//
// A filled circle, not a card. Everything else on this board is a rectangle —
// questions, insights — so making the idea the one round, one solid object
// means it never has to be labelled to be found: at any zoom, the thing that is
// not a card is the thing everything else is about.
//
// White, and the only white object here. Colour on this board means "a line of
// thinking", so the idea takes no colour at all: it is what the lines are about
// rather than one of them. The heavy ring is what keeps a white disc from
// dissolving into its own glow against black.
//
// The badge orbits. Slowly enough that it is never something to watch — you
// notice on the second look that it has moved — which is the difference between
// a board that is alive and one that is animated at you.

import { coreCopyText } from '@/app/lib/boardCopyText';
import { CARD_SIZE } from '@/app/lib/galaxyLayout';
import CoreAttachments, { type Attachment } from './CoreAttachments';
import CopyTextButton from './CopyTextButton';

const CORE_FILL = '#ffffff';
const RING = '#333336';
const BADGE = '#e4ec4b';
const CORE_RADIUS = 250;
/** One turn. Slow on purpose — see above. */
const ORBIT_SECONDS = 54;

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
  // Long ideas get smaller type rather than a bigger circle: the circle's size
  // is what marks it as the centre, so it has to stay put while the text it
  // holds does not.
  const size = seedIdea.length > 120 ? 26 : seedIdea.length > 60 ? 31 : 38;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: 0, top: 0, width: CORE_RADIUS * 2, height: CORE_RADIUS * 2 }}
    >
      <div
        className="group relative flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: CORE_FILL,
          border: `18px solid ${RING}`,
          boxShadow: '0 0 150px rgba(255,255,255,0.10)',
        }}
      >
        <p
          className="px-12 text-left font-semibold leading-[1.16] text-black"
          style={{ fontSize: size }}
        >
          {seedIdea}
        </p>

        {/* Dragging the board suppresses text selection, so the idea in the
            person's own words can no longer be swiped over — this is what
            replaces that. Inset from the rim by roughly the same amount in both
            axes: on a circle, a corner offset that would be right for a
            rectangle lands outside the shape.

            Black rather than a theme hue, because the disc is the one object on
            this board that takes no colour — see the note at the top of the
            file — so an accent here would be the first thing to contradict it.

            Only ONE button, not the two the plan described: the partner's
            reading of the idea is no longer printed under the circle, it lives
            at the far end of the board, and its copy button went with it onto
            `InsightCard`. `coreCopyText` still takes the reading so the pairing
            survives wherever it IS printed. */}
        <CopyTextButton
          text={coreCopyText({ seedIdea })}
          label="Copy this idea"
          accent="rgba(0,0,0,0.5)"
          className="absolute bottom-[16%] right-[16%]"
        />
      </div>

      {/* The orbit. The arm is centred on the disc and turns; the badge sits at
          the end of it and turns back, so the word stays readable the whole way
          round. Both are pointer-events-none — this is scenery, and a moving
          target is a bad thing to make someone chase. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
        style={{
          animation: `cy-orbit-arm ${ORBIT_SECONDS}s linear infinite`,
        }}
      >
        <div
          className="absolute"
          style={{
            // Start at the top-left of the rim, where the mockup has it.
            transform: `rotate(-135deg) translate(${CORE_RADIUS}px) rotate(135deg)`,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full text-[16px] font-semibold text-black"
            style={{
              width: 108,
              height: 108,
              marginLeft: -54,
              marginTop: -54,
              background: BADGE,
              animation: `cy-orbit-upright ${ORBIT_SECONDS}s linear infinite`,
            }}
          >
            Idea
          </div>
        </div>
      </div>

      {/* What came in with the idea, directly under the circle and above the
          partner's reading of it: it is the person's own material, and it
          belongs nearer to their words than to the answer. */}
      {mapId ? (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: CORE_RADIUS * 2 + 26 }}
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

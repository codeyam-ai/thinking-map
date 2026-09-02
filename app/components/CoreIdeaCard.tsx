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

import { CARD_SIZE } from '@/app/lib/galaxyLayout';

const CORE_FILL = '#ffffff';
const RING = '#333336';
const BADGE = '#e4ec4b';
const CORE_RADIUS = 250;
/** One turn. Slow on purpose — see above. */
const ORBIT_SECONDS = 54;

export interface CoreInsight {
  id: string;
  label: string;
  detail: string | null;
}

export default function CoreIdeaCard({
  seedIdea,
  insight,
}: {
  seedIdea: string;
  /** The partner's current answer to the idea itself, as opposed to its
   *  answer to any one line of thinking. Null until a round has produced one. */
  insight?: CoreInsight | null;
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
        className="flex h-full w-full items-center justify-center rounded-full"
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

      {/* Each round's answer to the idea, hung under the circle rather than
          crammed inside it — the circle holds the person's words, and nothing
          the partner writes should be set in the same frame as them. */}
      {insight ? (
        <div
          className="absolute left-1/2 w-[430px] -translate-x-1/2 rounded-[20px] border border-white/12 bg-[#0b0b0c] p-6"
          style={{ top: CORE_RADIUS * 2 + 40 }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e4ec4b]">
            What that tells us
          </span>
          <p className="mt-2 text-[17px] font-medium leading-snug text-white">
            {insight.label}
          </p>
          {insight.detail ? (
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">
              {insight.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Referenced so the import stays honest about what sizes this file is
          laid out against. */}
      <span className="hidden">{CARD_SIZE.width}</span>
    </div>
  );
}

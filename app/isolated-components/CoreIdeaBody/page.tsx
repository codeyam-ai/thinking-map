'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/CoreIdeaBody';

// The harness reproduces the core card itself: 500 units wide, 40 of padding,
// paper fill, a flex column capped at 950.
//
// Every one of those numbers is load-bearing here rather than decoration. The
// WIDTH is what decides where the type wraps and therefore how tall the card
// gets. The flex column plus the cap is what the component's `min-h-0` exists
// to work against — without them the clipped frame below cannot happen at all,
// and the fade it is here to prove would never appear.

const CARD_WIDTH = 500;
const MAX_HEIGHT = 950;

const MEDIUM =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back.";
const LONG =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back, a lab result nobody chased. Everyone blames the whiteboard but I don't think the whiteboard is the problem, and every time I try to describe what would replace it I end up describing a practice management system nobody wants.";

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, string> = {
    // The length people actually type. The card is a comfortable rectangle and
    // the type sits at the top of the scale.
    Default: MEDIUM,
    // One line. Mostly paper, which is the frame that proves the card still
    // reads as the centre of the board when it is holding almost nothing —
    // the job the circle used to do with its shape.
    ShortIdea: 'Handover between shifts at a small vet practice',
    // The case the whole change was made for. Under the old rule this idea was
    // crammed into a fixed circle at shrinking type and then spilled out of it
    // onto the black board; here the type steps down one notch and the CARD
    // grows to hold every word of it.
    LongIdea: LONG,
    // Past the height cap. The type is at its floor and cannot go lower, so
    // the card stops growing and the words scroll inside it — and the last
    // lines fade out, which is the only thing telling you there is more. The
    // frame that proves the cap does not silently swallow a sentence.
    ClippedIdea: `${LONG} ${LONG} ${LONG} ${LONG} ${LONG} ${LONG}`,
  };
  const seedIdea = preset[s];
  if (seedIdea === undefined) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex flex-col rounded-[36px]"
        style={{
          width: CARD_WIDTH,
          maxHeight: MAX_HEIGHT,
          padding: 40,
          background: 'var(--paper)',
          color: 'var(--ink)',
        }}
      >
        <Component seedIdea={seedIdea} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}

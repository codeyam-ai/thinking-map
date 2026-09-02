"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/QuestionCard";
import type { PlacedCard } from "../../lib/galaxyLayout";

// A client harness rather than a server page, because the card takes callbacks
// (`onFocus`, `onAnswer`) and a function cannot cross the server/client
// boundary as a prop. Same shape as `AnswerChips` for the same reason.

/** Hues are the ones `hueForIndex` hands out for themes 0, 1 and 2, written as
 *  literals so a capture pins the palette the layout actually produces rather
 *  than re-deriving it and passing back whatever the function returns today.
 *  This is the practice `MapScreen`'s fixture already established. */
const MAGENTA = 318;
const GREEN = 96;
const BLUE = 233;

/** The card is normally placed by `layOutGalaxy`, which supplies x/y/w. In
 *  isolation nothing is laying anything out, so the geometry is fixed here and
 *  the wrapper below gives the card the box it would have had on the board. */
const card = (
  over: Partial<PlacedCard> & Pick<PlacedCard, "kind" | "label">,
): PlacedCard => ({
  id: "c1",
  themeId: "t-context",
  detail: null,
  status: "open",
  choices: null,
  imageUrl: null,
  imageAlt: null,
  diagram: null,
  hue: MAGENTA,
  x: 0,
  y: 0,
  w: 300,
  ...over,
});

const scenarios: Record<
  string,
  { card: PlacedCard; focused?: boolean; width?: number }
> = {
  // An unanswered card must always look typeable. The field is present without
  // anything being clicked first — the one thing a first-time user has to
  // discover is that these are typed into, so the affordance exists before the
  // interaction that would reveal it.
  Open: {
    card: card({
      kind: "open-question",
      label: "At what moment does the handover actually get dropped?",
    }),
  },

  // A shortlist ABOVE the free-text field. The list narrows the question
  // without ever closing it: every list the partner writes is a guess about
  // what you might say, and the guess must never be the only thing you are
  // allowed to say — so "Other…" sits underneath as a real way out.
  Choices: {
    card: card({
      kind: "open-question",
      label: "Which handover item goes missing most often?",
      choices: [
        "Owner call-backs",
        "Re-checks",
        "Lab results to chase",
        "Medication changes",
      ],
    }),
  },

  // Answered: the dark surface, the question demoted to the small accent line,
  // and what the person said carrying the card in white. The pencil is what
  // makes an answer a thought at a moment rather than a verdict.
  Answered: {
    card: card({
      kind: "open-question",
      label: "Which handover item goes missing most often?",
      detail:
        "Owner call-backs. A missed re-check surfaces the next morning; a missed call-back surfaces in a public review three weeks later.",
      status: "answered",
      hue: GREEN,
    }),
  },

  // The partner's own thinking rather than a question for you. The eyebrow
  // reads the word for the KIND — "Assumption", not a generic "Insight" — which
  // is `cardEyebrow`'s job and the reason the card no longer decides it.
  Insight: {
    card: card({
      kind: "assumption",
      label: "The receptionist is already the informal handover system",
      detail:
        "She remembers what the board does not, which is why nobody has felt the gap as a system problem yet.",
      status: "answered",
      hue: GREEN,
    }),
  },

  // A card carrying a picture, at the wide width. A reference card exists so
  // someone can LOOK at the thing, so the image sits above the words rather
  // than under a caption describing what they are about to see.
  Reference: {
    card: card({
      kind: "finding",
      label: "The whiteboard is wiped at 6pm, before the evening shift has read it",
      detail: "Photographed on two consecutive Tuesdays. The evening vet arrives at 6:15.",
      status: "answered",
      imageUrl:
        "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&q=80",
      imageAlt:
        "A wall-mounted whiteboard covered in handwritten notes, half of it wiped clean.",
      hue: BLUE,
      w: 420,
    }),
    width: 420,
  },

  // A drawn shape, also at the wide width — wide enough that a four-step flow
  // reads as a flow rather than as a stack of slivers.
  Diagram: {
    card: card({
      kind: "approach",
      label: "A handover list that survives the shift boundary",
      detail: null,
      status: "answered",
      diagram: {
        steps: [
          "Vet promises a call-back",
          "It joins the open list with their name on it",
          "Evening shift sees it unclosed",
          "Closing it needs a person, not a wipe",
        ],
        note: "The wipe is what deletes the state today.",
      },
      hue: BLUE,
      w: 420,
    }),
    width: 420,
  },

  // The focus ring, which is what tells you which card the board's attention is
  // on when a dozen of them are visible at once.
  //
  // Deliberately a card WITH a shortlist: focus also autofocuses the free-text
  // box, and a capture iframe blocks cross-origin autofocus — so a focused
  // card whose field is showing cannot be captured at all. With options up
  // there is no textarea to focus, and the ring is what this frame is for.
  Focused: {
    card: card({
      kind: "open-question",
      label: "Does this replace the whiteboard or sit beside it?",
      choices: ["Replace it", "Sit beside it"],
    }),
    focused: true,
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Open";
  const scenario = scenarios[s];
  // Held so answering is genuinely wired up rather than dropped on the floor.
  const [answer, setAnswer] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  const isFocused = scenario.focused || focused;

  // The card is `h-full w-full`: on the board its box comes from the layout, so
  // in isolation the harness has to supply one or the card collapses to its
  // padding. The dark ground is the board's, because a card designed against
  // near-black reads as a different object on white.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div style={{ width: scenario.width ?? 300, height: 360 }}>
        <Component
          card={scenario.card}
          focused={isFocused}
          onFocus={() => setFocused(true)}
          onAnswer={setAnswer}
        />
      </div>
      {answer ? (
        <div className="mt-3 text-[12px] text-white/50">answered: {answer}</div>
      ) : null}
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

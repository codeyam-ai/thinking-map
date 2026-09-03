import Component from "../../../app/components/CoreIdeaCard";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The idea at the centre of the board — the thing every galaxy orbits.
//
// The card's WIDTH is what keeps the board's geometry stable, so it never
// moves; the HEIGHT grows with the idea. That is the rule most of these
// scenarios are here to hold, and the reason they run from one line to past the
// height cap: the words stay readable and the paper takes up the slack.

const SHORT = "Handover between shifts at a small vet practice";
const MEDIUM =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back.";
const LONG =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back, a lab result nobody chased. Everyone blames the whiteboard but I don't think the whiteboard is the problem, and every time I try to describe what would replace it I end up describing a practice management system nobody wants.";
// Someone who empties their head into the box in one go. Long enough that even
// at the type floor the card hits its height cap, which is the state the cap
// exists for and the only one that proves it holds.
const OVERFLOWING = `${LONG} ${LONG} ${LONG} ${LONG} ${LONG} ${LONG}`;

const scenarios: Record<string, Props> = {
  // The ordinary case: an idea of the length someone actually types.
  Default: { seedIdea: MEDIUM, mapId: "map-galaxy" },

  // A short idea gets the largest type, on a card that is mostly paper. The
  // WIDTH is the same as every other scenario here — that is the point, and it
  // is the only dimension that is still fixed.
  ShortIdea: { seedIdea: SHORT, mapId: "map-galaxy" },

  // A long one steps the type down to a readable floor and the CARD GROWS to
  // hold the rest. The old rule was the reverse — shrink the words, protect the
  // shape — and past a few hundred characters it stopped working and spilled
  // the sentence onto the black board. The width still never moves, so no
  // galaxy has to shift to accommodate one long idea.
  LongIdea: { seedIdea: LONG, mapId: "map-galaxy" },

  // Past the height cap: the one idea long enough that the card stops growing
  // and the words scroll inside it. Without this frame the cap is a number
  // nobody has ever seen take effect, and the failure it prevents — a mile of
  // paper down the middle of the board — only shows up on somebody's real idea.
  OverflowingIdea: { seedIdea: OVERFLOWING, mapId: "map-galaxy" },

  // What the person brought along with the idea, listed under it. The board
  // holds the FILE now, so a picture shows as a picture — and an attachment
  // recorded before it could do that still shows as a paperclip, which is what
  // this frame carries both of.
  WithAttachments: {
    seedIdea: MEDIUM,
    mapId: "map-galaxy",
    attachments: [
      {
        id: "att-whiteboard",
        name: "whiteboard-photo.png",
        mediaType: "image/png",
        byteSize: 1563,
        hasBytes: true,
      },
      {
        id: "att-handover-notes",
        name: "shift-handover-notes.pdf",
        mediaType: "application/octet-stream",
        byteSize: 0,
        hasBytes: false,
      },
    ],
  },

  // Day one: an idea and nothing else. No attachments — the state someone
  // meets in the second after they press return.
  //
  // There is no WithInsight case any more. The partner's reading of the idea
  // is the insight stack's, at the far end of the board; printing it here as
  // well would be the same node drawn twice on one plane.
  DayOne: { seedIdea: SHORT },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // The core centres itself on its parent's ORIGIN — `left: 0, top: 0` with a
  // half-translate back — because on the board that origin is the map's centre,
  // the point every galaxy orbits. A wrapper that leaves the origin in its
  // top-left corner therefore hangs three quarters of the circle outside the
  // frame, so the harness moves the origin to the middle of the box and sizes
  // the box for the 500-unit circle plus the attachments listed beneath it.
  return (
    <div id="codeyam-capture" style={{ background: "#000" }}>
      <div style={{ position: "relative", width: 700, height: 760 }}>
        <div style={{ position: "absolute", left: "50%", top: "45%" }}>
          <Component {...props} />
        </div>
      </div>
    </div>
  );
}

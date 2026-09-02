import Component from "../../../app/components/CoreIdeaCard";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The idea at the centre of the board — the thing every galaxy orbits.
//
// The circle's size is what marks it as the centre, so it stays put while the
// text inside it shrinks to fit. That is the rule most of these scenarios are
// here to hold: a long idea must not grow the circle.

const SHORT = "Handover between shifts at a small vet practice";
const MEDIUM =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back.";
const LONG =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back, a lab result nobody chased. Everyone blames the whiteboard but I don't think the whiteboard is the problem, and every time I try to describe what would replace it I end up describing a practice management system nobody wants.";

const scenarios: Record<string, Props> = {
  // The ordinary case: an idea of the length someone actually types.
  Default: { seedIdea: MEDIUM, mapId: "map-galaxy" },

  // A short idea gets the largest type. The circle is the same size as every
  // other scenario here — that is the point.
  ShortIdea: { seedIdea: SHORT, mapId: "map-galaxy" },

  // A long one gets smaller type instead of a bigger circle. Growing the
  // circle would move every galaxy on the board to accommodate one sentence.
  LongIdea: { seedIdea: LONG, mapId: "map-galaxy" },

  // What the person brought along with the idea, listed under it. Names only —
  // the board is a place to point AT things, not to hold them.
  WithAttachments: {
    seedIdea: MEDIUM,
    mapId: "map-galaxy",
    attachments: [
      { name: "shift-handover-notes.pdf" },
      { name: "whiteboard-photo.jpg" },
    ],
  },

  // The partner's answer to the IDEA itself, as opposed to its answer to any
  // one line of thinking. Withheld until a round has produced one, because a
  // board that responded to a single typed sentence with "what that tells us"
  // would be inventing a reading of somebody it has not asked anything yet.
  WithInsight: {
    seedIdea: MEDIUM,
    mapId: "map-galaxy",
    insight: {
      id: "i1",
      label: "The whiteboard is a symptom of an ownership gap",
      detail:
        "Nothing is lost while it is on the board. Things are lost at the moment it is wiped and nobody is carrying them.",
    },
  },

  // Day one: an idea and nothing else. No attachments, no insight — the state
  // someone meets in the second after they press return.
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

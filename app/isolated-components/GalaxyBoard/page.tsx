"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/GalaxyBoard";
import type { GalaxyNodeInput, GalaxyTheme } from "../../lib/galaxyLayout";

// A client harness rather than a server page, because the board takes
// callbacks (`onAnswer`, `onChoose`) and a function cannot cross the
// server/client boundary as a prop.
//
// The board is the product's main surface and had no isolated fixture at all,
// which meant it could not be captured or reviewed without running the full app
// and binding an agent — and an agent cannot bind inside an iframe, so in
// practice it could not be reviewed at all.

/** The hues `hueForIndex` hands out for themes 0..11, written as literals so a
 *  capture pins the palette the layout actually produces rather than
 *  re-deriving it and passing back whatever the function returns today. This is
 *  the practice `MapScreen`'s fixture already established, extended to the full
 *  stress case. */
const HUES = [318, 96, 233, 11, 148, 286, 63, 201, 338, 116, 253, 31];

const SEED_IDEA =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back. Everyone blames the whiteboard but I don't think the whiteboard is the problem.";

const theme = (id: string, label: string, order: number): GalaxyTheme => ({
  id,
  label,
  hue: HUES[order],
  order,
});

const node = (
  id: string,
  themeId: string | null,
  kind: string,
  label: string,
  over: Partial<GalaxyNodeInput> = {},
): GalaxyNodeInput => ({
  id,
  themeId,
  kind,
  label,
  detail: null,
  status: "open",
  choices: null,
  imageUrl: null,
  imageAlt: null,
  diagram: null,
  ...over,
});

/** Three lines of thinking of deliberately UNEQUAL length — 3, 2 and 4 cards.
 *  Equal rows would let a layout bug that ignores the running width hide, and
 *  the conclusion has to clear the LONGEST run rather than a typical one. */
const THEMES: GalaxyTheme[] = [
  theme("th-context", "What actually gets lost", 0),
  theme("th-people", "Who is holding it", 1),
  theme("th-shape", "What it could be", 2),
];

const NODES: GalaxyNodeInput[] = [
  node("g-idea", null, "idea", "Handover between shifts at a small veterinary practice", {
    status: "answered",
  }),

  node("g-ctx-1", "th-context", "open-question", "Which handover item goes missing most often?", {
    detail:
      "Owner call-backs. A missed re-check surfaces the next morning; a missed call-back surfaces in a public review three weeks later.",
    status: "answered",
    choices: ["Owner call-backs", "Re-checks", "Lab results to chase", "Medication changes"],
  }),
  node("g-ctx-2", "th-context", "open-question", "At what moment does it actually get dropped?", {
    choices: [
      "During the verbal handover",
      "After handover, before the task is done",
      "It was never written down at all",
    ],
  }),
  // A picture makes this card WIDE, which is the case that proves a wide card
  // pushes its neighbours along instead of sitting under them.
  node("g-ctx-3", "th-context", "finding", "The whiteboard is wiped at 6pm, before the evening shift has read it", {
    detail: "Photographed on two consecutive Tuesdays. The evening vet arrives at 6:15.",
    status: "answered",
    imageUrl: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&q=80",
    imageAlt:
      "A wall-mounted whiteboard covered in handwritten notes, half of it wiped clean.",
  }),

  node("g-ppl-1", "th-people", "open-question", "Who is supposed to own a call-back once the shift ends?", {
    choices: ["The vet who promised it", "Whoever is on the evening desk", "Nobody — it is on the board"],
  }),
  node("g-ppl-2", "th-people", "assumption", "The receptionist is already the informal handover system", {
    detail:
      "She remembers what the board does not, which is why nobody has felt the gap as a system problem yet.",
    status: "answered",
  }),

  // The longest run, and the one carrying the diagram.
  node("g-shape-1", "th-shape", "approach", "A handover list that survives the shift boundary", {
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
  }),
  node("g-shape-2", "th-shape", "risk", "A second screen nobody looks at during a busy consult", {
    detail: "The whiteboard's one real virtue is that it is in the room and always visible.",
    status: "answered",
  }),
  node("g-shape-3", "th-shape", "open-question", "Does this replace the whiteboard or sit beside it?"),
  node("g-shape-4", "th-shape", "slice", "Call-backs only, for one week, on paper", {
    detail:
      "If a named owner and an explicit close fixes call-backs on paper, the software is worth building.",
    status: "answered",
  }),
];

/** Twelve themes, the palette stress case. The golden angle's whole promise is
 *  that theme 11 is as distinguishable from theme 10 as theme 1 was from theme
 *  0 — a promise a fixed palette cannot make and this frame is where it is
 *  actually checked by eye. */
const MANY_THEMES: GalaxyTheme[] = [
  "What actually gets lost",
  "Who is holding it",
  "What it could be",
  "How it fails today",
  "What good looks like",
  "Money",
  "Regulation",
  "The receptionist",
  "Out-of-hours",
  "Owners",
  "The building",
  "What we are not doing",
].map((label, i) => theme(`th-${i}`, label, i));

const MANY_NODES: GalaxyNodeInput[] = [
  node("m-idea", null, "idea", "Handover between shifts at a small veterinary practice", {
    status: "answered",
  }),
  ...MANY_THEMES.flatMap((t, i) => [
    node(`m-${i}-a`, t.id, "open-question", `What matters most about ${t.label.toLowerCase()}?`),
    node(`m-${i}-b`, t.id, "assumption", `Something is already true here`, {
      status: "answered",
      detail: "Held loosely until somebody checks it.",
    }),
  ]),
];

const scenarios: Record<
  string,
  {
    themes: GalaxyTheme[];
    nodes: GalaxyNodeInput[];
    attachments?: { name: string }[];
    seedIdea?: string;
  }
> = {
  // The ordinary worked board: the fan, three runs of unequal length, a wide
  // reference card and a wide diagram card, and the conclusion clear of the
  // longest run.
  Default: {
    themes: THEMES,
    nodes: NODES,
    attachments: [{ name: "shift-handover-notes.pdf" }, { name: "whiteboard-photo.jpg" }],
  },

  // A first-time board: the core card alone, no themes at all. The attachment
  // browser and the arrow are the only things to do, which is the point — this
  // is what someone sees the moment after they type an idea, and it must not
  // look like a broken board.
  FirstTime: {
    themes: [],
    nodes: [
      node("f-idea", null, "idea", "Handover between shifts at a small veterinary practice", {
        status: "answered",
      }),
    ],
    attachments: [],
  },

  // A theme with no cards yet is a line of thinking that has not produced
  // questions, not an absent one — so it still gets a hub.
  EmptyTheme: {
    themes: THEMES,
    nodes: NODES.filter((n) => n.themeId !== "th-people"),
  },

  // Twelve themes: the palette stress case.
  ManyThemes: { themes: MANY_THEMES, nodes: MANY_NODES },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  // Held so answering and choosing are genuinely wired up rather than dropped
  // on the floor.
  const [last, setLast] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The board sizes itself to its container and sets its own dark ground, so
  // the harness only has to give it the viewport it would have in the app.
  return (
    <div id="codeyam-capture" style={{ height: "100vh", width: "100%" }}>
      <Component
        seedIdea={scenario.seedIdea ?? SEED_IDEA}
        mapId="map-galaxy"
        attachments={scenario.attachments}
        themes={scenario.themes}
        nodes={scenario.nodes}
        onAnswer={(card, answer) => setLast(`${card.label} → ${answer}`)}
        onChoose={setLast}
      />
      {last ? (
        <div className="absolute left-3 top-3 z-50 text-[12px] text-white/40">
          {last}
        </div>
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

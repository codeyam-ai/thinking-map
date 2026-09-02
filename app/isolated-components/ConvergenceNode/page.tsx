"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component, { type ConvergenceState } from "../../components/ConvergenceNode";

// Where the lines of thinking come back together.
//
// A client harness because the ready state takes an `onChoose` callback, and a
// function cannot cross the server/client boundary as a prop.
//
// The three states are a sequence, not variants: nothing has been answered yet,
// the partner is reading what was answered, and the partner has something to
// say. The middle one exists so the wait does not look like a stall.

const scenarios: Record<string, { state: ConvergenceState; hue?: number }> = {
  // Nothing to conclude yet. Every board opens here, so it must read as "not
  // yet" rather than as an empty slot or a failure.
  Waiting: { state: { kind: 'waiting' } },

  // The partner is reading the round. The label cycles, which is what keeps a
  // wait from looking like a stall — the alternative is a spinner that says
  // nothing about what is happening.
  Composing: { state: { kind: 'composing' } },

  // A conclusion has been reached, with ways forward attached. Choosing one is
  // not answering: nothing on the map is being closed, a direction is being
  // taken, and what the partner does next depends on which.
  Ready: {
    state: {
      kind: 'ready',
      label: 'The whiteboard is a symptom of an ownership gap',
      detail:
        'Nothing is lost while it is on the board. Things are lost at the moment the board is wiped and nobody is carrying them.',
      choices: [
        'Test a named owner on paper for a week',
        'Look at the evening shift first',
        'Something else',
      ],
    },
  },

  // A conclusion with no options. The partner named a direction but is not
  // offering routes — the thinking can still continue by other means, and the
  // absence must not render as an empty row where buttons would have been.
  ReadyNoChoices: {
    state: {
      kind: 'ready',
      label: 'The whiteboard is a symptom of an ownership gap',
      detail: 'Things are lost at the moment nobody is carrying them.',
      choices: null,
    },
  },

  // A conclusion with no supporting detail: the claim alone has to stand on
  // its own line without the layout collapsing around the missing paragraph.
  ReadyNoDetail: {
    state: {
      kind: 'ready',
      label: 'Start with call-backs, not with software',
      detail: null,
      choices: ['Try it on paper'],
    },
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Waiting";
  const scenario = scenarios[s];
  const [chosen, setChosen] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // It sits at the far right of the board's dark canvas, so the harness
  // supplies that ground rather than the page's default white.
  //
  // The caption is the HARNESS naming which state is on show, not something
  // the component renders. It earns its place twice over on `Waiting`, which
  // is deliberately nothing but an empty dashed ring — correct on a board where
  // the rows arriving at it give it its meaning, and unreadable in isolation
  // where they do not. It is also what the capture's blank-page check finds:
  // a bordered div with no text, image or SVG reads to that heuristic as an
  // empty page.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-6 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      {/* Each state positions itself around ITS parent's origin and they do not
          agree on where that leaves them: the waiting ring is a 132px circle
          centred on it, the ready panel runs from 40px left of it to 440px
          right. So the origin is placed with room on both sides rather than
          centred, and the box is sized to contain the widest state — centring
          would put the ready panel half outside the frame. */}
      <div style={{ position: "relative", width: 620, height: 420 }}>
        <div style={{ position: "absolute", left: 90, top: "50%" }}>
          <Component {...scenario} onChoose={setChosen} />
        </div>
      </div>
      {chosen ? (
        <div className="mt-3 text-[12px] text-white/50">chose: {chosen}</div>
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

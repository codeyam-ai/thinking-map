"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component, { type RoundPhase } from "../../components/RoundControl";

// The control that ends a round.
//
// A client harness because it takes an `onNext` callback, and a function cannot
// cross the server/client boundary as a prop.
//
// It rides inside the chat rather than standing alone, and only appears once
// there is a round to end — so what these scenarios vary is the two things it
// reports: how much is still open, and whether the partner is already working.

const scenarios: Record<
  string,
  {
    open: number;
    answered: number;
    phase: RoundPhase;
    /** Seconds left before the round ends on its own. Absent on every state
     *  where nothing is counting, which is most of them. */
    countdown?: number;
  }
> = {
  // Mid-round: some answered, some still open. The count is the whole message —
  // it says how much of this round is left without anyone counting cards.
  Default: { open: 3, answered: 2, phase: "idle" },

  // Nothing answered yet. The round has been asked but not started, which must
  // read differently from a round that is nearly done.
  NothingAnswered: { open: 3, answered: 0, phase: "idle" },

  // Everything answered — the state that has actually earned the next round,
  // and where the control is doing its real job of offering the way on.
  AllAnswered: { open: 0, answered: 5, phase: "idle" },

  // One left. Worth its own frame because a count of one is where singular and
  // plural copy diverges and reads wrong if nobody looked.
  OneLeft: { open: 1, answered: 4, phase: "idle" },

  // Waiting on the partner. Under WebMCP the page cannot ask an agent to hurry
  // and cannot know one is coming, so the wait shows elapsed seconds — a
  // spinner with no number reads the same at two seconds and at forty.
  Waiting: { open: 0, answered: 5, phase: "waiting" },

  // The round ending itself. Set beside AllAnswered — same counts, same phase —
  // it is the whole difference the countdown makes: the resting state offers a
  // way on, this one is already taking it and showing how long you have to
  // object. Three things share the row here where every other state has two,
  // which is why the message is deliberately terser than 'Everything on the
  // board is answered'.
  Countdown: { open: 0, answered: 5, phase: "idle", countdown: 5 },

  // The last second, which is where a shrinking number is most likely to shift
  // the row's width and push the primary out of reach — the tabular figures
  // exist so it does not.
  CountdownFinalSecond: { open: 0, answered: 5, phase: "idle", countdown: 1 },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  const [advanced, setAdvanced] = useState(false);
  const [held, setHeld] = useState(false);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // It sits on the chat's dark bar, so the harness supplies that ground rather
  // than the page's white — on white it reads as a different control.
  return (
    <div id="codeyam-capture" style={{ background: "#0a0a0b", padding: 28 }}>
      {/* The same box BoardChat gives it: centred and gapped, not just
          right-aligned. Without `alignItems` the countdown state — the only one
          with three items of differing height in the row — captures with its
          cancel sitting low, which would make a harness artifact look like a
          fault in the control. */}
      <div
        style={{
          width: 560,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Component
          {...scenario}
          countdown={held ? null : (scenario.countdown ?? null)}
          onNext={() => setAdvanced(true)}
          onCancel={() => setHeld(true)}
        />
      </div>
      {advanced ? (
        <div className="mt-2 text-[12px] text-white/45">next round asked for</div>
      ) : null}
      {held ? (
        <div className="mt-2 text-[12px] text-white/45">round held open</div>
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

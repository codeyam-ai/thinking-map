"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AnswerComposer";

// A client harness rather than a server page: the composer takes callbacks, and
// a function cannot cross the server/client boundary as a prop.
//
// What the scenarios below are for is the pair of controls. A keyboard hint
// alone left no visible way to commit an answer or to change your mind, which
// is exactly what someone is deciding at this moment.

const MAGENTA = "hsl(318 74% 66%)";

const scenarios: Record<
  string,
  {
    initial: string;
    cancellable: boolean;
    placeholder: string;
    light: boolean;
    accent: string;
    /** Whether there is somewhere to move on to without answering. */
    skippable?: boolean;
    /** Sitting under a shortlist, giving up its height to the options. */
    compact?: boolean;
    /** Options taken with nothing typed — a complete answer the field alone
     *  cannot see, which is why Save takes its verdict from outside. */
    canSubmit?: boolean;
  }
> = {
  // Reached past a shortlist. Cancel goes back to the options, and Save is
  // disabled until there is something to save — an empty answer would close
  // the question against a blank.
  Default: {
    initial: "",
    cancellable: true,
    placeholder: "Say it in your own words…",
    light: true,
    accent: MAGENTA,
  },

  // With words in it, which is when Save becomes solid and reads as the
  // primary action rather than as a disabled shape.
  Typed: {
    initial:
      "It is the call-backs, but only the ones promised after four in the afternoon.",
    cancellable: true,
    placeholder: "Say it in your own words…",
    light: true,
    accent: MAGENTA,
  },

  // A card with no shortlist: this box IS the affordance, so it is open on
  // arrival and there is nothing to cancel back to. A Cancel here would be a
  // control that does nothing.
  NothingToCancel: {
    initial: "",
    cancellable: false,
    placeholder: "Answer here",
    light: true,
    accent: MAGENTA,
  },

  // Amending an answer through the pencil, on the near-black surface an
  // answered card has. Pre-filled, because the pencil is for changing what you
  // said rather than for retyping it.
  EditingOnDark: {
    initial: "Owner call-backs.",
    cancellable: true,
    placeholder: "Say it in your own words…",
    light: false,
    accent: MAGENTA,
  },

  // A long answer, which is exactly what someone reaching past a list of
  // guesses is likely to be writing — the reason the box fills the card.
  LongAnswer: {
    initial:
      "The re-checks we catch the next morning because the dog is still on the board. A missed call-back nobody catches at all — we hear about it three weeks later in a review, and by then the owner has gone somewhere else.",
    cancellable: true,
    placeholder: "Say it in your own words…",
    light: true,
    accent: MAGENTA,
  },

  // Under a shortlist, which is where this box now lives on any card that has
  // one. Compact, because the options above it need the card's spare room —
  // two regions both claiming it is what overflowed the card when the two were
  // first put together. Save is live on options alone, so it takes its verdict
  // from outside the field.
  UnderAShortlist: {
    initial: "",
    cancellable: false,
    placeholder: "Add anything the options miss…",
    light: true,
    accent: MAGENTA,
    compact: true,
    canSubmit: true,
    skippable: true,
  },

  // Not answering is a real answer to give. "I don't know yet" is a position,
  // and a board that only lets you proceed by answering turns it into a
  // made-up answer the partner cannot tell from a real one.
  Skippable: {
    initial: "",
    cancellable: false,
    placeholder: "Answer here",
    light: true,
    accent: MAGENTA,
    skippable: true,
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  const [value, setValue] = useState(scenario?.initial ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The composer fills whatever the card has left, so the harness supplies a
  // card-sized box — its height is what makes "fills the card" mean anything.
  return (
    <div
      id="codeyam-capture"
      style={{ background: scenario.light ? "#e256b4" : "#141416", padding: 28 }}
    >
      <div
        style={{
          width: 300,
          height: 250,
          display: "flex",
          flexDirection: "column",
          color: scenario.light ? "#000" : "#fff",
        }}
      >
        <Component
          value={value}
          onChange={setValue}
          onSubmit={() => setSaved(value)}
          onCancel={scenario.cancellable ? () => setValue("") : null}
          onSkip={scenario.skippable ? () => setSaved("skipped") : null}
          placeholder={scenario.placeholder}
          autoFocus={false}
          onFieldFocus={() => {}}
          light={scenario.light}
          accent={scenario.accent}
          canSubmit={scenario.canSubmit}
          compact={scenario.compact}
        />
      </div>
      {saved ? (
        <div className="mt-2 text-[12px] opacity-60">saved: {saved}</div>
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

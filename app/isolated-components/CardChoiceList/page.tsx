"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/CardChoiceList";

// A client harness rather than a server page: the list takes callbacks, and a
// function cannot cross the server/client boundary as a prop.
//
// The thing this component must always do is visible in every scenario below:
// the options TOGGLE, so more than one can be taken. They used to submit on
// click, which made the shortlist a cage — one option, or reject the lot.

const scenarios: Record<
  string,
  { choices: string[]; light: boolean; picked?: string[] }
> = {
  // The ordinary shortlist on an open card, which is saturated in the theme
  // colour and so takes dark text and solid white pills.
  Default: {
    choices: ["Owner call-backs", "Re-checks", "Lab results to chase"],
    light: true,
  },

  // More options than the card is tall. The list scrolls and the way past it
  // stays pinned — clipping instead would take the escape hatch with it, which
  // is the one control that must never be what falls off the bottom.
  Overflowing: {
    choices: [
      "Owner call-backs",
      "Re-checks",
      "Lab results to chase",
      "Medication changes",
      "Referrals",
      "Repeat prescriptions",
    ],
    light: true,
  },

  // One suggestion is a legitimate shortlist. It must not read as a submit
  // button, which is why the way past it is right underneath in a different
  // shape.
  Single: { choices: ["Owner call-backs"], light: true },

  // Options long enough to wrap, which is the shape a real question produces.
  LongOptions: {
    choices: [
      "During the verbal handover at the end of the shift",
      "After handover, once the task is somebody else's",
      "It was never written down at all",
    ],
    light: true,
  },

  // On the near-black surface of a card being amended, where the pills are
  // translucent white instead of solid.
  OnDarkCard: {
    choices: ["Owner call-backs", "Re-checks"],
    light: false,
  },

  // The state the whole change exists for: TWO options taken at once. A taken
  // option is filled and an untaken one outlined, so the set someone has built
  // reads at a glance rather than having to be counted.
  SeveralTaken: {
    choices: [
      "Owner call-backs",
      "Re-checks",
      "Lab results to chase",
      "Medication changes",
    ],
    light: true,
    picked: ["Owner call-backs", "Lab results to chase"],
  },

  // Taken options on the dark surface, where filled means white-on-near-black
  // rather than ink-on-white. Same rule, opposite ground.
  TakenOnDarkCard: {
    choices: ["Owner call-backs", "Re-checks", "Lab results to chase"],
    light: false,
    picked: ["Re-checks"],
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  // Held so toggling is genuinely wired up rather than dropped on the floor,
  // and seeded from the scenario so a capture can show options already taken.
  const [picked, setPicked] = useState<string[]>(scenario?.picked ?? []);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The list lives inside a card, so the harness supplies the card's ground and
  // the height it actually has — the scrolling behaviour is only visible
  // against a real bound.
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
          choices={scenario.choices}
          picked={picked}
          light={scenario.light}
          onToggle={(choice) =>
            setPicked((p) =>
              p.includes(choice) ? p.filter((c) => c !== choice) : [...p, choice],
            )
          }
        />
      </div>
      {picked.length > 0 ? (
        <div className="mt-2 text-[12px] opacity-60">
          taken: {picked.join(", ")}
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

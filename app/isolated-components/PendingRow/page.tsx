import Component from "../../../app/components/PendingRow";
import { settledNote } from "../../../app/lib/pendingRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The row the map reaches for before it has one. The shimmer is a promise the
// page cannot keep on its own — WebMCP is pull-only — so the states that matter
// here are the bounded shimmer and each of the three honest things it can
// resolve into.
//
// The settled copy comes from `settledNote` rather than being retyped: these
// fixtures exist to prove the real sentences render, and a hand-copy would let
// them keep passing while the product said something else.
const scenarios: Record<string, Props> = {
  // Answers just went in and the map is reaching for the next round. This is
  // the state the whole feature exists to produce.
  Waiting: { state: { kind: "waiting" } },

  // The state every preview and capture genuinely produces, and the one most at
  // risk of being quietly dressed up as one of the other two.
  SettledNoAgent: {
    state: { kind: "settled", note: settledNote("unavailable") },
  },

  // An agent whose turn is running: the only case where "has everything you
  // have added" is a true statement rather than a hopeful one.
  SettledAgentWorking: {
    state: { kind: "settled", note: settledNote("working") },
  },

  // Attached but idle — it will see what is there when its turn comes round,
  // which is deliberately a weaker claim than the one above.
  SettledAgentIdle: {
    state: { kind: "settled", note: settledNote("connected") },
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Waiting" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Width AND background both read from the real usage site: this row sits
  // inside the map's white surface card, and the placeholders are paper-coloured
  // precisely so the page shows through them. On the default paper backdrop that
  // contrast disappears and the band reads as invisible rather than as pending.
  return (
    <div id="codeyam-capture">
      <div
        style={{
          width: "100%",
          maxWidth: 930,
          background: "var(--surface)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <Component {...props} />
      </div>
    </div>
  );
}

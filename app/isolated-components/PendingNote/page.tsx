import Component from "../../../app/components/PendingNote";
import { settledNote } from "../../../app/lib/pendingRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The sentence the shimmer resolves into. Three scenarios because the three
// sentences are three genuinely different claims about who can hear the log, and
// the whole point of bounding the shimmer was to make that distinction sayable.
//
// The copy comes from `settledNote` rather than being retyped here. These
// fixtures exist to prove the real sentences render; a hand-copy would let them
// keep passing while the product said something else.
const scenarios: Record<string, Props> = {
  // The honest half, and the state a preview actually produces.
  NoAgent: { note: settledNote("unavailable") },

  // The only case where what you added has genuinely reached someone.
  AgentWorking: { note: settledNote("working") },

  // Attached, but its turn is not running — a weaker claim, deliberately phrased
  // as one.
  AgentIdle: { note: settledNote("connected") },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "NoAgent" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}

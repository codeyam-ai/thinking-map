import Component from "../../components/InsightStackEmpty";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The far end of the board before the partner has written anything.
//
// The marker is a promise the page cannot keep on its own — WebMCP is pull-only
// — so the states that matter are the bounded marker and each of the three
// honest things it resolves into. Exactly the shape `PendingRow`'s fixture
// takes, and for the same reason: the sentences come out of `settledNote` in
// the component itself rather than being retyped here, so a fixture cannot keep
// passing while the product says something else.

const scenarios: Record<string, Props> = {
  // Every board opens here, and stays here for as long as it takes an agent to
  // write something. It has to read as a place waiting to be filled.
  Waiting: { settled: false, status: "unavailable" },

  // The marker's time is up and nobody is attached — the state every preview
  // and capture genuinely produces, and the one most at risk of being quietly
  // dressed up as one of the other two.
  SettledNoAgent: { settled: true, status: "unavailable" },

  // Attached but not in a turn: it will see the board when its turn comes
  // round, which is deliberately a weaker claim than the one below.
  SettledAgentIdle: { settled: true, status: "connected" },

  // A turn is running right now, so "has everything you have added" is a true
  // statement here rather than a hopeful one.
  SettledAgentWorking: { settled: true, status: "working" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Waiting" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // Width and ground both read from the real usage site: this sits in the
  // stack's own 460px column, on the board's near-black plane. On the page's
  // default paper the white-on-black copy would be invisible.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 460 }}>
        <Component {...props} />
      </div>
    </div>
  );
}

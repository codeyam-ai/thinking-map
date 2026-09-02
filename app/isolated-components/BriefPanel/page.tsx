import Component from "../../components/BriefPanel";
import BridgeFixture from "../BridgeFixture";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const section = (
  id: string,
  heading: string,
  charCount: number,
  nodeCount: number,
) => ({ id, heading, charCount, nodeCount, nodes: [], isEmpty: charCount === 0 });

// The sections of a real brief — the Northgate spec the app's own scenario is
// seeded from — so the panel is read against a document someone could actually
// have sent, rather than eight rows of Lorem.
const NORTHGATE = [
  section("s1", "Northgate Library — Digital Membership Renewal", 0, 0),
  section("s2", "Background", 429, 1),
  section("s3", "Who this is for", 453, 1),
  section("s4", "What we think we need", 323, 0),
  section("s5", "Residency verification", 347, 2),
  section("s6", "Constraints", 303, 0),
  section("s7", "What success looks like", 273, 0),
  section("s8", "Out of scope", 73, 0),
];

const covered = (sections: ReturnType<typeof section>[]) =>
  sections.filter((s) => !s.isEmpty || s.nodeCount > 0);

const coverage = (sections: ReturnType<typeof section>[]) => {
  const accountable = covered(sections);
  const untouched = accountable.filter((s) => s.nodeCount === 0);
  return {
    sections,
    untouched,
    covered: accountable.length - untouched.length,
    total: accountable.length,
    untouchedCharCount: untouched.reduce((sum, s) => sum + s.charCount, 0),
    dangling: [],
  };
};

// The panel exists for the untouched half, so these span the range from "the
// agent has barely started" to the one state a client is meant to see before
// they approve anything.
const scenarios: Record<string, Props> = {
  // Mid-deconstruction: roughly half the brief accounted for, the untouched
  // sections carrying the ink and the covered ones receding.
  MidDeconstruction: {
    sourceName: "northgate-renewal-brief.pdf",
    coverage: coverage(NORTHGATE),
  },
  // Day one — a brief just attached and nothing citing any of it. The honest
  // picture rather than an empty component.
  NothingCitedYet: {
    sourceName: "northgate-renewal-brief.pdf",
    coverage: coverage(NORTHGATE.map((s) => ({ ...s, nodeCount: 0 }))),
  },
  // Every section accounted for. The headline inverts, and this is the state
  // that is actually worth showing a client.
  FullyAccountedFor: {
    sourceName: "northgate-renewal-brief.pdf",
    coverage: coverage(
      NORTHGATE.map((s) => (s.isEmpty ? s : { ...s, nodeCount: 2 })),
    ),
  },
  // A node citing a section this brief does not have — surfaced under the list
  // rather than silently dropped, which would let the tally overstate itself.
  DanglingReference: {
    sourceName: "northgate-renewal-brief.pdf",
    coverage: {
      ...coverage(NORTHGATE),
      dangling: [
        {
          sourceRef: "s11",
          nodes: [
            {
              id: "n1",
              kind: "finding",
              label: "Renewal window is 24 months",
              sourceRef: "s11",
            },
          ],
        },
      ],
    },
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // The panel sets its own 276px width, so no wrapper. It reads the bridge to
  // send an untouched-section note, so it needs one mounted even at rest.
  return (
    <div id="codeyam-capture">
      <BridgeFixture status="connected" revision={7}>
        <Component {...props} />
      </BridgeFixture>
    </div>
  );
}

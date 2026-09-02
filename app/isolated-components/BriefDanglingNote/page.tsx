import Component from "../../../app/components/BriefDanglingNote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// A citation pointing at a section the brief does not have. Rare, and reported
// rather than swallowed — a dropped citation would let the accounted-for count
// overstate itself, which is the one failure the whole panel exists to prevent.
const scenarios: Record<string, Props> = {
  // The singular case, which reads as its own sentence rather than a list.
  OneDangling: {
    dangling: [
      {
        sourceRef: "s9",
        nodes: [
          {
            id: "n1",
            kind: "finding",
            label: "Renewal window is 24 months",
            sourceRef: "s9",
          },
        ],
      },
    ],
  },
  // Several — usually a brief replaced by a shorter one, so every id past its
  // new end dangles at once.
  SeveralDangling: {
    dangling: [
      {
        sourceRef: "s9",
        nodes: [
          { id: "n1", kind: "finding", label: "Renewal window", sourceRef: "s9" },
        ],
      },
      {
        sourceRef: "s11",
        nodes: [
          { id: "n2", kind: "risk", label: "Board timing", sourceRef: "s11" },
          { id: "n3", kind: "constraint", label: "Budget cycle", sourceRef: "s11" },
        ],
      },
    ],
  },
  // No `None` scenario on purpose. The ordinary case renders nothing at all —
  // a healthy map should not pay for this in vertical space — so there is no
  // frame to capture, and a scenario with no artifact is a ghost. That state is
  // demonstrated where it actually reads: the BriefPanel scenarios, which show
  // the panel with no dangling note under the list.
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
  // 232px — the content width inside BriefPanel's 276px rail, less its padding.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 232 }}>
        <Component {...props} />
      </div>
    </div>
  );
}

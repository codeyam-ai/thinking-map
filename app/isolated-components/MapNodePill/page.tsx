"use client";

// A client harness, because the fold states need callback props and a function
// cannot cross the server-component boundary.

import { Suspense, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/MapNodePill";

type Props = ComponentProps<typeof Component>;

// One per treatment in the design system's status-precedence rule, so the
// whole visual vocabulary of the map is documented in one place.
const scenarios: Record<string, Props> = {
  Default: { node: { id: "n", parentId: null, kind: "problem", label: "Vocabulary", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  RootIdea: { node: { id: "n", parentId: null, kind: "idea", label: "Educational game for kids", detail: null, status: "answered", sourceUrl: null, origin: "user", depth: 0, x: 0, y: 0, width: 288, height: 62 } },
  OpenQuestion: { node: { id: "n", parentId: null, kind: "open-question", label: "Who is it for?", detail: null, status: "open", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  JustUpdated: { node: { id: "n", parentId: null, kind: "user", label: "For: Teachers", detail: null, status: "updated", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  Research: { node: { id: "n", parentId: null, kind: "research", label: "3 existing apps found", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  Risk: { node: { id: "n", parentId: null, kind: "risk", label: "Another tool to learn", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  Pro: { node: { id: "n", parentId: null, kind: "pro", label: "Reuses existing rapport", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  Gap: { node: { id: "n", parentId: null, kind: "gap", label: "No parent involvement", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 220, height: 56 } },
  // The map is co-authored now, so a node the person wrote says so in its
  // eyebrow — the same fact the tools read to avoid re-ingesting their own writes.
  Yours: { node: { id: "n", parentId: null, kind: "goal", label: "Refind a half-remembered idea", detail: null, status: "answered", sourceUrl: null, origin: "user", depth: 1, x: 0, y: 0, width: 240, height: 56 } },
  // Something has already been asked about this node. The mark sits in the
  // eyebrow beside the other two facts about the node, because it is
  // provenance — who has said what about it — not status.
  Asked: { node: { id: "n", parentId: null, kind: "approach", label: "Capture the thought, not the book", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 260, height: 56 }, asked: true },
  // Both marks at once: a node the person wrote AND has since asked about, so
  // the eyebrow has to stay readable when it is carrying everything it can.
  YoursAndAsked: { node: { id: "n", parentId: null, kind: "goal", label: "Refind a half-remembered idea", detail: null, status: "answered", sourceUrl: null, origin: "user", depth: 1, x: 0, y: 0, width: 260, height: 56 }, asked: true },
  // A claim that came from one identifiable part of the client's brief. The
  // section mark is the fourth thing the eyebrow can carry and goes last,
  // because it is the only one of them about the DOCUMENT rather than the node.
  FromBriefSection: { node: { id: "n", parentId: null, kind: "problem", label: "3,400 lapsed rather than make the trip", detail: null, status: "answered", sourceUrl: null, sourceRef: "s2", origin: "agent", depth: 1, x: 0, y: 0, width: 268, height: 56 } },
  // The eyebrow carrying everything at once: written by the person, asked
  // about, and traced to a section. This is the crowded case that decides
  // whether the marks stay readable or turn into a run-on.
  YoursAskedAndFromBrief: { node: { id: "n", parentId: null, kind: "goal", label: "One place to plan a term", detail: null, status: "answered", sourceUrl: null, sourceRef: "s12", origin: "user", depth: 1, x: 0, y: 0, width: 268, height: 56 }, asked: true },
  // A node with a branch under it: the fold control sits on the bottom edge,
  // where the branch leaves the pill.
  Foldable: { node: { id: "n", parentId: null, kind: "research", label: "7 existing tools found", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 240, height: 56 }, hiddenCount: 5 },
  // Folded, the control reports what it is holding — and the pill's own status
  // treatment is untouched, which is the rule nodeShellClasses owns.
  Folded: { node: { id: "n", parentId: null, kind: "research", label: "7 existing tools found", detail: null, status: "answered", sourceUrl: null, origin: "agent", depth: 1, x: 0, y: 0, width: 240, height: 56 }, collapsed: true, hiddenCount: 5 },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const props = scenarios[s];
  const [collapsed, setCollapsed] = useState(props?.collapsed ?? false);
  if (!props) return <div>Unknown scenario: {s}</div>;

  // Only the fold scenarios take a toggle — the rest are the pure status
  // treatments, and giving them a control they never have in context would
  // document a pill that does not exist.
  const foldProps =
    props.hiddenCount === undefined
      ? {}
      : { collapsed, onToggleCollapse: () => setCollapsed((c) => !c) };

  // The pill positions itself absolutely inside the map plane, so the host
  // reproduces a plane of the right size rather than letting it collapse.
  return (
    <div id="codeyam-capture">
      <div
        className="relative"
        style={{ width: props.node.width, height: props.node.height + 24 }}
      >
        <Component {...props} {...foldProps} />
      </div>
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

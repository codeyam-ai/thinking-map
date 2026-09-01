import Component from "../../components/MapNodePill";
import type { ComponentProps } from "react";

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
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The pill positions itself absolutely inside the map plane, so the host
  // reproduces a plane of the right size rather than letting it collapse.
  return (
    <div id="codeyam-capture">
      <div
        className="relative"
        style={{ width: props.node.width, height: props.node.height + 24 }}
      >
        <Component {...props} />
      </div>
    </div>
  );
}

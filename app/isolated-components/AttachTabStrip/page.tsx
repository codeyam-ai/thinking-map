"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AttachTabStrip";
import type { HandoffAttachTab } from "../../lib/handoffCopy";

// The row of three labels that choose which way in is on screen.
//
// Worth capturing on its own because the strip carries a claim the panel below
// it cannot make: which route you are currently looking at. That is expressed
// purely as weight and an underline, so a frame per selected tab is the only
// place "the active one is legible as active" is either true or not.
//
// A client harness rather than a props map, following ContributionTabs: this
// component is controlled and takes an `onSelect` callback, which a server
// page cannot hand it.
const TABS: readonly HandoffAttachTab[] = [
  { id: "browser", label: "MCP-enabled browser", body: "" },
  { id: "agent", label: "Any agent", body: "" },
  { id: "claude", label: "Claude Code", body: "" },
];

const START: Record<string, HandoffAttachTab["id"]> = {
  // The tab the band opens on — the only route that works for every reader.
  Default: "agent",
  // First position selected, where the active underline sits against the
  // strip's left edge and has the least around it to read as active.
  BrowserSelected: "browser",
  // Last position, and the longest single-word label — the end of the row is
  // where a selected tab is most at risk of looking like an overflow.
  ClaudeSelected: "claude",
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const initial = START[s];
  const [activeId, setActiveId] = useState<HandoffAttachTab["id"]>(
    initial ?? "agent",
  );
  if (!initial) return <div>Unknown scenario: {s}</div>;
  return (
    // Full-width surface: the strip spans the footnote group, which spans the
    // whole band between the header and the workspace.
    <div id="codeyam-capture">
      <Component tabs={TABS} activeId={activeId} onSelect={setActiveId} />
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

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AgentPanelLauncher";

// The collapsed dev panel: present enough to find, quiet enough to ignore. It
// is fixed to the viewport corner, so the capture keeps a full-height frame
// rather than shrink-wrapping it out of position.
function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const [opened, setOpened] = useState(false);
  if (s !== "Default") return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      {/* The launcher pins itself to the VIEWPORT corner. A transform makes
          this wrapper the containing block for fixed children, so it anchors
          to the frame — the same corner placement, actually in shot. */}
      <div
        style={{
          width: 320,
          height: 180,
          position: "relative",
          transform: "translateZ(0)",
        }}
      >
        <Component onOpen={() => setOpened(true)} />
        <p className="sr-only">{opened ? "opened" : "closed"}</p>
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

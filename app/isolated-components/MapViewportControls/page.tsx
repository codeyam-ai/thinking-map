"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/MapViewportControls";

// The cluster is absolutely positioned over the bottom-right of the map panel,
// so the fixture reproduces that panel rather than floating the controls in an
// empty page — where "bottom right of what?" would be unanswerable.
const START: Record<string, { scale: number; isCustom: boolean }> = {
  // How the map opens: the automatic fit, with nothing to reset yet.
  AutoFit: { scale: 0.62, isCustom: false },
  // The person has taken the viewport, so Fit becomes live.
  ZoomedIn: { scale: 1.36, isCustom: true },
  // Zoomed out past the fit to see a sprawling map whole.
  ZoomedOut: { scale: 0.4, isCustom: true },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "AutoFit";
  const start = START[s];
  const [scale, setScale] = useState(start?.scale ?? 0.62);
  const [isCustom, setIsCustom] = useState(start?.isCustom ?? false);
  if (!start) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      {/* The map panel it lives in: same surface, border and radius. The width
          is the panel's real one beside the exchange column on a Desktop
          viewport — the cluster is pinned to a corner, so a shrink-wrapped
          box would put it somewhere the person never sees it. */}
      <div
        className="relative rounded-[20px] border border-line bg-surface p-6"
        style={{ width: 880, height: 320 }}
      >
        <span className="eyebrow">Live map</span>
        <Component
          scale={scale}
          isCustom={isCustom}
          onZoomIn={() => {
            setScale((current) => current * 1.3);
            setIsCustom(true);
          }}
          onZoomOut={() => {
            setScale((current) => current / 1.3);
            setIsCustom(true);
          }}
          onFit={() => {
            setScale(start.scale);
            setIsCustom(false);
          }}
        />
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

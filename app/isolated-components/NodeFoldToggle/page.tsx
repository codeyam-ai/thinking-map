"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/NodeFoldToggle";

// The toggle straddles a node pill's bottom edge, where the branch leaves it,
// so the fixture carries a real pill for it to sit on — on its own it would be
// a floating badge with nothing to explain its offset.
const START: Record<string, { label: string; collapsed: boolean; hiddenCount: number }> = {
  // Unfolded: the control says what it will do, not what it is hiding.
  Default: { label: "The actual problem", collapsed: false, hiddenCount: 3 },
  // Folded: it reports the cost, which is what tells you whether to reopen it.
  Folded: { label: "The actual problem", collapsed: true, hiddenCount: 3 },
  // A whole phase of thinking folded away — the count is wide enough here to
  // prove the pill grows rather than clipping the number.
  LargeBranch: { label: "Possible directions", collapsed: true, hiddenCount: 12 },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const start = START[s];
  const [collapsed, setCollapsed] = useState(start?.collapsed ?? false);
  if (!start) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 268 }}>
        <span className="eyebrow mb-1.5 block truncate pl-1">Problem</span>
        {/* The pill shell, matching what MapNodePill renders around it. */}
        <div className="relative flex h-[56px] items-center justify-center rounded-full border border-ink bg-surface px-4 text-center">
          <span className="line-clamp-2 text-[14px] font-semibold leading-tight">
            {start.label}
          </span>
          <Component
            label={start.label}
            collapsed={collapsed}
            hiddenCount={start.hiddenCount}
            onToggle={() => setCollapsed((current) => !current)}
          />
        </div>
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

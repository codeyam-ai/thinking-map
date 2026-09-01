"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/ReplyForm";

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const preset: Record<string, { value: string; busy: boolean; error: string | null }> = {
    Default: { value: "", busy: false, error: null },
    Busy: { value: "", busy: true, error: null },
    // The error the app actually shows when no model credential is configured.
    WithError: {
      value: "Probably kids around 6 to 8",
      busy: false,
      error:
        "No Anthropic credentials configured. Add ANTHROPIC_API_KEY to .env.local to talk to the thinking partner.",
    },
  };
  const config = preset[s];
  const [value, setValue] = useState(config?.value ?? "");
  if (!config) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div className="rounded-[20px] border border-line bg-surface" style={{ width: 380 }}>
        <Component
          value={value}
          busy={config.busy}
          error={config.error}
          onChange={setValue}
          onSubmit={(e) => e.preventDefault()}
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

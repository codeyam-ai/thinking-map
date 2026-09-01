"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/IdeaForm";

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const preset: Record<string, { value: string; busy: boolean }> = {
    // Empty is the production default - the placeholder carries the invitation.
    Default: { value: "", busy: false },
    Filled: { value: "I want to build an educational game for kids", busy: false },
    // While a map is being created the input locks and the button dims.
    Busy: { value: "I have a startup idea", busy: true },
  };
  const [value, setValue] = useState(preset[s]?.value ?? "");
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 930 }}>
        <Component
          value={value}
          busy={config.busy}
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

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/SuggestionChips";

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const [picked, setPicked] = useState("");
  if (s !== "Default") return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 930 }}>
        <Component onPick={setPicked} />
        <p className="sr-only">{picked}</p>
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

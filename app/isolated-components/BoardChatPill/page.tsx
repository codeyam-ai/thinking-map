"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../../app/components/BoardChatPill";

// A client harness rather than a server page: the pill takes an `onOpen`
// callback, and an event handler cannot be passed from a server component to a
// client one.

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const [opened, setOpened] = useState(false);

  if (s !== "Default") return <div>Unknown scenario: {s}</div>;

  // Against the board's black, at the size it actually occupies in the corner.
  // Judged on white it would look like a button on a page rather than the last
  // trace of a panel over a map.
  return (
    <div id="codeyam-capture" style={{ background: "#0a0a0b", padding: 24 }}>
      <Component onOpen={() => setOpened(true)} />
      {opened ? (
        <div className="pt-2 text-[12px] text-white/40">reopened</div>
      ) : null}
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

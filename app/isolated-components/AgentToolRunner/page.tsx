"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AgentToolRunner";

const TOOLS = [
  { name: "read_map" },
  { name: "add_nodes" },
  { name: "update_node" },
  { name: "set_phase" },
  { name: "post_note" },
  { name: "ask_user" },
  { name: "await_user_activity" },
];

// The by-hand half of the dev panel. The tool list comes from the PUBLISHED
// driver, not a hardcoded array — so what this offers is exactly what is
// bound, and a tool that failed to register would be missing here too.
const scenarios: Record<
  string,
  { tools: { name: string }[]; name: string; input: string; busy: boolean }
> = {
  Default: { tools: TOOLS, name: "read_map", input: "{}", busy: false },
  // A call with real arguments, which is the shape an agent actually sends.
  WithInput: {
    tools: TOOLS,
    name: "post_note",
    input: '{"text":"what I changed and why"}',
    busy: false,
  },
  // Mid-call: Run is disabled so a second call cannot race the first.
  Busy: { tools: TOOLS, name: "ask_user", input: '{"questions":["Why?"]}', busy: true },
  // No driver on the page, so nothing is bound and the select falls back to
  // the current name rather than rendering an empty list.
  NoDriver: { tools: [], name: "read_map", input: "{}", busy: false },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const fixture = scenarios[s];
  const [name, setName] = useState(fixture?.name ?? "read_map");
  const [input, setInput] = useState(fixture?.input ?? "{}");
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 308 }}>
        <Component
          tools={fixture.tools}
          name={name}
          input={input}
          busy={fixture.busy}
          onNameChange={setName}
          onInputChange={setInput}
          onRun={() => {}}
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

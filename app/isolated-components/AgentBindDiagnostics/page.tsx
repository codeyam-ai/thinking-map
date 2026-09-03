import Component from "../../components/AgentBindDiagnostics";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The half of the panel that is only ever for whoever is building this, and
// where the deleted bottom-left dev badge ended up. What it knows that nothing
// else does is which tools the browser REFUSED — the silence this whole feature
// exists to end.
//
// Renders only in development, which is exactly the environment a capture runs
// in, so these scenarios show what a developer actually sees.
const scenarios: Record<string, Props> = {
  // A healthy binding: the current convention, bound to the page, nothing
  // refused. The row a developer should see and move past.
  HealthyBinding: {
    status: "connected",
    channel: "webmcp",
    convention: "registerTool",
    bindFailures: [],
  },
  // The state that had no way to be seen before this existed. Two named tools
  // and the browser's own reason for each — including the DataCloneError that
  // was being thrown from inside Chrome and swallowed by a bare catch.
  RefusedTools: {
    status: "connected",
    channel: "webmcp",
    convention: "registerTool",
    bindFailures: [
      {
        name: "ask_user",
        reason: "DataCloneError: function could not be cloned",
      },
      { name: "await_user_activity", reason: "InvalidStateError" },
    ],
  },
  // The pre-March-2026 convention the @mcp-b/global polyfill still ships. Worth
  // seeing at a glance, because which convention the host offered changes what
  // a failure means.
  OlderConvention: {
    status: "connected",
    channel: "webmcp",
    convention: "provideContext",
    bindFailures: [],
  },
  // Nothing bound at all. Every field reads "none", which is the honest answer
  // rather than a blank row.
  NothingBound: {
    status: "unavailable",
    channel: null,
    convention: null,
    bindFailures: [],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "RefusedTools" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // Sits at the foot of the 300px panel.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 300, padding: 16 }}>
        <Component {...props} />
      </div>
    </div>
  );
}

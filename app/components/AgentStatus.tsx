'use client';

import AgentStatusDot from './AgentStatusDot';
import { useWebMcpBridge } from './WebMcpBridge';

/** What an agent can never reach, and why — the honest version, because this
 *  is the ordinary case rather than an error. */
const UNAVAILABLE_HELP =
  'WebMCP binds only in a top-level, secure page in a browser with an agent (Chrome 146+). The map is fully usable without one — everything you add lands in the log for an agent to read later.';

/**
 * Whether an agent can reach this page, stated plainly.
 *
 * `unavailable` is the ordinary case, not an error: WebMCP is top-level and
 * secure-context only, so a preview iframe, Safari, and any page opened without
 * a browser agent all land here.
 *
 * It sits in the header because agent presence is a fact about the whole page,
 * not about the exchange column it stands beside.
 */
export default function AgentStatus() {
  const { status, reason, tools } = useWebMcpBridge();

  const headline =
    status === 'connected'
      ? `Agent attached · ${tools.length} tools`
      : status === 'working'
        ? 'Agent working…'
        : 'No agent attached';

  return (
    <div
      className="flex items-center gap-2"
      title={status === 'unavailable' ? UNAVAILABLE_HELP : undefined}
    >
      <AgentStatusDot status={status} />
      <span className="text-[12px] font-semibold text-ink">{headline}</span>
      {status === 'unavailable' && reason ? (
        // Hidden under `lg`, where the header has no room for it. Nothing is
        // lost: the `title` above already carries UNAVAILABLE_HELP in full.
        <span className="hidden max-w-[190px] truncate text-[11.5px] text-muted lg:inline">
          — {reason}
        </span>
      ) : null}
      {/* No revision counter here. It is a debugging aid, and beside "No agent
          attached" it reads as a build tag on an error. The log it counts is
          already visible in BoardChat; `BridgeReadout` keeps its own display,
          where a raw revision is the point rather than an intrusion. */}
    </div>
  );
}

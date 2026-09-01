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
  const { status, reason, tools, revision } = useWebMcpBridge();

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
        <span className="max-w-[190px] truncate text-[11.5px] text-muted">
          — {reason}
        </span>
      ) : null}
      {revision !== null ? (
        <span className="text-[11px] text-muted">r{revision}</span>
      ) : null}
    </div>
  );
}

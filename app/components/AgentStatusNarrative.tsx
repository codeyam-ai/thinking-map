// What agent presence MEANS on this page, in prose.
//
// Split out of `AgentStatusPanel` because it is the only part carrying wording,
// and the wording is the interface here: the difference between "it can ask you
// questions" and "anything you add waits in the log" is the entire practical
// difference between the two doors, stated to someone who has never heard of
// either. Keeping it behind one name is what lets a test pin that.

import type { AgentChannel } from '@/app/lib/agentPresence';
import type { BridgeStatus } from './WebMcpBridge';

const CHANNEL_HEADLINE: Record<AgentChannel, string> = {
  webmcp: 'Bound to this page',
  mcp: 'Working over the MCP server',
};

const CHANNEL_DETAIL: Record<AgentChannel, string> = {
  // The distinction that matters to a person: only a bound page can put a
  // question in front of them and wait for the answer.
  webmcp:
    'The agent found this page’s tools in the browser. It can read the map, write to it, and ask you questions here.',
  mcp: 'The agent is reaching this map over HTTP rather than through the browser. It can read and write the map, but it cannot raise a question on this page — anything you add waits in the log for its next read.',
};

const UNAVAILABLE_HELP =
  'WebMCP binds only in a top-level, secure page in a browser with an agent (Chrome 146+). The map is fully usable without one — everything you add lands in the log for an agent to read later.';

export default function AgentStatusNarrative({
  status,
  channel,
  reason,
  mapMissing,
}: {
  status: BridgeStatus;
  channel: AgentChannel | null;
  reason: string | null;
  mapMissing: boolean;
}) {
  if (mapMissing) {
    // Outranks everything else, because it is the only state here a person can
    // and must act on.
    return (
      <>
        <p className="text-[13px] font-semibold text-ink">
          This map no longer exists
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          It was deleted while this page was open, so every tool bound here
          answers “No such map”. Reload to start a new one.
        </p>
      </>
    );
  }

  const attached = status !== 'unavailable';

  if (attached && channel) {
    return (
      <>
        <p className="text-[13px] font-semibold text-ink">
          {CHANNEL_HEADLINE[channel]}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          {CHANNEL_DETAIL[channel]}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[13px] font-semibold text-ink">No agent is attached</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        {reason ? `${reason}. ` : ''}
        {UNAVAILABLE_HELP}
      </p>
    </>
  );
}

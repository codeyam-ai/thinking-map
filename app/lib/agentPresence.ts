// Whether an agent is on this map — across every door, not just one of them.
//
// The app has three front doors: the WebMCP binding in the page, the HTTP MCP
// endpoint, and the stdio server. Presence used to mean "a WebMCP binding
// exists in this tab", which made an agent working through `/api/mcp` invisible
// — the header said "No agent attached" and the handoff strip said "the agent
// that was here has gone" while that agent was writing nodes onto the map.
//
// So presence is defined here on the evidence every door leaves behind: the
// exchange log. A binding is proof an agent CAN act; recent agent events are
// proof one IS acting. Either is enough to stop telling a person nobody is
// there.
//
// Pure, and pinned by tests, for the same reason `askPresence` is: the wording
// these facts drive is the interface, and getting it wrong means telling
// someone their question will be read when nothing is listening — or that
// nobody is home while their map fills up.

import type { ExchangeEvent } from './exchange';

/** Which door the agent came through, or null when nobody is there. */
export type AgentChannel = 'webmcp' | 'mcp';

export interface AgentPresence {
  /** True when SOMETHING is working this map, by any door. */
  attached: boolean;
  channel: AgentChannel | null;
  /** When the log last saw the agent act. Null if it never has. */
  lastAgentAt: Date | null;
}

/**
 * How long an agent's last action keeps counting as presence.
 *
 * A tool call is an instant, not a session: the MCP doors are request/response,
 * so there is no connection to observe and no disconnect to hear about. The
 * window is what turns a series of instants into "someone is here".
 *
 * 90 seconds is chosen against how these agents actually work — a turn spent
 * reading a brief or composing a batch of nodes can leave a real gap between
 * writes — and the failure it prefers is the recoverable one: claiming presence
 * a minute after an agent left costs a person one stale line, while dropping to
 * "nobody is here" between two writes of the same turn is the bug being fixed.
 */
export const PRESENCE_WINDOW_MS = 90_000;

/** Tolerates the Date the server hands over and the string JSON hands back. */
function at(event: ExchangeEvent): number {
  const value = event.createdAt;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Read presence off the binding and the log together.
 *
 * `webMcpBound` wins when both are true: it is the stronger claim. A bound page
 * can be ASKED — `ask_user` puts a question in front of a person and waits — and
 * a map reached over HTTP cannot be, so the two are not interchangeable even
 * though both mean "an agent is here".
 */
export function agentPresence(input: {
  webMcpBound: boolean;
  events: ExchangeEvent[];
  now?: number;
}): AgentPresence {
  const now = input.now ?? Date.now();

  let latest: number | null = null;
  for (const event of input.events) {
    if (event.origin !== 'agent') continue;
    const time = at(event);
    // A malformed timestamp must not read as 1970 and silently suppress
    // presence, nor as now and fake it.
    if (Number.isNaN(time)) continue;
    if (latest === null || time > latest) latest = time;
  }

  const lastAgentAt = latest === null ? null : new Date(latest);

  if (input.webMcpBound) {
    return { attached: true, channel: 'webmcp', lastAgentAt };
  }
  // Clock skew between the server that stamped the event and the browser
  // reading it can put a write slightly in the future. That is presence, not a
  // reason to discount it, so only the lower bound is checked.
  if (latest !== null && now - latest < PRESENCE_WINDOW_MS) {
    return { attached: true, channel: 'mcp', lastAgentAt };
  }
  return { attached: false, channel: null, lastAgentAt };
}

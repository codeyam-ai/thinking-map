import { describe, expect, it } from 'vitest';
import { agentPresence, PRESENCE_WINDOW_MS } from './agentPresence';
import type { ExchangeEvent } from './exchange';

// Presence is what three surfaces read before deciding whether to tell a person
// anyone is listening. The bug these pin: presence used to mean "a WebMCP
// binding exists in this tab", so an agent working the map through the HTTP MCP
// door was invisible — the header said "No agent attached" while that agent
// wrote nodes onto the board.

const NOW = new Date('2026-09-02T21:20:00Z').getTime();

function event(over: Partial<ExchangeEvent> = {}): ExchangeEvent {
  return {
    id: 'e1',
    revision: 1,
    kind: 'node.added',
    origin: 'agent',
    payload: {},
    createdAt: new Date(NOW - 1000),
    ...over,
  } as ExchangeEvent;
}

describe('agentPresence', () => {
  // The case that was wrong: no binding, but the log shows an agent mid-session.
  it('counts an agent working through the MCP door as attached', () => {
    const presence = agentPresence({
      webMcpBound: false,
      events: [event()],
      now: NOW,
    });
    expect(presence).toMatchObject({ attached: true, channel: 'mcp' });
  });

  // A bound page can be ASKED — ask_user puts a question in front of a person
  // and waits. A map reached over HTTP cannot, so the channel has to survive
  // even when both signals are true.
  it('reports webmcp when the page is bound, whatever the log says', () => {
    expect(
      agentPresence({ webMcpBound: true, events: [event()], now: NOW }).channel,
    ).toBe('webmcp');
    expect(
      agentPresence({ webMcpBound: true, events: [], now: NOW }).channel,
    ).toBe('webmcp');
  });

  // The other half of honesty: an agent that left must stop counting, or the
  // page promises someone a reply that is not coming.
  it('lets presence lapse once the window has passed', () => {
    const stale = event({ createdAt: new Date(NOW - PRESENCE_WINDOW_MS - 1) });
    expect(
      agentPresence({ webMcpBound: false, events: [stale], now: NOW }),
    ).toMatchObject({ attached: false, channel: null });
  });

  // The failure the window is sized to prefer. A turn spent reading a brief can
  // leave a real gap between two writes, and dropping to "nobody is here" in
  // the middle of one agent's turn is the exact bug the window exists to fix.
  it('holds presence through a gap inside one turn', () => {
    const recent = event({ createdAt: new Date(NOW - PRESENCE_WINDOW_MS + 5000) });
    expect(
      agentPresence({ webMcpBound: false, events: [recent], now: NOW }).attached,
    ).toBe(true);
  });

  // The person's own writes are not an agent being present. Counting them would
  // make every map claim an agent the moment someone typed into it.
  it('does not mistake the person for an agent', () => {
    expect(
      agentPresence({
        webMcpBound: false,
        events: [event({ origin: 'user' })],
        now: NOW,
      }).attached,
    ).toBe(false);
  });

  // The log arrives as JSON from the poll and as Dates from the server render.
  it('reads a timestamp that arrived as a JSON string', () => {
    const raw = {
      ...event(),
      createdAt: new Date(NOW - 1000).toISOString(),
    } as unknown as ExchangeEvent;
    expect(
      agentPresence({ webMcpBound: false, events: [raw], now: NOW }).attached,
    ).toBe(true);
  });

  // Latest wins, not last-in-array: the poll appends, but nothing guarantees
  // order across a merge of the initial render and a later page of events.
  it('takes the most recent agent event rather than the last one listed', () => {
    const presence = agentPresence({
      webMcpBound: false,
      events: [
        event({ id: 'new', createdAt: new Date(NOW - 1000) }),
        event({ id: 'old', createdAt: new Date(NOW - 600_000) }),
      ],
      now: NOW,
    });
    expect(presence.attached).toBe(true);
    expect(presence.lastAgentAt?.getTime()).toBe(NOW - 1000);
  });

  // The empty case, which is most maps most of the time. It must report plain
  // absence rather than a null-ish shape the callers have to interpret — three
  // components read this to decide what to tell a person.
  it('is honest about a map no agent has ever touched', () => {
    expect(agentPresence({ webMcpBound: false, events: [], now: NOW })).toEqual({
      attached: false,
      channel: null,
      lastAgentAt: null,
    });
  });
});

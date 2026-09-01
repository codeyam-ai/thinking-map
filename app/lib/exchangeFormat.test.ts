import { describe, expect, it } from 'vitest';
import { renderEvents } from './exchangeFormat';
import type { ExchangeEvent } from './exchange';

// The exchange is pull-only, so this text is the whole of what an agent learns
// about everything that happened while it was not looking. If a line loses its
// revision the agent has no cursor; if it loses its gist the agent has no idea
// what changed.

function event(partial: Partial<ExchangeEvent>): ExchangeEvent {
  return {
    id: 'e1',
    revision: 1,
    kind: 'node.added',
    origin: 'agent',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

describe('renderEvents', () => {
  // An agent that asked for a delta and got nothing must be told so plainly —
  // an empty string reads as a broken tool.
  it('says so when nothing happened', () => {
    expect(renderEvents([])).toBe('(nothing new)');
  });

  // The revision leads because it is what the agent passes back as its cursor.
  it('leads every line with the revision, kind and origin', () => {
    const line = renderEvents([
      event({ revision: 7, kind: 'node.added', origin: 'user', payload: {} }),
    ]);
    expect(line).toBe('r7 node.added (user)');
  });

  // Each kind carries its readable part under a different key. A wall of bare
  // kinds would tell the agent nothing about what actually changed.
  it('shows the gist from whichever field the kind uses', () => {
    const rendered = renderEvents([
      event({ revision: 1, kind: 'node.added', payload: { label: 'A goal' } }),
      event({ revision: 2, kind: 'agent.note', payload: { text: 'why I did it' } }),
      event({ revision: 3, kind: 'phase.set', payload: { phase: 'explore' } }),
      event({ revision: 4, kind: 'user.answer', payload: { answer: 'almost never' } }),
    ]);
    expect(rendered.split('\n')).toEqual([
      'r1 node.added (agent) — A goal',
      'r2 agent.note (agent) — why I did it',
      'r3 phase.set (agent) — explore',
      'r4 user.answer (agent) — almost never',
    ]);
  });

  // `label` wins over the others so a node event reads as the node, not as
  // whatever incidental text happens to ride along with it.
  it('prefers the label when an event carries several readable fields', () => {
    const line = renderEvents([
      event({ revision: 9, payload: { label: 'the node', text: 'the note' } }),
    ]);
    expect(line).toBe('r9 node.added (agent) — the node');
  });

  // A payload that failed to decode arrives as null. One bad row must not take
  // down the agent's whole catch-up read.
  it('still renders an event whose payload is null or empty', () => {
    const rendered = renderEvents([
      event({ revision: 3, payload: null }),
      event({ revision: 4, payload: {} }),
    ]);
    expect(rendered.split('\n')).toEqual([
      'r3 node.added (agent)',
      'r4 node.added (agent)',
    ]);
  });

  // An empty string is not a gist — appending a bare dash would be noise.
  it('omits the dash when the readable field is empty', () => {
    expect(renderEvents([event({ revision: 5, payload: { label: '' } })])).toBe(
      'r5 node.added (agent)',
    );
  });

  // Order is the point of an ordered log.
  it('keeps events in the order given, one per line', () => {
    const rendered = renderEvents([
      event({ revision: 1 }),
      event({ revision: 2 }),
      event({ revision: 3 }),
    ]);
    expect(rendered.split('\n').map((l) => l.slice(0, 2))).toEqual(['r1', 'r2', 'r3']);
  });
});

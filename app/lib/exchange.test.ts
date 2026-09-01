import { describe, expect, it } from 'vitest';
import { decodeEvent, isEventKind, isUserEventKind } from './exchange';

// The pure parts of the exchange spine: what counts as an event kind, which
// kinds a browser is allowed to write, and how a stored row becomes readable.
// The database-bound parts of this module are exercised through the tools.

describe('event kinds', () => {
  // Each of these is written somewhere in the spine and read back by an agent.
  // One dropped from the list becomes a row nothing can resume past.
  it('accepts every kind the log can record', () => {
    for (const kind of [
      'node.added',
      'node.updated',
      'phase.set',
      'agent.note',
      'question.asked',
      'user.answer',
      'user.note',
      'user.node',
    ]) {
      expect(isEventKind(kind)).toBe(true);
    }
  });

  // A typo would become a row nothing knows how to render or resume from.
  it('rejects a kind the log does not define', () => {
    expect(isEventKind('node.deleted')).toBe(false);
    expect(isEventKind('')).toBe(false);
    expect(isEventKind('Node.Added')).toBe(false);
  });
});

// This is a trust boundary, not a convenience. The page posts these kinds
// directly, so anything it is allowed to write is something a browser can
// claim the person did.
describe('user-writable event kinds', () => {
  // These three are what the contribution affordances post. Narrowing this set
  // would silently drop a person's contribution on the floor.
  it('accepts the three kinds a person can contribute', () => {
    expect(isUserEventKind('user.answer')).toBe(true);
    expect(isUserEventKind('user.note')).toBe(true);
    expect(isUserEventKind('user.node')).toBe(true);
  });

  // The agent's own kinds are minted by the tools. Accepting one from the
  // browser would let a page forge the other side of the conversation.
  it('refuses the kinds only an agent may write', () => {
    expect(isUserEventKind('agent.note')).toBe(false);
    expect(isUserEventKind('question.asked')).toBe(false);
    expect(isUserEventKind('node.added')).toBe(false);
    expect(isUserEventKind('phase.set')).toBe(false);
  });
});

describe('decodeEvent', () => {
  const row = {
    id: 'e1',
    revision: 4,
    kind: 'agent.note',
    origin: 'agent',
    payload: '{"text":"what I changed"}',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  // The happy path: SQLite hands back a string and the agent needs an object.
  it('parses the stored payload back into an object', () => {
    expect(decodeEvent(row)).toEqual({
      id: 'e1',
      revision: 4,
      kind: 'agent.note',
      origin: 'agent',
      payload: { text: 'what I changed' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  // SQLite has no JSON column, so payloads are strings that could be anything.
  // A single unparseable row must not take down a whole catch-up read — the
  // revision and kind are the load-bearing parts and they survive.
  it('degrades to a null payload rather than throwing on bad JSON', () => {
    const decoded = decodeEvent({ ...row, payload: 'not json{' });
    expect(decoded.payload).toBeNull();
    expect(decoded.revision).toBe(4);
    expect(decoded.kind).toBe('agent.note');
  });

  // An empty column is the other shape a bad write leaves behind, and it must
  // degrade identically rather than throwing.
  it('handles an empty payload string the same way', () => {
    expect(decodeEvent({ ...row, payload: '' }).payload).toBeNull();
  });
});

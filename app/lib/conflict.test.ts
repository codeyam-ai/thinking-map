import { describe, expect, it } from 'vitest';
import { findConflictingChanges, needsConflictCheck } from './conflict';
import type { ExchangeEvent } from './exchange';

// A person and an agent work the same map with no lock between them. These two
// functions are the whole of what stops the agent overwriting what the person
// typed, so every branch here is a case where a real edit would be destroyed.

function event(partial: Partial<ExchangeEvent>): ExchangeEvent {
  return {
    id: 'e1',
    revision: 1,
    kind: 'node.updated',
    origin: 'agent',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

describe('needsConflictCheck', () => {
  // An agent that passes no expectedRevision is explicitly saying it does not
  // care. Reading the log anyway would be work nobody asked for.
  it('skips the check when the agent did not guard the write', () => {
    expect(needsConflictCheck(undefined, 99)).toBe(false);
  });

  // The map has not moved since the agent read it, so nothing can have been
  // clobbered.
  it('skips the check when the map has not moved', () => {
    expect(needsConflictCheck(14, 14)).toBe(false);
  });

  // A map BEHIND the expected revision cannot happen from a single writer, but
  // if it does, treating it as a conflict would block writes forever.
  it('skips the check when the map is somehow behind the agent', () => {
    expect(needsConflictCheck(20, 14)).toBe(false);
  });

  // The one case worth a read.
  it('checks when the map moved past what the agent read', () => {
    expect(needsConflictCheck(14, 15)).toBe(true);
  });
});

describe('findConflictingChanges', () => {
  // The core case: the person edited the very node the agent is about to
  // rewrite. Returning it is what turns the write into a declined result.
  it('reports a user change to the same node', () => {
    const events = [
      event({ revision: 15, origin: 'user', payload: { id: 'n-1', label: 'mine' } }),
    ];
    expect(findConflictingChanges(events, 'n-1')).toHaveLength(1);
  });

  // An agent's own earlier write is not a conflict with itself. Counting it
  // would deadlock a retrying agent against its own history.
  it('ignores the agent’s own changes to that node', () => {
    const events = [
      event({ revision: 15, origin: 'agent', payload: { id: 'n-1', label: 'mine' } }),
    ];
    expect(findConflictingChanges(events, 'n-1')).toEqual([]);
  });

  // A busy map moves constantly. "Something changed" is far too coarse — only a
  // change to THIS node can destroy THIS write.
  it('ignores user changes to a different node', () => {
    const events = [
      event({ revision: 15, origin: 'user', payload: { id: 'n-2', label: 'elsewhere' } }),
    ];
    expect(findConflictingChanges(events, 'n-1')).toEqual([]);
  });

  // A user event that carries no node (a free-text note) is real activity but
  // cannot conflict with a node write.
  it('ignores user events that name no node', () => {
    const events = [
      event({ revision: 15, kind: 'user.note', origin: 'user', payload: { text: 'hm' } }),
    ];
    expect(findConflictingChanges(events, 'n-1')).toEqual([]);
  });

  // A payload that failed to decode arrives as null. It must not throw here —
  // that would turn one bad row into a failed write.
  it('survives an event whose payload could not be decoded', () => {
    const events = [event({ revision: 15, origin: 'user', payload: null })];
    expect(findConflictingChanges(events, 'n-1')).toEqual([]);
  });

  // Several people-edits to one node all come back, so the declined result can
  // describe everything the agent would have destroyed.
  it('reports every user change to the node, in order', () => {
    const events = [
      event({ revision: 15, origin: 'user', payload: { id: 'n-1', label: 'first' } }),
      event({ revision: 16, origin: 'agent', payload: { id: 'n-1', label: 'agent' } }),
      event({ revision: 17, origin: 'user', payload: { id: 'n-1', label: 'second' } }),
    ];
    const found = findConflictingChanges(events, 'n-1');
    expect(found.map((e) => e.revision)).toEqual([15, 17]);
  });

  // Nothing happened to this node at all.
  it('reports nothing on an empty delta', () => {
    expect(findConflictingChanges([], 'n-1')).toEqual([]);
  });
});

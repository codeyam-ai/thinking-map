import { describe, expect, it } from 'vitest';
import { nodeAddedPayload, resolveRef } from './mapStore';

// The pure half of mapStore. Everything else in that module needs a real
// transaction and lives in exchange.integration.test.ts; these two are
// translations with no database in them, and they carry contract decisions
// worth pinning on their own rather than only through a live insert.

describe('resolveRef', () => {
  // The ordinary case: a node names something created moments earlier in the
  // same call, and the ref has to become the id the database just handed back.
  it('resolves a ref minted earlier in the same plan', () => {
    const refs = new Map([['q1', 'node-abc']]);
    expect(resolveRef(refs, 'q1')).toBe('node-abc');
  });

  // A ref that is not in the plan is usually the real id of something already
  // on the board, so it passes through untouched.
  it('passes through a value the plan does not name', () => {
    expect(resolveRef(new Map(), 'node-already-there')).toBe(
      'node-already-there',
    );
  });

  // The load-bearing half. An unresolvable value must survive rather than
  // become null: a dangling link is reported on screen, whereas dropping it
  // would hide that the node claimed the relationship at all.
  it('keeps an unresolvable ref rather than dropping it', () => {
    const refs = new Map([['other', 'node-abc']]);
    expect(resolveRef(refs, 'never-created')).toBe('never-created');
  });
});

describe('nodeAddedPayload', () => {
  const row = {
    id: 'node-1',
    kind: 'open-question',
    label: 'Can folders seed metadata?',
    status: 'open',
    themeId: null,
    sourceRef: null,
    options: null,
  };

  // The floor: the fields every reader of the log depends on.
  it('carries the identity a reader needs', () => {
    expect(nodeAddedPayload(row, 'parent-9', null)).toMatchObject({
      id: 'node-1',
      parentId: 'parent-9',
      kind: 'open-question',
      label: 'Can folders seed metadata?',
      status: 'open',
      themeId: null,
    });
  });

  // The log speaks the contract's language, not the column's: options are
  // stored as a JSON string because SQLite has no array type, and a reader
  // should get the array the tools take.
  it('returns options as an array, not the JSON string the column holds', () => {
    const payload = nodeAddedPayload(
      { ...row, options: JSON.stringify(['Yes', 'No']) },
      null,
      null,
    );
    expect(payload.options).toEqual(['Yes', 'No']);
  });

  // Absence is expressed by omission, not by null, so a reader can treat the
  // presence of a key as meaning something — and an ordinary node's event stays
  // byte-for-byte what it has always been.
  it('omits the optional fields entirely when they are absent', () => {
    const payload = nodeAddedPayload(row, null, null);
    expect('options' in payload).toBe(false);
    expect('sourceRef' in payload).toBe(false);
    expect('testsNodeId' in payload).toBe(false);
    expect('fromNodeIds' in payload).toBe(false);
  });

  // An insight that cited nothing must be indistinguishable from one written
  // before the field existed — an empty array in the log would read as "this
  // insight named its sources and they were none", which is a different claim.
  it('omits the citations when the list is empty rather than sending []', () => {
    expect('fromNodeIds' in nodeAddedPayload(row, null, null, [])).toBe(false);
  });

  // The log speaks the contract's language, not the column's. The row stores a
  // JSON string because SQLite has no array type; a reader of the log should
  // never have to know that.
  it('carries an insight’s citations as an array of ids', () => {
    const payload = nodeAddedPayload(row, null, null, ['q1', 'q2']);
    expect(payload.fromNodeIds).toEqual(['q1', 'q2']);
  });

  // Provenance and the assumption a slice claims to settle both belong in the
  // log, not only in the database where the log's readers cannot see them.
  it('includes provenance and the settled assumption when present', () => {
    const payload = nodeAddedPayload(
      { ...row, sourceRef: 'brief-3' },
      null,
      'node-assumption',
    );
    expect(payload.sourceRef).toBe('brief-3');
    expect(payload.testsNodeId).toBe('node-assumption');
  });
});

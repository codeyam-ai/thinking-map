import { describe, expect, it } from 'vitest';
import { parseAttachments } from './attachments';

// What the person brought along with the idea, read back off the map.
//
// The rule under test is an AVAILABILITY one rather than a correctness one: a
// board that cannot parse its own attachment column must still OPEN. Every
// malformed shape below therefore degrades to "nothing attached" instead of
// throwing, because one bad string taking the whole board down is a far worse
// outcome than a board rendering without its attachments.

describe('parseAttachments', () => {
  // The ordinary case, in the shape the attachments endpoint actually writes.
  it('reads the names the endpoint stored', () => {
    expect(
      parseAttachments(
        '[{"name":"shift-handover-notes.pdf"},{"name":"whiteboard.jpg"}]',
      ),
    ).toEqual([
      { name: 'shift-handover-notes.pdf' },
      { name: 'whiteboard.jpg' },
    ]);
  });

  // Nothing attached is the common case — most boards never attach anything —
  // so it has to be silent rather than an absence the caller has to handle.
  it('reads no attachments as an empty list', () => {
    expect(parseAttachments(null)).toEqual([]);
    expect(parseAttachments('')).toEqual([]);
    expect(parseAttachments('[]')).toEqual([]);
  });

  // The availability rule itself. A column that is not JSON, or is JSON of the
  // wrong shape, must not throw — a page that 500s over a stray string in one
  // column is worse than a board with its attachment list missing.
  it('survives a column it cannot parse', () => {
    for (const bad of [
      'not json',
      '{',
      '{"name":"x"}',
      '"a string"',
      '42',
      'null',
    ]) {
      expect(parseAttachments(bad)).toEqual([]);
    }
  });

  // Names only. Anything else on the row is dropped rather than passed through,
  // so the board cannot start rendering a shape the rest of the app does not
  // know how to read.
  it('keeps the name and drops everything else on the row', () => {
    expect(
      parseAttachments('[{"name":"notes.pdf","size":91234,"url":"https://x/y"}]'),
    ).toEqual([{ name: 'notes.pdf' }]);
  });

  // A blank name would render as a row nobody can identify or remove, so it is
  // dropped here the same way the endpoint drops it on the way in.
  it('drops entries with no usable name', () => {
    expect(
      parseAttachments('[{"name":"  "},{},{"name":"real.pdf"},null]'),
    ).toEqual([{ name: 'real.pdf' }]);
  });
});

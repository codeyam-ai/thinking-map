import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENTS_PER_MAP,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_BYTES,
  admitFiles,
  fitsAttachmentCaps,
  formatSize,
  parseAttachments,
  readAttachments,
  shortenName,
} from './attachments';

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

// The same availability rule, applied to rows instead of to a JSON column.
// `readAttachments` replaced `parseAttachments` when attachments became their
// own table, and the rule it inherits is the one above: the list may come back
// shorter, never broken.
describe('readAttachments', () => {
  const row = {
    id: 'a1',
    name: 'whiteboard-photo.png',
    mediaType: 'image/png',
    byteSize: 1563,
    hasBytes: true,
  };

  // The ordinary case. Every field here is one the board actually consults:
  // the id addresses the byte route, the media type and hasBytes decide
  // between a thumbnail and a paperclip, the size labels the chip.
  it('carries through what the board needs to render a row', () => {
    expect(readAttachments([row])).toEqual([
      {
        id: 'a1',
        name: 'whiteboard-photo.png',
        mediaType: 'image/png',
        byteSize: 1563,
        hasBytes: true,
      },
    ]);
  });

  // A legacy row: recorded when the board stored names and nothing else. It
  // must render as an ordinary attachment, distinguishable only by having no
  // file behind it — that is a fact about its age, not a failure.
  it('keeps a row that has no file behind it', () => {
    const legacy = readAttachments([
      { ...row, name: 'notes.pdf', byteSize: 0, hasBytes: false },
    ]);
    expect(legacy).toHaveLength(1);
    expect(legacy[0].hasBytes).toBe(false);
  });

  // A row with no usable name could not be identified or removed, so it is
  // dropped rather than rendered blank.
  it('drops a row with no usable name', () => {
    expect(readAttachments([{ ...row, name: '   ' }])).toEqual([]);
  });

  // An unknown media type is named rather than left undefined, so a caller
  // deciding whether to show a thumbnail never has to handle a missing field.
  it('falls back to a generic media type', () => {
    expect(readAttachments([{ ...row, mediaType: '' }])[0].mediaType).toBe(
      'application/octet-stream',
    );
  });
});

// The caps, which are the answer to the size objection the schema comment used
// to raise. They are enforced server-side because a cap only the client checks
// is not a cap — so these are the rules the upload route actually applies, and
// each refusal has to say what to do instead rather than only that it said no.
describe('fitsAttachmentCaps', () => {
  const held = (...sizes: number[]) => sizes.map((byteSize) => ({ byteSize }));

  /** Assert the file was turned away, and by WHICH cap. Naming the reason is
   *  the point: four rules that all just say "no" would pass a test that only
   *  checked `ok`, while the route mapped every one of them to a wrong status. */
  const refusal = (verdict: ReturnType<typeof fitsAttachmentCaps>) => {
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('expected a refusal');
    return verdict;
  };

  // The path almost every upload takes. It is worth pinning because the three
  // caps below are all refusals, and a rule set that only ever says no would
  // pass its own tests while blocking the feature entirely.
  it('admits an ordinary image onto an empty map', () => {
    expect(
      fitsAttachmentCaps(held(), { name: 'shot.png', type: 'image/png', size: 2048 }),
    ).toEqual({ ok: true });
  });

  // A type nothing downstream can open is refused at the door rather than
  // stored and discovered later by a tool that cannot read it.
  it('refuses a type nothing can open, and names the type', () => {
    const verdict = refusal(
      fitsAttachmentCaps(held(), {
        name: 'clip.mp4',
        type: 'video/mp4',
        size: 2048,
      }),
    );
    expect(verdict.reason).toBe('type');
    expect(verdict.error).toContain('video/mp4');
    expect(verdict.error).toContain('clip.mp4');
  });

  // The per-file cap. The sentence has to offer a way forward — a smaller
  // version, or a crop — because "too big" alone leaves the person stuck.
  it('refuses a file over the per-attachment cap', () => {
    const verdict = refusal(
      fitsAttachmentCaps(held(), {
        name: 'huge.png',
        type: 'image/png',
        size: MAX_ATTACHMENT_BYTES + 1,
      }),
    );
    expect(verdict.reason).toBe('size');
    expect(verdict.error).toContain(formatSize(MAX_ATTACHMENT_BYTES));
  });

  // The boundary. A cap stated as "up to 5MB" has to actually admit 5MB —
  // an off-by-one here refuses the exact file the message promises to accept.
  it('admits a file exactly at the per-attachment cap', () => {
    expect(
      fitsAttachmentCaps(held(), {
        name: 'exact.png',
        type: 'image/png',
        size: MAX_ATTACHMENT_BYTES,
      }).ok,
    ).toBe(true);
  });

  // The count cap. It names the way out — remove one — rather than only the
  // limit, because the limit alone is not an action.
  it('refuses one past the count cap', () => {
    const full = held(...Array(MAX_ATTACHMENTS_PER_MAP).fill(10));
    const verdict = refusal(
      fitsAttachmentCaps(full, {
        name: 'fifth.png',
        type: 'image/png',
        size: 10,
      }),
    );
    expect(verdict.reason).toBe('count');
    expect(verdict.error).toContain('fifth.png');
  });

  // The total cap catches what the per-file cap cannot: four files each under
  // 5MB can still add up past what one map should hold.
  it('refuses a file that would put the map over the total cap', () => {
    const nearlyFull = held(MAX_TOTAL_BYTES - 1024);
    const verdict = refusal(
      fitsAttachmentCaps(nearlyFull, {
        name: 'last.png',
        type: 'image/png',
        size: 4096,
      }),
    );
    expect(verdict.reason).toBe('total');
    expect(verdict.error).toContain(formatSize(MAX_TOTAL_BYTES));
  });

  // The boundary of the total cap: landing exactly on it is within it.
  it('admits a file that lands exactly on the total cap', () => {
    expect(
      fitsAttachmentCaps(held(MAX_TOTAL_BYTES - 4096), {
        name: 'last.png',
        type: 'image/png',
        size: 4096,
      }).ok,
    ).toBe(true);
  });
});

// The client-side half: the same rules, applied before a round trip, so a
// person sees a refusal as they paste rather than after the board is made. It
// is a courtesy and NOT the enforcement — which is why the sentences are the
// same but the route is what actually decides.
describe('admitFiles', () => {
  const file = (name: string, size: number, type = 'image/png') =>
    ({ name, size, type }) as File;

  // The common case, and the one that proves this is a filter rather than a
  // gate: a file that fits arrives with no message attached to it.
  it('admits files that fit', () => {
    const { accepted, error } = admitFiles([], [file('a.png', 10)]);
    expect(accepted.map((f) => f.name)).toEqual(['a.png']);
    expect(error).toBeNull();
  });

  // Browsing twice for the same file is an ordinary slip, and listing it twice
  // would leave two chips that both claim to be the same thing.
  it('ignores a file already in hand', () => {
    const existing = [file('a.png', 10)];
    expect(admitFiles(existing, [file('a.png', 10)]).accepted).toEqual([]);
  });

  // An oversize file is dropped but its companions still land — refusing the
  // whole batch over one member would lose files the person can keep.
  it('keeps the rest of a batch when one file is too big', () => {
    const { accepted, error } = admitFiles(
      [],
      [file('ok.png', 10), file('huge.png', MAX_ATTACHMENT_BYTES + 1)],
    );
    expect(accepted.map((f) => f.name)).toEqual(['ok.png']);
    expect(error).toContain('huge.png');
  });

  // At the cap, the ones that fit are kept and the person is told what
  // happened rather than silently losing the overflow.
  it('takes only what there is room for, and says so', () => {
    const existing = Array.from({ length: MAX_ATTACHMENTS_PER_MAP - 1 }, (_, i) =>
      file(`held${i}.png`, 10),
    );
    const { accepted, error } = admitFiles(existing, [
      file('first.png', 10),
      file('second.png', 10),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['first.png']);
    expect(error).toContain(String(MAX_ATTACHMENTS_PER_MAP));
  });

  // Already at the cap. There is no room to partially fill, so the answer is
  // nothing plus a sentence — never a silent no-op, which would look to the
  // person like the paste simply failed.
  it('admits nothing once the map is already full', () => {
    const full = Array.from({ length: MAX_ATTACHMENTS_PER_MAP }, (_, i) =>
      file(`held${i}.png`, 10),
    );
    const { accepted, error } = admitFiles(full, [file('extra.png', 10)]);
    expect(accepted).toEqual([]);
    expect(error).not.toBeNull();
  });
});

// Sizes are read by a person, so the unit has to be the one that makes the
// number meaningful — and a small file must never round to nothing.
describe('formatSize', () => {
  // The unit the caps are stated in, so the refusal sentence and the chip
  // beside it agree about what "5MB" looks like.
  it('reads megabytes for a file measured in them', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0MB');
  });

  // The size an actual screenshot tends to be. Megabytes with a decimal would
  // render most real attachments as "0.0MB", which says nothing.
  it('reads kilobytes below a megabyte', () => {
    expect(formatSize(1563)).toBe('2KB');
  });

  // A handful of bytes is still something rather than nothing: "0KB" beside a
  // file that plainly exists reads as a bug.
  it('never rounds a real file down to zero', () => {
    expect(formatSize(18)).toBe('1KB');
  });

  // Nothing at all is the legacy row, which should say nothing rather than
  // claim a size it does not have.
  it('says nothing for a row with no file behind it', () => {
    expect(formatSize(0)).toBe('');
  });
});

// Every chip that names a file truncates through here, at whatever limit its
// own surface allows. Shared so the three of them cannot drift into cutting at
// different points — and because the ellipsis arithmetic is exactly the kind of
// off-by-one that makes a chip one character too wide.
describe('shortenName', () => {
  // A name that fits is returned untouched. Truncation is for names that need
  // it, not a house style applied to every chip.
  it('leaves a name that fits alone', () => {
    expect(shortenName('notes.pdf', 24)).toBe('notes.pdf');
  });

  // The budget INCLUDES the ellipsis — a chip sized for 24 characters that
  // renders 25 is the bug this arithmetic exists to avoid. It cuts to two
  // under the limit and spends one of those on the ellipsis, so the result
  // lands just inside rather than exactly on it.
  it('never returns more characters than the limit', () => {
    const out = shortenName('practice-management-system-evaluation.png', 24);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out.endsWith('…')).toBe(true);
  });

  // The boundary: exactly at the limit still fits, so it must not be cut.
  it('does not truncate a name exactly at the limit', () => {
    const exact = 'a'.repeat(24);
    expect(shortenName(exact, 24)).toBe(exact);
  });

  // One past it is the first name that gets cut.
  it('truncates the first name past the limit', () => {
    expect(shortenName('a'.repeat(25), 24)).toBe(`${'a'.repeat(22)}…`);
  });
});

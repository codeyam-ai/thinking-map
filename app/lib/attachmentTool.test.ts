import { describe, expect, it } from 'vitest';
import { attachmentNotFound, attachmentToolResult } from './attachmentTool';

// What an agent gets when it opens something the person brought along.
//
// The claim this whole feature rests on is that a picture reaches the agent as
// a PICTURE — so the image branch below asserts the bytes come back decodable
// and tagged, not merely that some text was returned. The three non-image
// branches all assert the same discipline in different words: say plainly what
// is there, never flag it as an error, and never leave the agent to guess.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('attachmentToolResult', () => {
  // The headline. An image has to arrive as an image block carrying its media
  // type and base64 that round-trips — a caption alone would be the exact
  // failure this feature exists to fix.
  it('hands an image back as a picture the agent can look at', () => {
    const result = attachmentToolResult({
      name: 'whiteboard-photo.png',
      mediaType: 'image/png',
      byteSize: PNG.length,
      bytes: PNG,
    });

    expect(result.images).toHaveLength(1);
    expect(result.images?.[0].mimeType).toBe('image/png');
    expect(Buffer.from(result.images![0].data, 'base64')).toEqual(
      Buffer.from(PNG),
    );
  });

  // The picture still needs saying what it is. An image block with no caption
  // is a thing with no provenance — the agent should know what it is looking
  // at before it looks at it.
  it('names the picture in text alongside it', () => {
    const result = attachmentToolResult({
      name: 'whiteboard-photo.png',
      mediaType: 'image/png',
      byteSize: 1563,
      bytes: PNG,
    });

    expect(result.text).toContain('whiteboard-photo.png');
    expect(result.text).toContain('image/png');
  });

  // A text document is text. No image block, because there is no picture —
  // returning an empty one would make every caller check for a block that is
  // never populated.
  it('hands a text document back as its text', () => {
    const result = attachmentToolResult({
      name: 'call-back-log.txt',
      mediaType: 'text/plain',
      byteSize: 17,
      bytes: new TextEncoder().encode('owner call-backs'),
    });

    expect(result.text).toContain('owner call-backs');
    expect(result.images).toBeUndefined();
  });

  // The legacy row: a name recorded before the board could hold files. It must
  // say the file was never stored AND tell the agent to ask rather than infer,
  // because guessing at a whiteboard photo from its filename is worse than
  // admitting there is nothing there.
  it('says plainly when there is nothing behind the name', () => {
    const result = attachmentToolResult({
      name: 'shift-handover-notes.pdf',
      mediaType: 'application/octet-stream',
      byteSize: 0,
      bytes: null,
    });

    expect(result.text).toContain('never stored');
    expect(result.text).toContain('Ask the person');
    expect(result.structured).toMatchObject({ hasBytes: false });
    expect(result.images).toBeUndefined();
  });

  // A PDF is the one accepted type that is neither picture nor text. Rather
  // than hand over bytes that read as noise, it names the door that DOES read
  // documents properly — otherwise this tool quietly becomes a second, worse
  // brief pipeline.
  it('points a PDF at read_brief instead of dumping its bytes', () => {
    const result = attachmentToolResult({
      name: 'scope.pdf',
      mediaType: 'application/pdf',
      byteSize: 91_234,
      bytes: PNG,
    });

    expect(result.text).toContain('read_brief');
    expect(result.images).toBeUndefined();
    expect(result.structured).toMatchObject({ readable: false });
  });

  // Every branch is an ordinary answer, never a fault. An `isError` result
  // invites the blind retry that a permanent condition can never satisfy —
  // which is exactly what a legacy row and a PDF both are.
  it('never reports any of these as a fault', () => {
    const cases = [
      { name: 'a.png', mediaType: 'image/png', byteSize: 8, bytes: PNG },
      { name: 'b.txt', mediaType: 'text/plain', byteSize: 8, bytes: PNG },
      { name: 'c.pdf', mediaType: 'application/pdf', byteSize: 8, bytes: PNG },
      { name: 'd', mediaType: 'application/octet-stream', byteSize: 0, bytes: null },
    ];
    for (const one of cases) {
      expect(attachmentToolResult(one)).not.toHaveProperty('isError');
    }
  });
});

describe('attachmentNotFound', () => {
  // An unknown id — including one belonging to a different board, which is
  // deliberately indistinguishable — is answered with the way to find a real
  // one, so the agent's next move is obvious rather than a retry.
  it('names the tool that lists the real ids', () => {
    const result = attachmentNotFound('att-nope');
    expect(result.text).toContain('att-nope');
    expect(result.text).toContain('read_map');
    expect(result.structured).toEqual({ found: false });
  });
});

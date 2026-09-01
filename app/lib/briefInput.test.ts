import { describe, expect, it } from 'vitest';
import { parseBriefInput } from './briefInput';

// This is the boundary between an untrusted request body and a map that will
// carry the result forever, since a brief is written once and never edited.
describe('parseBriefInput', () => {
  // The ordinary case: a brief that came out of a file.
  it('reads a complete brief', () => {
    expect(
      parseBriefInput({
        text: '# Spec\n\nBody.',
        sourceName: 'spec.pdf',
        mediaType: 'application/pdf',
      }),
    ).toEqual({
      text: '# Spec\n\nBody.',
      sourceName: 'spec.pdf',
      mediaType: 'application/pdf',
    });
  });

  // A pasted brief genuinely has no filename, so the fallbacks are the normal
  // path rather than a repair.
  it('falls back to pasted defaults when source and type are missing', () => {
    expect(parseBriefInput({ text: 'Just the words.' })).toEqual({
      text: 'Just the words.',
      sourceName: 'pasted',
      mediaType: 'text/plain',
    });
  });

  // Blank strings are as good as absent.
  it('falls back when source and type are blank', () => {
    const brief = parseBriefInput({
      text: 'Body.',
      sourceName: '   ',
      mediaType: '',
    });
    expect(brief?.sourceName).toBe('pasted');
    expect(brief?.mediaType).toBe('text/plain');
  });

  // The text is the client's document; its leading structure is theirs to keep.
  it('keeps the text verbatim rather than trimming it', () => {
    expect(parseBriefInput({ text: '\n  # Spec\n' })?.text).toBe('\n  # Spec\n');
  });

  // A brief with no text in it is not a brief — and every way of expressing
  // that has to reduce to the same single answer.
  it('rejects a brief with no text', () => {
    expect(parseBriefInput({ text: '' })).toBeUndefined();
    expect(parseBriefInput({ text: '   \n\t ' })).toBeUndefined();
    expect(parseBriefInput({ sourceName: 'spec.pdf' })).toBeUndefined();
  });

  // Anything that is not an object shaped like a brief is no brief at all.
  it('rejects values that are not brief objects', () => {
    expect(parseBriefInput(undefined)).toBeUndefined();
    expect(parseBriefInput(null)).toBeUndefined();
    expect(parseBriefInput('a brief')).toBeUndefined();
    expect(parseBriefInput(42)).toBeUndefined();
    expect(parseBriefInput([{ text: 'body' }])).toBeUndefined();
  });

  // A non-string text field is not text, whatever it is.
  it('rejects a non-string text field', () => {
    expect(parseBriefInput({ text: 12345 })).toBeUndefined();
    expect(parseBriefInput({ text: { body: 'hi' } })).toBeUndefined();
  });

  // Wrongly-typed metadata falls back rather than failing the whole brief —
  // the document is what matters, and its packaging is recoverable.
  it('falls back on wrongly typed source and type', () => {
    const brief = parseBriefInput({
      text: 'Body.',
      sourceName: 7,
      mediaType: false,
    });
    expect(brief).toEqual({
      text: 'Body.',
      sourceName: 'pasted',
      mediaType: 'text/plain',
    });
  });
});

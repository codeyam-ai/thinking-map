import { describe, expect, it } from 'vitest';
import {
  approxPages,
  extractionWarning,
  firstLines,
  formatCharCount,
  normalizeBriefText,
  sectionLabel,
  untouchedNoteText,
} from './briefFormat';

// A brief arrives out of a PDF, a Word file, or someone's clipboard, and each
// of those has its own idea of what a line ending is. Everything downstream —
// the section splitter, the character count a person is shown — assumes this
// has already run, so these cases are the contract it depends on.
describe('normalizeBriefText', () => {
  // Windows line endings become newlines, so a .docx and a paste split the same.
  it('converts CRLF to LF', () => {
    expect(normalizeBriefText('one\r\ntwo\r\nthree')).toBe('one\ntwo\nthree');
  });

  // Old Mac-style bare CR too — some exports still emit them.
  it('converts a bare CR to LF', () => {
    expect(normalizeBriefText('one\rtwo')).toBe('one\ntwo');
  });

  // Runs of blank lines collapse to one, so a document padded out by its
  // author does not read to the splitter as a dozen empty paragraphs.
  it('collapses three or more newlines to a paragraph break', () => {
    expect(normalizeBriefText('one\n\n\n\n\ntwo')).toBe('one\n\ntwo');
  });

  // A single blank line IS a paragraph break and must survive.
  it('leaves a single blank line alone', () => {
    expect(normalizeBriefText('one\n\ntwo')).toBe('one\n\ntwo');
  });

  // .docx conversions leave trailing spaces on most lines; they inflate the
  // character count the person is shown for no content at all.
  it('strips trailing spaces and tabs from every line', () => {
    expect(normalizeBriefText('one   \ntwo\t\t\nthree')).toBe('one\ntwo\nthree');
  });

  // Leading indentation inside the document is content — a code block, a
  // quoted clause, a nested list — and only trailing whitespace is stripped.
  // The document's own outer edges are trimmed separately, below.
  it('keeps leading whitespace on a line', () => {
    expect(normalizeBriefText('plain\n    indented')).toBe('plain\n    indented');
  });

  // Surrounding blank space is packaging, not document.
  it('trims the whole document', () => {
    expect(normalizeBriefText('\n\n  hello  \n\n')).toBe('hello');
  });

  // A file that extracted to nothing normalises to the empty string rather
  // than to whitespace, which is what lets the caller detect a failed scan.
  it('reduces a whitespace-only document to an empty string', () => {
    expect(normalizeBriefText('   \n\t\n  ')).toBe('');
  });
});

// The page count exists to give someone a unit they think in. It is shown
// beside the word "about", so being approximate is fine; being zero or
// negative for a document that has words in it is not.
describe('approxPages', () => {
  // A short brief is still one page, never zero.
  it('counts any non-empty document as at least one page', () => {
    expect(approxPages(1)).toBe(1);
    expect(approxPages(400)).toBe(1);
  });

  // Nothing is genuinely nothing.
  it('counts an empty document as zero pages', () => {
    expect(approxPages(0)).toBe(0);
  });

  // A negative count is nonsense input; it must not produce a negative page.
  it('never returns a negative page count', () => {
    expect(approxPages(-500)).toBe(0);
  });

  // Roughly 1,800 characters to the page, rounded.
  it('scales with length', () => {
    expect(approxPages(1800)).toBe(1);
    expect(approxPages(3600)).toBe(2);
    expect(approxPages(21_600)).toBe(12);
  });
});

// This preview is where someone finds out their upload came back empty, so
// what it skips and what it keeps both matter.
describe('firstLines', () => {
  // The ordinary case: the opening lines, in order.
  it('returns the first n lines', () => {
    expect(firstLines('a\nb\nc\nd', 2)).toBe('a\nb');
  });

  // Blank lines are skipped rather than counted — a brief that opens with a
  // heading and two blank lines would otherwise preview as one line.
  it('skips blank lines instead of counting them', () => {
    expect(firstLines('# Title\n\n\nBody one\n\nBody two', 3)).toBe(
      '# Title\nBody one\nBody two',
    );
  });

  // Asking for more lines than exist returns what there is.
  it('returns everything when asked for more lines than the document has', () => {
    expect(firstLines('only line', 5)).toBe('only line');
  });

  // An empty document previews as nothing — which is the signal itself.
  it('returns an empty string for a document with no text', () => {
    expect(firstLines('', 4)).toBe('');
    expect(firstLines('  \n\n \t ', 4)).toBe('');
  });

  // A zero or negative count asks for nothing and gets nothing.
  it('returns an empty string when asked for no lines', () => {
    expect(firstLines('a\nb', 0)).toBe('');
    expect(firstLines('a\nb', -1)).toBe('');
  });
});

const A_BIG_FILE = 80_000;
const A_SMALL_FILE = 900;

// The safety net of the whole intake: this is what tells someone their PDF was
// a photograph, BEFORE they start a map whose source is silently blank.
describe('extractionWarning', () => {
  // A healthy extraction says nothing at all.
  it('stays quiet when a real document came out', () => {
    expect(extractionWarning('x'.repeat(3000), A_BIG_FILE, 'brief.pdf')).toBeNull();
  });

  // Nothing at all came out — the unambiguous scan.
  it('warns when no text came out', () => {
    const warning = extractionWarning('', A_BIG_FILE, 'brief.pdf');
    expect(warning).toContain('No text came out of brief.pdf');
    expect(warning).toContain('paste the text instead');
  });

  // A big file that yielded a handful of characters is the same failure
  // wearing a hat — a scan with one stray caption picked up.
  it('warns when a large file yielded almost no text', () => {
    const warning = extractionWarning('Background', A_BIG_FILE, 'scan.pdf');
    expect(warning).toContain('Only 10 characters');
    expect(warning).toContain('78KB');
  });

  // An unknown or unreadable size must not, on its own, make an empty
  // extraction look healthy. This is the half of the detached-buffer bug that
  // IS decidable here: with a zero size the thin-text rule cannot fire, so the
  // empty-text rule has to stand on its own.
  //
  // The other half — that the size is measured BEFORE extraction, since pdfjs
  // transfers the buffer to its worker and detaches it — lives at the call
  // site in briefText.ts and cannot be reached from a pure function. It was
  // verified against the running app instead; see the prove-red attestation
  // for this feature.
  it('does not treat a zero byte length as a healthy empty extraction', () => {
    expect(extractionWarning('', 0, 'scan.pdf')).not.toBeNull();
  });

  // A genuinely short brief is small on disk too, and warning about it would
  // be noise — someone who pasted two sentences meant to.
  it('stays quiet about a short document that is also a small file', () => {
    expect(extractionWarning('A short brief.', A_SMALL_FILE, 'note.txt')).toBeNull();
  });

  // A file with no name still needs a readable sentence.
  it('names an unnamed file readably', () => {
    expect(extractionWarning('', A_BIG_FILE, '')).toContain(
      'No text came out of that file',
    );
  });
});

// `s7` is the id the splitter derives and the node stores; `§7` is what a
// person reads. This conversion was inlined at four call sites across three
// components before it lived here — three chances for the panel and a pill to
// disagree about what to call the same section.
describe('sectionLabel', () => {
  // The ordinary case: the storage id becomes the display label.
  it('renders a section id as a section mark', () => {
    expect(sectionLabel('s7')).toBe('§7');
  });

  // Ids are sequential and a long brief runs past nine, so the transform must
  // not assume a single digit.
  it('handles a multi-digit section number', () => {
    expect(sectionLabel('s12')).toBe('§12');
  });

  // Only a LEADING `s` is the prefix. Stripping every `s` would mangle an id
  // that happens to contain another one.
  it('strips only the leading prefix', () => {
    expect(sectionLabel('s3s')).toBe('§3s');
  });
});

// The character count is the number that makes an untouched stretch land — a
// section count alone understates it — so it has to read as a quantity rather
// than as an identifier.
describe('formatCharCount', () => {
  // Thousands are grouped, because a bare 12690 reads as an id in a column of
  // otherwise short numbers.
  it('groups thousands', () => {
    expect(formatCharCount(12690)).toBe('12,690');
  });

  // Below a thousand there is nothing to group and no separator should appear.
  it('leaves a short count alone', () => {
    expect(formatCharCount(640)).toBe('640');
  });

  // An empty section is a real state — a heading with nothing under it.
  it('formats zero', () => {
    expect(formatCharCount(0)).toBe('0');
  });
});

// The sentence a person sends the agent when they notice a section nobody has
// dealt with. It rides the existing user-note channel, so its wording IS the
// whole message — no other structure carries the intent.
describe('untouchedNoteText', () => {
  // It names the section both ways: the mark the person just clicked, and the
  // heading, so the agent can find it without another round trip.
  it('names the section by mark and heading', () => {
    const text = untouchedNoteText({
      id: 's4',
      heading: 'What we think we need',
    });
    expect(text).toContain('§4');
    expect(text).toContain('What we think we need');
  });

  // It asks for something rather than only reporting an absence — the point is
  // to get the section dealt with on the agent's next turn.
  it('asks the agent to act rather than only reporting the gap', () => {
    expect(untouchedNoteText({ id: 's4', heading: 'Timeline' })).toMatch(/\?$/);
  });
});

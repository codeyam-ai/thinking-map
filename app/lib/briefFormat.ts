// Pure text handling for briefs — no database, no parsers, no `server-only`.
//
// Deliberately separate from `briefText.ts`, which reaches for `unpdf` and
// `mammoth` and is server-only: the intake component needs to describe a brief
// in the BROWSER, and importing the extraction module to get a page count
// would drag two PDF libraries into the client bundle. Splitting the pure half
// out is also what makes these testable without a DOM or a file.

/** Characters per page, roughly, for a prose document. Used only to give a
 *  person a unit they think in — "about 12 pages" lands where "21,600
 *  characters" does not. */
const CHARS_PER_PAGE = 1800;

/** Below this, a document that arrived as a LARGE file almost certainly
 *  extracted to nothing — the signature of a scanned PDF, which is a
 *  photograph of words rather than words. Both halves matter: a genuinely
 *  short brief is small on disk too, and warning about it would be noise. */
const THIN_EXTRACTION_CHARS = 200;
const LARGE_FILE_BYTES = 50_000;

/**
 * Decide whether an extraction looks like it failed, and say so in a sentence
 * the person can act on.
 *
 * Pure, and separate from the extraction itself, because this judgement is the
 * safety net of the whole intake and the extractor is not testable — it pulls
 * in two PDF libraries and is server-only. It is also where a real bug lived:
 * pdfjs TRANSFERS the upload buffer to its worker, which detaches it, so a
 * caller reading `byteLength` after extracting gets 0 and this warning could
 * never fire for the one file type it exists for. Taking the size as a plain
 * number, measured before extraction, makes that mistake impossible to repeat
 * silently — and pins it with a test.
 *
 * Returns null when the extraction looks healthy. Never throws: a scan is a
 * fact about their file, not a fault in ours.
 */
export function extractionWarning(
  text: string,
  byteLength: number,
  filename: string,
): string | null {
  const named = filename || 'that file';

  if (text.length === 0) {
    return `No text came out of ${named}. If it is a scan, the words are a picture — paste the text instead.`;
  }

  if (text.length < THIN_EXTRACTION_CHARS && byteLength > LARGE_FILE_BYTES) {
    return `Only ${text.length} characters came out of a ${Math.round(
      byteLength / 1024,
    )}KB file. It is probably a scan, and the words are a picture rather than text — check the preview below before you start.`;
  }

  return null;
}

/**
 * Normalise line endings and collapse runs of blank lines.
 *
 * The section splitter downstream is pure and expects consistent input, so
 * doing this once here means it never has to care which word processor a brief
 * came out of. Trailing whitespace goes too: a `.docx` conversion leaves a lot
 * of it, and it inflates the character count the person is shown.
 */
export function normalizeBriefText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * An approximate page count for a brief.
 *
 * Approximate on purpose, and labelled as such wherever it is shown — the
 * document has no pages any more, because only its text was kept. Anything
 * with text in it is at least one page; nothing is zero pages.
 */
export function approxPages(charCount: number): number {
  if (charCount <= 0) return 0;
  return Math.max(1, Math.round(charCount / CHARS_PER_PAGE));
}

/**
 * The first `count` non-empty lines of a document.
 *
 * Blank lines are skipped rather than counted, because a brief that opens with
 * a title and two blank lines would otherwise preview as almost nothing — and
 * this preview is how someone finds out their upload came back empty.
 */
export function firstLines(text: string, count: number): string {
  if (count <= 0) return '';
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, count)
    .join('\n');
}

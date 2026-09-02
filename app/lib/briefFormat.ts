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

/** Past this, a page title stops naming the brief and starts crowding out the
 *  address in a chip that has to truncate somewhere. */
const MAX_TITLE_CHARS = 80;

/**
 * The name a brief pulled off the web carries into the map.
 *
 * The page itself is not kept — only its words are — so this string is the
 * ONLY record of where a fetched brief came from. That is why the address is
 * the half that always survives and the title is the half that is optional:
 * a title can be re-read from the page, and the page can only be found again
 * through the address.
 *
 * Pure, and here rather than in the fetch route, because "what do we call
 * this?" is a question about presenting a brief rather than about retrieving
 * one — and because a rule buried in a handler is a rule nobody can test.
 */
export function briefSourceName(url: URL, title: string | null): string {
  // `host`, not `hostname`: a non-default port is part of where the page
  // lives, and dropping it would name two different pages the same thing.
  const address = `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  const named = title?.trim() ?? '';

  if (named.length === 0 || named.length > MAX_TITLE_CHARS) return address;
  return `${named} — ${address}`;
}

/** What a fetched response turns out to be, and therefore what to do with it. */
export type FetchedContentKind = 'page' | 'text' | 'unsupported';

/**
 * Decide how to read what came back from a URL.
 *
 * Three answers, because there are three real cases: markup whose words are
 * buried in nav and footers, a text or Markdown file that already IS the
 * brief, and a binary this door cannot turn into words at all. Stated once,
 * here, rather than as conditions inside the handler — the distinction decides
 * whether a person gets a clean brief, a brief full of angle brackets, or an
 * honest refusal.
 *
 * A missing content-type reads as a page: it is the web's most common
 * omission, HTML is overwhelmingly the truth behind it, and the extractor's
 * own body fallback copes when it is not.
 */
export function classifyFetchedContent(contentType: string): FetchedContentKind {
  const type = contentType.toLowerCase();

  if (type.trim().length === 0) return 'page';
  if (type.includes('html') || type.includes('xml')) return 'page';
  if (
    type.startsWith('text/') ||
    type.includes('markdown') ||
    type.includes('json')
  ) {
    return 'text';
  }
  return 'unsupported';
}

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

/**
 * A section id as a person reads it: `s7` becomes `§7`.
 *
 * `s7` is the address — what the splitter derives, what a node stores in
 * `sourceRef`, what `read_brief` takes. `§7` is only ever the display of it.
 * Keeping the conversion here rather than inline is what stops the brief panel
 * and a node pill from drifting into calling the same section two things.
 */
export function sectionLabel(sectionId: string): string {
  return `§${sectionId.replace(/^s/, '')}`;
}

/** A character count with grouped thousands. A bare `12690` reads as an id
 *  sitting in a column of otherwise short numbers; `12,690` reads as an
 *  amount, which is the point of showing it. */
export function formatCharCount(charCount: number): string {
  return charCount.toLocaleString('en-US');
}

/**
 * What the person sends the agent when they notice a section nobody has dealt
 * with.
 *
 * This rides the existing `user.note` channel, so the sentence IS the whole
 * message — nothing else carries the intent. It therefore has to name the
 * section twice over: the mark the person just clicked, and the heading, so
 * the agent can go straight to it instead of re-reading the outline to work
 * out which one `§4` was. And it asks a question rather than only reporting an
 * absence, because the point is to get the section dealt with on the next turn.
 */
export function untouchedNoteText(section: {
  id: string;
  heading: string;
}): string {
  return `Nothing on the map accounts for ${sectionLabel(section.id)} "${section.heading}" yet. What does it say, and what should come out of it?`;
}

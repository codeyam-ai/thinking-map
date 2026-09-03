// Folding several fetched pages into the one brief a board is allowed to have.
//
// The card can now be pointed at as many pages as you like, but `MapBrief.mapId`
// is `@unique` and a brief is write-once. That immutability is load-bearing
// rather than incidental: `briefSections` derives `s1..sN` from the text by a
// pure splitter, and nodes cite those ids as provenance, so a brief that could
// change out from under a citation would take the citations with it.
//
// So the several become one HERE, at intake, before anything is written. Each
// page arrives under its own markdown heading, which is exactly what the
// splitter already cuts on — meaning the outline an agent reads back IS the
// list of pages that were attached, in the order they were attached, with ids
// that stay put. No schema change, no new state for `read_brief` to account
// for, and no second way for a document to reach a board.
//
// Pure, and no `server-only`: this runs in the browser, on the way out.

import type { FetchedBrief } from './briefFetch';
import type { BriefInput } from './briefInput';

/** What a merged document honestly is, whatever the pages were made of. */
const MERGED_MEDIA_TYPE = 'text/markdown';

/**
 * A page's name, made safe to be a heading.
 *
 * `briefSections` matches a heading against a WHOLE LINE, so a name carrying a
 * newline would not merely look wrong — it would stop being a heading at all
 * and the page would silently fold into the one above it. Collapsing the
 * whitespace is what keeps the join's promise that every page starts a section.
 */
function asHeading(sourceName: string): string {
  return sourceName.replace(/\s+/g, ' ').trim();
}

/**
 * Turn the pages the card is holding into the single brief the route accepts.
 *
 * Three cases, and the middle one is the whole reason this is a function rather
 * than a template string:
 *
 * - NOTHING attached returns `undefined`, so "no brief" stays one case for the
 *   caller rather than becoming an empty-document special case downstream.
 * - ONE page passes through VERBATIM — no heading added, no media type
 *   rewritten. Wrapping it would shift every section id on the most common map
 *   there is, and would do so to buy nothing at all.
 * - SEVERAL are joined under their own names. The count becomes the source
 *   name, because "3 pages" is what the thing now is; claiming the first page's
 *   name for a document containing three would be a lie the readout repeats.
 *
 * Each page's text is trimmed before joining. Untrimmed, a page ending in two
 * blank lines would meet the next page's heading with a run of empties — which
 * changes nothing for the heading splitter but would leave the joined document
 * carrying whitespace nobody wrote.
 */
export function mergeBriefs(briefs: FetchedBrief[]): BriefInput | undefined {
  if (briefs.length === 0) return undefined;

  if (briefs.length === 1) {
    const [only] = briefs;
    return {
      text: only.text,
      sourceName: only.sourceName,
      mediaType: only.mediaType,
    };
  }

  const text = briefs
    .map((brief) => `# ${asHeading(brief.sourceName)}\n\n${brief.text.trim()}`)
    .join('\n\n');

  return {
    text,
    sourceName: `${briefs.length} pages`,
    mediaType: MERGED_MEDIA_TYPE,
  };
}

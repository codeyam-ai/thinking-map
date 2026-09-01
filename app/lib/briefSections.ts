// Cutting a long brief into passages an agent can ask for by name.
//
// Pure, and deliberately so. The brief text is immutable once written, so a
// pure splitter yields the same `s1..sN` for the same document every time it
// runs — which means section ids are stable WITHOUT a table to keep in sync,
// and a later feature can hang a node's provenance off a section id without
// this file growing a database.
//
// It is also what makes `read_brief` safe: an agent gets an outline it can
// afford to read on every turn, and pulls a single passage when it needs one.
// Nothing here can hand back forty thousand characters by accident.

export interface BriefSection {
  /** `s1`, `s2`, … — stable across runs because the text never changes. */
  id: string;
  index: number;
  heading: string;
  text: string;
  charCount: number;
}

/** Target size for a paragraph-grouped section when the document has no
 *  headings to split on. Chosen so a plain-prose brief still comes back as a
 *  readable handful of passages rather than one wall or a hundred fragments. */
const TARGET_CHARS = 1_800;
const MAX_CHARS = 2_500;

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;

/** The first few words of a passage, used as a stand-in heading when the
 *  document has none. A person scanning the outline needs to recognise the
 *  passage, not read it. */
function impliedHeading(text: string): string {
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  const words = firstLine.trim().split(/\s+/);
  const short = words.slice(0, 9).join(' ');
  return words.length > 9 ? `${short}…` : short;
}

function section(index: number, heading: string, text: string): BriefSection {
  const trimmed = text.trim();
  return {
    id: `s${index}`,
    index,
    heading,
    text: trimmed,
    charCount: trimmed.length,
  };
}

/**
 * Split on markdown headings where the document has them.
 *
 * Any prose before the first heading becomes its own section rather than being
 * dropped — a brief that opens with two paragraphs and only then starts using
 * headings is a normal shape, and those paragraphs are usually the summary.
 */
function splitOnHeadings(lines: string[]): BriefSection[] {
  const sections: BriefSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (!text && heading === null) return;
    if (!text && heading !== null) {
      // A heading with nothing under it is still a real part of the document's
      // shape — a section the client left empty is worth an agent seeing.
      sections.push(section(sections.length + 1, heading, ''));
      return;
    }
    sections.push(
      section(sections.length + 1, heading ?? impliedHeading(text), text),
    );
  };

  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match) {
      flush();
      heading = match[2];
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Group paragraphs up to a target size when there are no headings.
 *
 * A single paragraph longer than the maximum is left whole rather than cut
 * mid-sentence: an oversized passage is a worse outcome than a passage that is
 * hard to read, but a passage severed in the middle of an argument is worse
 * than both.
 */
function splitOnParagraphs(text: string): BriefSection[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const sections: BriefSection[] = [];
  let buffer: string[] = [];
  let size = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const body = buffer.join('\n\n');
    sections.push(section(sections.length + 1, impliedHeading(body), body));
    buffer = [];
    size = 0;
  };

  for (const paragraph of paragraphs) {
    if (size > 0 && size + paragraph.length > MAX_CHARS) flush();
    buffer.push(paragraph);
    size += paragraph.length;
    if (size >= TARGET_CHARS) flush();
  }
  flush();

  return sections;
}

/**
 * Cut a brief into stable, addressable sections.
 *
 * An empty document returns `[]` rather than one empty section — "this brief
 * has no sections" and "this brief has one section containing nothing" are
 * different facts, and an agent should be told the first one plainly.
 */
export function splitIntoSections(text: string): BriefSection[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const lines = trimmed.split('\n');
  if (lines.some((line) => HEADING.test(line))) return splitOnHeadings(lines);
  return splitOnParagraphs(trimmed);
}

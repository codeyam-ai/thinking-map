import type { BriefSection } from './briefSections';

/**
 * Which parts of a client's brief the map actually accounts for.
 *
 * The point of this module is that coverage is COUNTED, never asserted. An
 * agent cannot mark a section "covered"; it can only produce nodes that cite
 * one. So the untouched list is the one thing in the exchange an agent cannot
 * talk its way out of — which is the only reason it is worth showing a client.
 *
 * Pure by design: sections and nodes in, counts out. No database, no React, no
 * brief text on the way out. The page computes this server-side against a
 * document that can be tens of thousands of characters and hands the client
 * only the derived shape — headings and counts — so putting the panel on screen
 * never puts the brief on the wire.
 */

/** The little a node has to say about itself for coverage to count it. */
export interface CoverageNode {
  id: string;
  kind: string;
  label: string;
  /** The brief section this node was derived from, when it came from one. */
  sourceRef?: string | null;
}

/** One section of the brief, with whatever the map has to say about it. */
export interface SectionCoverage {
  id: string;
  heading: string;
  charCount: number;
  /** How many nodes cite this section. Zero is the interesting value. */
  nodeCount: number;
  nodes: CoverageNode[];
  /**
   * A heading with nothing under it — it counts toward neither half.
   *
   * `splitIntoSections` deliberately keeps these, because a section the client
   * left empty is part of the document's shape and worth an agent seeing. But
   * there is nothing in it to account for, so calling it "untouched" would make
   * the headline overstate: a brief whose title line splits off as its own
   * empty section would report one more unread section than it has. Listed,
   * tallied in neither column.
   */
  isEmpty: boolean;
}

/**
 * A node citing a section id the brief does not have.
 *
 * Reported rather than silently dropped. A dangling reference means the node
 * and the document disagree about what the document contains — usually a brief
 * replaced by a shorter one, or an agent inventing a plausible id. Swallowing
 * it would let the covered count quietly overstate itself, which is the exact
 * failure this whole feature exists to prevent.
 */
export interface DanglingRef {
  sourceRef: string;
  nodes: CoverageNode[];
}

export interface BriefCoverage {
  sections: SectionCoverage[];
  /** The sections nothing cites, in document order. The valuable half. */
  untouched: SectionCoverage[];
  /** Sections with content and at least one citing node. */
  covered: number;
  /** Sections there is anything to account for — empty ones are excluded, so
   *  the denominator matches what a reader would count as parts of the brief. */
  total: number;
  /** How much document is untouched. The section count alone understates it:
   *  four short sections and four long ones are not the same finding. */
  untouchedCharCount: number;
  dangling: DanglingRef[];
}

/**
 * Count what the map says about each section of the brief.
 *
 * An empty `sections` (no brief, or a brief that split into nothing) returns a
 * zeroed coverage rather than throwing — "this map has no brief" is a state the
 * workspace renders by mounting no panel at all, not an error.
 */
export function computeBriefCoverage(
  sections: BriefSection[],
  nodes: CoverageNode[],
): BriefCoverage {
  const byId = new Map<string, SectionCoverage>();
  for (const section of sections) {
    byId.set(section.id, {
      id: section.id,
      heading: section.heading,
      charCount: section.charCount,
      nodeCount: 0,
      nodes: [],
      isEmpty: section.charCount === 0,
    });
  }

  const danglingById = new Map<string, DanglingRef>();

  for (const node of nodes) {
    const ref = node.sourceRef;
    // An unreferenced node is the normal case, not a gap: a node the person
    // typed, or one the agent inferred across the whole document, genuinely
    // has no single source section.
    if (!ref) continue;

    const section = byId.get(ref);
    if (section) {
      section.nodeCount += 1;
      section.nodes.push(node);
      continue;
    }

    const existing = danglingById.get(ref);
    if (existing) existing.nodes.push(node);
    else danglingById.set(ref, { sourceRef: ref, nodes: [node] });
  }

  const ordered = sections.map((section) => byId.get(section.id)!);
  // An empty section that something cites is still a real citation, so it
  // counts; an empty section nothing cites is simply not part of the tally.
  const accountable = ordered.filter((s) => !s.isEmpty || s.nodeCount > 0);
  const untouched = accountable.filter((section) => section.nodeCount === 0);

  return {
    sections: ordered,
    untouched,
    covered: accountable.length - untouched.length,
    total: accountable.length,
    untouchedCharCount: untouched.reduce((sum, s) => sum + s.charCount, 0),
    dangling: [...danglingById.values()],
  };
}

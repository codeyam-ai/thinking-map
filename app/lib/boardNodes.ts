// A stored map node, as the board needs it.
//
// The database columns and the board's card are not the same shape, and the
// gap between them is three JSON strings — SQLite has no array column, so a
// shortlist, a set of cited ids and a drawn diagram all arrive as text that
// may or may not parse. Turning that text into something drawable was inline
// in `MapScreen`, which meant the one rule worth holding — what a MALFORMED
// value degrades to — was asserted nowhere.
//
// Every parser below is total: it returns the value or null, and never throws.
// That is the whole opinion. A card that cannot render its options is still a
// question worth asking; an insight whose citations cannot be read is still a
// claim worth showing. Either taking the board down would trade a cosmetic
// loss for the entire map.

import type { GalaxyNodeInput } from './galaxyLayout';
import { readTradeoffs } from './tradeoffs';

/** A node as the store hands it over: the drawable fields flat, the rest as
 *  the JSON strings the columns actually hold. */
export interface StoredNode {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  status: string;
  order: number;
  themeId?: string | null;
  choices?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  diagram?: string | null;
  fromNodeIds?: string | null;
  tradeoffs?: string | null;
  origin?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  testsNodeId?: string | null;
}

/** The stored shortlist. Total: anything unparseable becomes null, and a list
 *  that is empty once trimmed is no shortlist rather than an empty one. */
function parseChoices(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.map((c) => String(c ?? '').trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/** The ids an insight cites. Same degrade-to-null contract, and it matters
 *  more here: a malformed value must yield no citations rather than throw away
 *  the insight that carries it. */
function parseFromNodeIds(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/** The stored diagram. Anything that will not draw becomes null, so the card
 *  degrades to its text. Fewer than two steps is not a flow — drawing one
 *  would have the diagram claim a sequence it does not have. */
function parseDiagram(
  raw: string | null | undefined,
): { steps: string[]; note?: string } | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { steps?: unknown; note?: unknown };
    const steps = Array.isArray(d.steps)
      ? d.steps.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    if (steps.length < 2) return null;
    return typeof d.note === 'string' && d.note.trim()
      ? { steps, note: d.note.trim() }
      : { steps };
  } catch {
    return null;
  }
}

/**
 * Every stored node, in the shape the board draws and the plan reads.
 *
 * One projection, not two. The insight stack, the cards and the plan standing
 * at the far end are all readings of THESE nodes — `origin` and the timestamps
 * for the stack, `order` and `testsNodeId` for the plan — and fetching any of
 * them separately is how two readings of one map came to disagree about what
 * was on it.
 */
export function boardNodesOf(nodes: StoredNode[]): GalaxyNodeInput[] {
  return nodes.map((n) => ({
    id: n.id,
    themeId: n.themeId ?? null,
    kind: n.kind,
    label: n.label,
    detail: n.detail,
    status: n.status,
    choices: parseChoices(n.choices),
    diagram: parseDiagram(n.diagram),
    imageUrl: n.imageUrl ?? null,
    imageAlt: n.imageAlt ?? null,
    origin: n.origin ?? null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    fromNodeIds: parseFromNodeIds(n.fromNodeIds),
    tradeoffs: readTradeoffs(n.tradeoffs),
    order: n.order,
    testsNodeId: n.testsNodeId ?? null,
  }));
}

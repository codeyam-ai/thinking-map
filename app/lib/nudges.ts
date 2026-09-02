// What a well-formed node nudge is.
//
// This rule used to live inside `app/api/maps/[id]/positions/route.ts`, and was
// inlined there when the drag plane was retired on the grounds that a separate
// module for one dead route's validation was more structure than it deserved.
// The framework disagrees for a reason that has nothing to do with taste: a
// route file may export handlers and route config and nothing else, so an
// exported helper beside them fails the generated route-type check. Its own
// comment already said the rule should stay checkable without standing up an
// HTTP request — which is what a module, rather than a route export, is for.

/** One node's arrangement, as a client would ask for it. */
export interface Nudge {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

/**
 * Read a nudge batch off a request body.
 *
 * Returns the parsed batch, or a string carrying the message to send back —
 * the caller decides the status code, this decides what is acceptable.
 *
 * A drag could settle several nodes at once, so the batch is the shape of the
 * request; a lone object is accepted as a batch of one rather than making the
 * common case wrap itself in an array.
 */
export function parseNudges(body: unknown): Nudge[] | string {
  const raw = Array.isArray(body) ? body : [body];
  if (raw.length === 0) return 'Expected at least one node position.';

  const nudges: Nudge[] = [];
  for (const entry of raw) {
    const { nodeId, offsetX, offsetY } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof nodeId !== 'string' || nodeId === '') {
      return '`nodeId` must be a non-empty string.';
    }
    // Finite, not merely numeric: NaN and Infinity are both `typeof number`,
    // and either one written to the column would put a node nowhere.
    if (typeof offsetX !== 'number' || !Number.isFinite(offsetX)) {
      return '`offsetX` and `offsetY` must be finite numbers.';
    }
    if (typeof offsetY !== 'number' || !Number.isFinite(offsetY)) {
      return '`offsetX` and `offsetY` must be finite numbers.';
    }
    nudges.push({ nodeId, offsetX, offsetY });
  }
  return nudges;
}

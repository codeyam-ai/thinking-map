// Validation for the arrangement-write endpoint.
//
// Separate from the route for the reason `exchange.ts` and `contributions.ts`
// are: what counts as a well-formed nudge is a rule about the data, and a rule
// about the data should be checkable without standing up an HTTP request.

/** One node's arrangement, as the client asks for it. */
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
 * A drag can settle several nodes at once, so the batch is the shape of the
 * request; a lone object is accepted as a batch of one rather than making the
 * common case wrap itself in an array.
 */
export function parseNudges(body: unknown): Nudge[] | string {
  const raw = Array.isArray(body) ? body : [body];
  if (raw.length === 0) return 'Expected at least one node position.';

  const nudges: Nudge[] = [];
  for (const entry of raw) {
    const { nodeId, offsetX, offsetY } = (entry ?? {}) as Record<string, unknown>;
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

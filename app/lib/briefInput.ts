// What a brief looks like on its way in, and how an untrusted one is checked.
//
// Its own module because both the API route and `mapStore` need the shape, and
// the route's validation is real logic worth testing on its own rather than a
// few inline `typeof` checks buried in a handler.

/** What a client actually sent, once the words are out of the file. */
export interface BriefInput {
  text: string;
  /** The uploaded filename, or "pasted" when they pasted it in. */
  sourceName: string;
  mediaType: string;
}

/** Fallbacks for a brief that arrived without them. A pasted brief genuinely
 *  has no filename, so this is the normal case rather than a repair. */
const PASTED_SOURCE = 'pasted';
const PASTED_MEDIA_TYPE = 'text/plain';

/**
 * Read a brief off an untrusted request body.
 *
 * A brief with no text in it is not a brief — whitespace, an empty string, a
 * number, a missing key and a null all mean the same thing here, which is that
 * no document came with this request. Returning `undefined` for all of them
 * lets the caller treat "no brief" as one case instead of five.
 *
 * The text is kept VERBATIM, not trimmed: it is the client's document, and its
 * leading structure is theirs. Only its presence is judged.
 */
export function parseBriefInput(raw: unknown): BriefInput | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const { text, sourceName, mediaType } = raw as Record<string, unknown>;
  if (typeof text !== 'string' || text.trim().length === 0) return undefined;

  return {
    text,
    sourceName:
      typeof sourceName === 'string' && sourceName.trim().length > 0
        ? sourceName
        : PASTED_SOURCE,
    mediaType:
      typeof mediaType === 'string' && mediaType.trim().length > 0
        ? mediaType
        : PASTED_MEDIA_TYPE,
  };
}

// What the person brought along with the idea, read back off the map.
//
// The column holds JSON written by the attachments endpoint. The rule enforced
// here is about AVAILABILITY rather than correctness: a board that cannot parse
// its own attachment list must still open. One stray string taking the whole
// page down is a far worse outcome than a board rendering without the list of
// things somebody attached to it.
//
// It lives here rather than in the route because a Next.js page may only export
// the exports the framework knows about — but the better reason is that this is
// pure logic with a rule worth holding somewhere a reader can find it, and a
// route file should be imports and composition.

export interface Attachment {
  name: string;
}

/** Names only, and anything unreadable becomes an empty list. */
export function parseAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a) => String((a as { name?: unknown })?.name ?? '').trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  } catch {
    return [];
  }
}

// What the person brought along with the idea, read back off the map.
//
// The rule this module has always enforced is about AVAILABILITY rather than
// correctness: a board that cannot make sense of its own attachment list must
// still open. One stray value taking the whole page down is a far worse outcome
// than a board rendering without the list of things somebody attached to it.
// That rule survives the move from a JSON column to MapAttachment rows — it
// just applies to a row that cannot be rendered rather than to a string that
// cannot be parsed.
//
// It lives here rather than in the route because a Next.js page may only export
// the exports the framework knows about — but the better reason is that this is
// pure logic with rules worth holding somewhere a reader can find them, and a
// route file should be imports and composition.

export interface Attachment {
  name: string;
  /** Absent on a map rendered from the legacy column, which had no ids. */
  id?: string;
  mediaType?: string;
  byteSize?: number;
  /** Whether there is actually a file behind the name. False for every
   *  attachment recorded before attachments had bytes. */
  hasBytes?: boolean;
}

/**
 * The caps, enforced server-side in the upload route.
 *
 * This is the answer to the size objection the old schema comment raised, and
 * the reason it could be answered rather than waived. They live here, next to
 * the reader, so the strip can say what the limit is in the same words the
 * route refuses with — a cap the person only discovers by hitting it is a cap
 * stated in the wrong place.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MAP = 4;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

/** What the upload route stores and the picker offers. Images first, because
 *  they are the thing this exists for; the document types match what the brief
 *  intake already accepts, so the two doors cannot disagree about a .pdf. */
export const IMAGE_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export const DOCUMENT_MEDIA_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/octet-stream',
] as const;

export function isImage(mediaType: string | undefined): boolean {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType ?? '');
}

export function isAcceptedMediaType(mediaType: string): boolean {
  return (
    isImage(mediaType) ||
    (DOCUMENT_MEDIA_TYPES as readonly string[]).includes(mediaType)
  );
}

/**
 * Truncate a filename for a chip that must not grow wide enough to push the
 * controls beside it out of line.
 *
 * Two characters of headroom so the ellipsis is part of the budget rather than
 * added on top of it — the difference between a chip that fits and one that is
 * one character too wide. Shared by every chip that names a file, at whatever
 * limit its own surface allows, so the three of them cannot drift into
 * truncating at different points.
 */
export function shortenName(name: string, limit: number): string {
  return name.length > limit ? `${name.slice(0, limit - 2)}…` : name;
}

/** Megabytes, for a sentence a person reads. Whole numbers under 1MB would all
 *  round to zero, so the small end keeps a decimal. */
export function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** One MapAttachment row as the shape the board renders. */
export interface AttachmentRow {
  id: string;
  name: string;
  mediaType: string;
  byteSize: number;
  /** Whether the row has bytes. Passed as a boolean rather than the bytes
   *  themselves so a page render never pulls a megabyte out of SQLite to
   *  decide whether to show a thumbnail. */
  hasBytes: boolean;
}

/**
 * Rows to the shape the board renders.
 *
 * A row missing a usable name is dropped rather than rendered blank, on the
 * same availability rule the parser below has always applied: the list is
 * allowed to come back shorter, never to fail.
 */
export function readAttachments(rows: AttachmentRow[]): Attachment[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const name = String(row?.name ?? '').trim();
    if (!name) return [];
    return [
      {
        id: row.id,
        name,
        mediaType: row.mediaType || 'application/octet-stream',
        byteSize: Number(row.byteSize) || 0,
        hasBytes: Boolean(row.hasBytes),
      },
    ];
  });
}

/** Just enough of a stored attachment to decide whether another one fits. */
export interface HeldAttachment {
  byteSize: number;
}

/** Just enough of an incoming file to judge it, so the caps can be checked
 *  without a `File` — the server has an upload, the browser has a File, and
 *  the rules are the same for both. */
export interface IncomingFile {
  name: string;
  type: string;
  size: number;
}

/** Which cap turned a file away. Carried separately from the sentence so a
 *  caller can act on the reason — the upload route maps it to a status code —
 *  without matching on prose that is written to be read by a person. */
export type CapRefusal = 'type' | 'size' | 'count' | 'total';

export type CapVerdict =
  | { ok: true }
  | { ok: false; reason: CapRefusal; error: string };

/**
 * Whether one more file may land on a map, and what to say if not.
 *
 * This is the enforcement. It lives here rather than in the upload route
 * because it is the whole answer to the "size" objection the old schema comment
 * raised, and a rule that can only be exercised through HTTP is a rule nobody
 * checks the edges of.
 *
 * Every refusal names the FILE and a way forward. "Too big" on its own leaves
 * the person holding a file and no idea what to do with it; "try a smaller
 * version, or a screenshot of the part that matters" is the same refusal with
 * the next move in it.
 */
export function fitsAttachmentCaps(
  held: HeldAttachment[],
  file: IncomingFile,
): CapVerdict {
  const mediaType = file.type || 'application/octet-stream';

  if (!isAcceptedMediaType(mediaType)) {
    return {
      ok: false,
      reason: 'type',
      error: `${file.name} is a ${mediaType} — attach an image, a PDF, or a text document instead.`,
    };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: 'size',
      error: `${file.name} is ${formatSize(file.size)}. One attachment can be up to ${formatSize(
        MAX_ATTACHMENT_BYTES,
      )} — try a smaller version, or a screenshot of the part that matters.`,
    };
  }

  if (held.length >= MAX_ATTACHMENTS_PER_MAP) {
    return {
      ok: false,
      reason: 'count',
      error: `This map already has ${MAX_ATTACHMENTS_PER_MAP} attachments, which is the limit. Remove one to add ${file.name}.`,
    };
  }

  // The cap the per-file one cannot catch: four files each comfortably under
  // 5MB still add up.
  const total = held.reduce((sum, row) => sum + row.byteSize, 0);
  if (total + file.size > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      reason: 'total',
      error: `Adding ${file.name} would put this map over ${formatSize(
        MAX_TOTAL_BYTES,
      )} of attachments. Remove something first.`,
    };
  }

  return { ok: true };
}

/**
 * The same rules applied in the browser, before anything is uploaded.
 *
 * A COURTESY, not the enforcement — it saves a round trip and lets a refusal
 * appear the instant somebody pastes, but `fitsAttachmentCaps` on the server is
 * what actually decides. Both are here so the two cannot drift into wording the
 * same refusal differently, which is what happened while this logic lived in
 * two components at once.
 *
 * A batch is admitted PARTIALLY rather than refused whole: one oversize file
 * among four should cost you that one, not the other three.
 */
export function admitFiles(
  existing: { name: string }[],
  incoming: File[],
): { accepted: File[]; error: string | null } {
  const names = new Set(existing.map((f) => f.name));
  let error: string | null = null;

  const fresh = incoming.filter((file) => {
    if (names.has(file.name)) return false;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      error = `${file.name} is ${formatSize(file.size)}. One attachment can be up to ${formatSize(
        MAX_ATTACHMENT_BYTES,
      )} — try a smaller version, or a screenshot of the part that matters.`;
      return false;
    }
    return true;
  });

  const room = Math.max(0, MAX_ATTACHMENTS_PER_MAP - existing.length);
  if (fresh.length > room) {
    error = `You can bring ${MAX_ATTACHMENTS_PER_MAP} things along with an idea. Remove one to add another.`;
  }

  return { accepted: fresh.slice(0, room), error };
}

/**
 * The legacy column: names only, and anything unreadable becomes an empty list.
 *
 * Kept because a database that has not yet run `prisma/backfill-attachments.ts`
 * still has this column populated, and the backfill itself reads through here.
 * Nothing in the app calls it any more.
 */
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

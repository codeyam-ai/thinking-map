// What the agent is handed when it opens one attachment.
//
// Split from `toolRuntime.ts` because the interesting part of `read_attachment`
// is not the lookup — it is the four-way decision about what an attachment even
// IS to a reader that can look at pictures: a picture, a document it can read,
// a document it cannot, or a name with nothing behind it. That decision needs
// no database, and holding it here is what lets each branch be checked directly
// rather than through a tool call.
//
// The through-line in all four: never `isError`. A PDF, or a legacy name, is a
// perfectly ordinary thing to find on a board — the agent should note what is
// there and move on, not retry a call that will never succeed. `read_brief`'s
// no-brief branch sets that precedent and this follows it.

import { formatSize, isImage } from './attachments';
import type { ToolResult } from './toolCatalog';

/** One attachment as the tool needs it: the metadata, and the file if there
 *  is one. `bytes` arrives as Prisma hands it over — a Uint8Array. */
export interface AttachmentForAgent {
  name: string;
  mediaType: string;
  byteSize: number;
  bytes: Uint8Array | null;
}

/** What to say when the id names nothing on this map. Scoped by map, so an id
 *  belonging to another board is indistinguishable from one that never
 *  existed — and both are an ordinary answer with the way forward in it. */
export function attachmentNotFound(attachmentId: string): ToolResult {
  return {
    text: `There is no attachment ${attachmentId} on this map. read_map lists what is attached, with the id for each.`,
    structured: { found: false },
  };
}

/**
 * One attachment, rendered for an agent.
 *
 * An image comes back as a picture with a caption naming it; text comes back as
 * text. The two branches that return neither are the ones worth reading twice:
 *
 *   No bytes — a legacy attachment, recorded when the board stored names only.
 *   It says the file was never stored and suggests asking the person, because
 *   the alternative is an agent inferring the contents of a whiteboard photo
 *   from its filename.
 *
 *   A PDF — the one accepted type that is neither picture nor text. Its
 *   extractor is a Node library the brief intake already owns, and routing a
 *   PDF back through it here would quietly make this tool a second brief
 *   pipeline. Naming the existing door (`read_brief`) beats handing over bytes
 *   that read as noise.
 */
export function attachmentToolResult(
  attachment: AttachmentForAgent,
): ToolResult {
  const { name, mediaType, byteSize, bytes } = attachment;

  if (!bytes) {
    return {
      text: `"${name}" is recorded as attached to this map, but the file itself was never stored — there is nothing to look at. It was attached before this board could hold files. Ask the person about it rather than guessing what it shows.`,
      structured: { found: true, name, hasBytes: false },
    };
  }

  if (isImage(mediaType)) {
    return {
      text: `"${name}" — ${mediaType}, ${formatSize(byteSize)}. The picture follows.`,
      structured: {
        found: true,
        name,
        mediaType,
        byteSize,
        hasBytes: true,
      },
      images: [
        {
          type: 'image',
          data: Buffer.from(bytes).toString('base64'),
          mimeType: mediaType,
        },
      ],
    };
  }

  if (mediaType === 'application/pdf') {
    return {
      text: `"${name}" is a PDF (${formatSize(byteSize)}). This tool hands over pictures and text; a PDF is neither. If its contents matter to the thinking, ask the person to attach it as the brief instead — read_brief reads a document properly, section by section.`,
      structured: {
        found: true,
        name,
        mediaType,
        hasBytes: true,
        readable: false,
      },
    };
  }

  // Prisma hands `Bytes` back as a Uint8Array, whose `toString` takes no
  // encoding — the wrap is what makes this text rather than a list of numbers.
  const text = Buffer.from(bytes).toString('utf8');
  return {
    text: `# ${name}\n(${mediaType}, ${text.length} characters)\n\n${text}`,
    structured: {
      found: true,
      name,
      mediaType,
      charCount: text.length,
      hasBytes: true,
    },
  };
}

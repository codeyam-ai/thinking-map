'use client';

import type { FetchedBrief } from '@/app/lib/briefFetch';
import { useFilePreviews } from '@/app/hooks/useFilePreviews';
import FirstCardAttachmentCount from './FirstCardAttachmentCount';
import FirstCardFileChip from './FirstCardFileChip';
import FirstCardLinkChip from './FirstCardLinkChip';

/**
 * What the first card is carrying, named back to the person.
 *
 * Two kinds of chip, and they are genuinely different things rather than a
 * styling choice. A BROWSED FILE now travels WITH ITS BYTES — it is uploaded
 * once the board exists, so the partner can open it rather than only be told
 * it is there. A LINK travels as TEXT: the server fetched the page and the
 * words are already in hand, so the board gets a real brief the partner can
 * quote. The link chip is the inverted one because it is the brief — the
 * document the board is ABOUT, rather than something brought along with it.
 *
 * An image chip shows the picture. That is not decoration: a pasted screenshot
 * has no useful filename — the clipboard calls it `image.png` — so the
 * thumbnail is the only thing that identifies it, and the only way to catch a
 * mis-paste before it becomes part of the board.
 *
 * Renders nothing when the card is carrying nothing, which is almost every
 * arrival.
 */
export default function FirstCardAttachments({
  briefs,
  files,
  onRemoveBrief,
  onRemoveFile,
}: {
  /** Every page pointed at, in the order they were added. They are all the
   *  brief — merged into one document at start, each under its own heading —
   *  so they all wear the same chip, with no first among them. */
  briefs: FetchedBrief[];
  files: File[];
  onRemoveBrief: (sourceName: string) => void;
  onRemoveFile: (name: string) => void;
}) {
  const previews = useFilePreviews(files);

  if (briefs.length === 0 && files.length === 0) return null;

  return (
    <div className="mb-3">
      <FirstCardAttachmentCount total={briefs.length + files.length} />
      <ul
        // Bounded and scrolling rather than growing. The card is a fixed
        // 440px object whose emptiness is deliberate, and a dozen links would
        // otherwise push the controls off the bottom of it — the same reason
        // the activity rail is capped where it sits.
        aria-label="Attached to this idea"
        className="flex max-h-[164px] flex-wrap gap-2 overflow-y-auto"
      >
        {briefs.map((brief) => (
          <FirstCardLinkChip
            key={brief.sourceName}
            brief={brief}
            onRemove={() => onRemoveBrief(brief.sourceName)}
          />
        ))}
        {files.map((file) => (
          <FirstCardFileChip
            key={file.name}
            file={file}
            previewUrl={previews[file.name]}
            onRemove={() => onRemoveFile(file.name)}
          />
        ))}
      </ul>
    </div>
  );
}

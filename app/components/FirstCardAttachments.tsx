'use client';

import type { FetchedBrief } from '@/app/lib/briefFetch';
import { shortenName } from '@/app/lib/attachments';
import { useFilePreviews } from '@/app/hooks/useFilePreviews';
import FirstCardFileChip from './FirstCardFileChip';

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
  brief,
  files,
  onClearBrief,
  onRemoveFile,
}: {
  brief: FetchedBrief | null;
  files: File[];
  onClearBrief: () => void;
  onRemoveFile: (name: string) => void;
}) {
  const previews = useFilePreviews(files);

  if (!brief && files.length === 0) return null;

  return (
    <ul className="mb-3 flex flex-wrap gap-2">
      {brief ? (
        <li className="flex max-w-full items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[12px] text-[#e4ec4b]">
          <span className="truncate">{shortenName(brief.sourceName, 34)}</span>
          <button
            type="button"
            aria-label={`Remove ${brief.sourceName}`}
            onClick={onClearBrief}
            className="text-[#e4ec4b]/60 hover:text-[#e4ec4b]"
          >
            ×
          </button>
        </li>
      ) : null}
      {files.map((file) => (
        <FirstCardFileChip
          key={file.name}
          file={file}
          previewUrl={previews[file.name]}
          onRemove={() => onRemoveFile(file.name)}
        />
      ))}
    </ul>
  );
}


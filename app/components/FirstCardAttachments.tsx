'use client';

import type { FetchedBrief } from '@/app/lib/briefFetch';

/**
 * What the first card is carrying, named back to the person.
 *
 * Two kinds of chip, and they are genuinely different things rather than a
 * styling choice. A BROWSED FILE travels as a name only — nothing reads it
 * yet, so the board learns that a scope doc exists and no more. A LINK travels
 * as TEXT: the server fetched the page and the words are already in hand, so
 * the board gets a real brief the partner can quote. The link chip is the
 * inverted one because it is the one that is actually carrying something.
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
  if (!brief && files.length === 0) return null;

  return (
    <ul className="mb-3 flex flex-wrap gap-2">
      {brief ? (
        <li className="flex max-w-full items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[12px] text-[#e4ec4b]">
          <span className="truncate">{shorten(brief.sourceName, 34)}</span>
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
        <li
          key={file.name}
          className="flex items-center gap-2 rounded-full bg-black/12 px-3 py-1.5 text-[12px] text-black"
        >
          {shorten(file.name, 26)}
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemoveFile(file.name)}
            className="text-black/50 hover:text-black"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Truncate for a chip that must not grow wide enough to push the card's own
 *  controls out of line. Two characters of headroom so the ellipsis is part of
 *  the budget rather than added on top of it. */
function shorten(name: string, limit: number): string {
  return name.length > limit ? `${name.slice(0, limit - 2)}…` : name;
}

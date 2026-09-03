'use client';

// One file the first card is carrying, before there is a board to put it on.
//
// A separate component from `AttachmentChip` rather than one with a theme prop,
// deliberately: that chip sits on the board's near-black canvas and this one on
// the card's yellow, so every colour in the two is an inversion of the other's.
// A single component parameterised over both would be a wash of conditionals
// around one shape, and the shape is the only thing they share.
//
// The picture comes from an object URL rather than a route, because at this
// point the file exists only in this browser — nothing has been uploaded and
// there is no id to fetch it by.

import { formatSize, isImage, shortenName } from '@/app/lib/attachments';

export default function FirstCardFileChip({
  file,
  previewUrl,
  onRemove,
}: {
  file: File;
  /** Absent for anything that is not an image, and briefly absent for one that
   *  is — the URL is minted in an effect, so the first paint has none. */
  previewUrl?: string;
  onRemove: () => void;
}) {
  const picture = isImage(file.type) ? previewUrl : undefined;

  return (
    <li
      className={`flex items-center gap-2 rounded-full bg-black/12 text-[12px] text-black ${
        picture ? 'py-1 pl-1 pr-3' : 'px-3 py-1.5'
      }`}
    >
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt={file.name}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : null}
      {shortenName(file.name, 24)}
      <span className="text-black/40">{formatSize(file.size)}</span>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="text-black/50 hover:text-black"
      >
        ×
      </button>
    </li>
  );
}


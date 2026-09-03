'use client';

// One thing brought along, on the board's dark canvas.
//
// Its own component because of the decision it owns: whether to show the
// PICTURE or a paperclip. That is not a styling choice — a thumbnail means
// there is a file the partner can actually open, and the paperclip means there
// is a recorded name and nothing behind it. A legacy attachment, from before
// the board could hold files, renders exactly as it always did, and the two
// have to stay tellable apart at a glance.
//
// The image is a plain `<img>` pointed at the byte route rather than bytes
// inlined into the page: a board render must not carry a megabyte per
// attachment, and the route already answers with an immutable cache header
// because an attachment's contents never change once stored.

import {
  formatSize,
  isImage,
  shortenName,
  type Attachment,
} from '@/app/lib/attachments';

export default function AttachmentChip({
  mapId,
  attachment,
  busy,
  onRemove,
}: {
  mapId: string;
  attachment: Attachment;
  busy: boolean;
  onRemove: () => void;
}) {
  const { id, name, mediaType, byteSize, hasBytes } = attachment;
  const showsPicture = isImage(mediaType) && hasBytes && Boolean(id);

  return (
    <li
      className="flex items-center gap-2 rounded-full border border-white/12 py-1.5 pl-1.5 pr-3 text-[12px] text-white/70"
    >
      {showsPicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/maps/${mapId}/attachments/${id}`}
          alt={name}
          // Stated rather than left to the stylesheet: the chip is laid out
          // before the bytes arrive, and an image with no intrinsic size
          // reflows the whole strip the moment they do.
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="ml-1.5 shrink-0"
        >
          <path
            d="M21 11.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {shortenName(name, 24)}
      {/* A legacy row has no size to state, and `formatSize` returns nothing
          for it — so the span is omitted rather than rendering an empty gap. */}
      {byteSize ? (
        <span className="text-white/30">{formatSize(byteSize)}</span>
      ) : null}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        disabled={busy}
        onClick={onRemove}
        className="text-white/35 hover:text-white"
      >
        ×
      </button>
    </li>
  );
}

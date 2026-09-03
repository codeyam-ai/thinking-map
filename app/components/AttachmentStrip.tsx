'use client';

// The row of things you are about to bring along, under the prompt.
//
// This is the only way a person can tell what they actually attached, and the
// only way to undo a mis-paste — which matters more here than anywhere else in
// the intake, because pasting is a gesture with no file picker in front of it.
// Press ⌘V over the wrong window and something arrives that you never chose by
// name; a strip that shows the picture is what makes that recoverable.
//
// It renders the image itself rather than a filename, because a pasted
// screenshot HAS no useful filename — the clipboard calls it `image.png` — so
// the thumbnail is the only thing that identifies it. A document has a name
// worth reading and gets a chip instead.
//
// Pre-creation only: these are files held in browser memory, before the map
// exists to attach them to. Once the map is created they are uploaded and the
// board's own `CoreAttachments` takes over.

import { formatSize, isImage } from '@/app/lib/attachments';
import { useFilePreviews } from '@/app/hooks/useFilePreviews';

export default function AttachmentStrip({
  files,
  busy = false,
  onRemove,
}: {
  files: File[];
  busy?: boolean;
  onRemove: (name: string) => void;
}) {
  // The object URLs and their revocation belong to the hook, not to this
  // component or to its parent — a rendering should not own a lifecycle.
  const previews = useFilePreviews(files);

  if (files.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attached to this idea">
      {files.map((file) => {
        const preview = isImage(file.type) ? previews[file.name] : undefined;
        return (
          <li
            key={file.name}
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 text-[12.5px] text-ink-soft"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={file.name}
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper text-[10px] uppercase text-muted"
              >
                {extension(file.name)}
              </span>
            )}
            <span className="max-w-[160px] truncate">{file.name}</span>
            <span className="text-muted">{formatSize(file.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              disabled={busy}
              onClick={() => onRemove(file.name)}
              className="text-muted transition hover:text-ink disabled:opacity-40"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Three letters at most, so a `.markdown` does not stretch the disc. A file
 *  with no extension gets a paperclip's worth of nothing rather than a stray
 *  dot. */
function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '•';
  return name.slice(dot + 1, dot + 4);
}

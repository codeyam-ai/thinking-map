'use client';

import { useRef, useState } from 'react';

/** What the picker will offer, and what the extractor can actually read.
 *  Kept together so the two never drift apart. */
const ACCEPT =
  '.pdf,.docx,.md,.txt,application/pdf,text/plain,text/markdown';

/**
 * The resting state of the intake: drop a document, choose one, or paste.
 *
 * Dashed rather than solid, in the same language the map uses for a thought
 * that is not finished yet — nothing has been committed here, and the whole
 * panel disappears the moment a brief is in hand.
 */
export default function BriefDropTarget({
  busy,
  error,
  onFile,
  onPaste,
}: {
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onPaste: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mt-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`rounded-[28px] border border-dashed px-7 py-6 text-center transition ${
          dragging ? 'border-ink bg-surface' : 'border-line'
        }`}
      >
        <p className="text-[14px] text-ink-soft">
          {busy ? 'Reading it…' : 'Working from a brief? Drop the document here.'}
        </p>

        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-40"
          >
            Choose a file
          </button>
          <button
            type="button"
            onClick={onPaste}
            disabled={busy}
            className="text-[13px] text-muted underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-40"
          >
            Paste it instead
          </button>
        </div>

        <p className="mt-3 text-[12.5px] text-muted">
          PDF, Word, Markdown or plain text
        </p>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            // Reset so choosing the same file twice still fires a change.
            e.target.value = '';
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-center text-[13px] text-risk">
          {error}
        </p>
      ) : null}
    </div>
  );
}

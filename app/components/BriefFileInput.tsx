'use client';

import { forwardRef } from 'react';

/** What the picker will offer, and what the extractor can actually read.
 *  Kept together so the two never drift apart. */
export const ACCEPT =
  '.pdf,.docx,.md,.txt,application/pdf,text/plain,text/markdown';

/**
 * The intake, with the panel taken off it.
 *
 * This was a dashed box three lines tall advertising drag-and-drop; the
 * advertisement now lives in `BriefMenu` and the drop target is the whole form,
 * so what remains is the mechanism: a hidden file picker its parent opens, and
 * the one line of error the upload can produce. It renders nothing at rest.
 */
const BriefFileInput = forwardRef<
  HTMLInputElement,
  { error: string | null; onFile: (file: File) => void }
>(function BriefFileInput({ error, onFile }, ref) {
  return (
    <>
      <input
        ref={ref}
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
      {error ? (
        <p role="alert" className="mt-3 text-center text-[13px] text-risk">
          {error}
        </p>
      ) : null}
    </>
  );
});

export default BriefFileInput;

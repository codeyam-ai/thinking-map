'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The other way in: paste the words.
 *
 * Not a fallback for when upload fails — a first-class door. A client who
 * cannot get their document out of the system it lives in still has the text,
 * and the text is all this product ever wanted from the file.
 */
export default function BriefPasteBox({
  defaultText = '',
  onAttach,
  onCancel,
}: {
  /** What the box starts with. Empty in the app — nobody has typed yet — and
   *  the seam a scenario uses to show the box holding a real document. */
  defaultText?: string;
  onAttach: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(defaultText);
  const box = useRef<HTMLTextAreaElement>(null);

  // Focused on mount, because someone who just chose "paste it instead" is
  // about to paste. Done through a ref rather than `autoFocus`: browsers block
  // autofocus inside a cross-origin frame and say so on the console, which
  // fails every captured scenario of this component for a reason that has
  // nothing to do with the component. A programmatic focus that is refused
  // simply does nothing.
  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <div className="mt-5 rounded-[28px] border border-line bg-surface px-7 py-6">
      <label htmlFor="brief-text" className="eyebrow">
        Paste the brief
      </label>
      <textarea
        id="brief-text"
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="Paste the whole thing. Length is not a problem — it is the point."
        className="mt-3 w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] leading-[1.55] text-ink outline-none placeholder:text-muted focus:border-ink"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onAttach(text.trim())}
          disabled={text.trim().length === 0}
          className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          Attach it
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

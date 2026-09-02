'use client';

import { useEffect, useRef } from 'react';

/**
 * The address field, inside the first card.
 *
 * Inline rather than a popover: the card is mostly empty by design, and that
 * empty space is exactly the room to ask for one more thing without covering
 * the question the card exists to ask.
 *
 * A sibling of `BriefLinkBox` in behaviour and a stranger to it in dress — the
 * two live on surfaces with opposite palettes, black-on-yellow here and ink-on
 * -paper there, so sharing one component would mean threading a theme through
 * it to serve two callers. Kept separate on purpose; if a third surface ever
 * wants one, that is the moment to reconsider.
 */
export default function FirstCardLinkBox({
  url,
  reading,
  onChange,
  onAttach,
  onCancel,
}: {
  url: string;
  /** True while the page is being fetched — the field locks and the button
   *  says what is happening rather than inviting a second attempt. */
  reading: boolean;
  onChange: (next: string) => void;
  onAttach: () => void;
  onCancel: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  // Focused on mount through a ref rather than `autoFocus`: browsers refuse
  // autofocus inside a cross-origin frame and say so on the console, which
  // fails a captured scenario for a reason that has nothing to do with the
  // card. A programmatic focus that is refused simply does nothing.
  useEffect(() => {
    field.current?.focus();
  }, []);

  return (
    <div className="mb-3 rounded-2xl bg-black/10 p-3">
      <label htmlFor="first-card-url" className="sr-only">
        Link to a page
      </label>
      <input
        id="first-card-url"
        ref={field}
        type="url"
        value={url}
        onChange={(e) => onChange(e.target.value)}
        // Enter here means "attach this link". Without catching it the
        // keystroke would reach the card's own send and start a board on an
        // idea the person has not typed yet.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAttach();
          }
          if (e.key === 'Escape') onCancel();
        }}
        disabled={reading}
        placeholder="https://…"
        // A drawn border, unlike the card's own borderless textarea: that one
        // is the card's whole subject and needs no frame to be found, while
        // this is a small field inside a yellow panel and reads as stray text
        // without one.
        className="w-full rounded-xl border border-black/25 bg-black/5 px-3 py-2 text-[14px] text-black outline-none placeholder:text-black/40 focus:border-black/60 disabled:opacity-50"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onAttach}
          disabled={reading || url.trim().length === 0}
          className="rounded-full bg-black px-3.5 py-1.5 text-[12.5px] text-[#e4ec4b] transition-opacity disabled:opacity-30"
        >
          {reading ? 'Reading it…' : 'Attach it'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12.5px] text-black/50 hover:text-black"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

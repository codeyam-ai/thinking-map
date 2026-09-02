'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The third way in: point at the page.
 *
 * A great many briefs are neither a file nor something you would paste — they
 * are a Notion doc, a public spec, a client's own site. The door is the same
 * shape as `BriefPasteBox` on purpose: one field, one primary button, one way
 * out. Copying that shape is what keeps the intake from becoming three
 * different conversations depending on which item you picked.
 *
 * It reports the address and stops there. Fetching a stranger's URL is a
 * server's job — the browser is blocked by CORS on almost every page worth
 * attaching — so the retrieval, and the guard around it, live behind
 * `/api/briefs/fetch`.
 */
export default function BriefLinkBox({
  defaultUrl = '',
  onAttach,
  onCancel,
}: {
  /** What the field starts with. Empty in the app — nobody has typed yet — and
   *  the seam a scenario uses to show the box holding a real address. */
  defaultUrl?: string;
  onAttach: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const box = useRef<HTMLInputElement>(null);

  // Focused on mount, for the same reason and by the same mechanism as the
  // paste box: someone who just chose "add a link" is about to paste one, and
  // `autoFocus` is refused inside a cross-origin frame loudly enough to fail
  // every captured scenario of this component.
  useEffect(() => {
    box.current?.focus();
  }, []);

  const ready = url.trim().length > 0;

  function attach() {
    if (ready) onAttach(url.trim());
  }

  return (
    <div className="mt-5 rounded-[28px] border border-line bg-surface px-7 py-6">
      <label htmlFor="brief-url" className="eyebrow">
        Link to the brief
      </label>
      <input
        id="brief-url"
        ref={box}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        // The box is inside a form whose submit starts a map. Enter here means
        // "attach this link", so it is caught rather than allowed to send.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attach();
          }
        }}
        placeholder="https://…"
        className="mt-3 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] leading-[1.55] text-ink outline-none placeholder:text-muted focus:border-ink"
      />
      <p className="mt-2 text-[12px] text-muted">
        We read the page and keep the words, not the layout.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={attach}
          disabled={!ready}
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

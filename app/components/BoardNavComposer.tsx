'use client';

// Saying something that fits on no card, from the bar.
//
// Collapsed to a single word until you want it. The panel this replaced was
// always open and always growing, which is the trade it made: the channel was
// obvious, and it covered the thing being talked about. A button that opens a
// field is the other side of that trade — one press to reach, and the board is
// uncovered every second you are not typing.
//
// It closes on send rather than staying open. There is no transcript to watch
// any more, so an open field after sending would sit there implying a reply is
// about to appear in it; the map is where the reply lands.

import { useEffect, useRef, useState } from 'react';

export default function BoardNavComposer({
  onSend,
  onTyping,
}: {
  /** Called with the trimmed text, never with an empty string. */
  onSend: (text: string) => void;
  /** Fires on every keystroke, including the ones that empty the box again —
   *  a signal that someone is composing rather than that a draft exists. The
   *  round's countdown listens for it: someone mid-sentence has not finished,
   *  whatever the board's counts say. */
  onTyping?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);

  // Opening a field nobody can type in without a second click is a button that
  // did half its job.
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 whitespace-nowrap rounded-full border border-white/20 px-4 py-1.5 text-[12.5px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
      >
        Chat
      </button>
    );
  }

  return (
    // A fixed comfortable width rather than `flex-1`. The bar's spacer is
    // already flexible, so two growing children would split the row between
    // them and the field's width would depend on how many questions the count
    // beside it happens to name.
    <div className="flex w-[320px] max-w-full shrink items-center gap-2 rounded-full border border-white/20 py-1 pl-4 pr-1">
      <input
        ref={field}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onTyping?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key !== 'Enter') return;
          e.preventDefault();
          send();
        }}
        placeholder="Change direction, push back…"
        className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-white outline-none placeholder:text-white/35"
      />
      <button
        type="button"
        onClick={send}
        disabled={!draft.trim()}
        aria-label="Send"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-opacity disabled:opacity-25"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12h13M12 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

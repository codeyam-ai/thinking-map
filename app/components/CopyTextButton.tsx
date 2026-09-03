'use client';

// A small copy control that sits on top of something already drawn.
//
// It exists because panning the board suppresses text selection: a drag on a
// card moves the map, so the words on the map cannot be swiped over any more.
// Wherever you would have wanted to select, there is a button instead.
//
// NOT `CopyablePrompt`, which renders the text *and* a button — it is the block
// whose whole purpose is to be copied. Here the text is already on the card and
// this is an icon beside it. What IS taken from `CopyablePrompt`, deliberately,
// is the behaviour: the clipboard call, the `catch` that refuses to claim a
// success that did not happen, and the live-region label so the confirmation is
// audible rather than only a swapped glyph.
//
// Visible on hover, on keyboard focus, and whenever its card is the focused one.
// Hover-only would make it invisible in every captured scenario, and on this
// project a state no scenario can show is a state nobody has seen.

import { useEffect, useRef, useState } from 'react';

/** How long the tick stays before the button goes back to offering the copy. */
const CONFIRM_MS = 2000;

export default function CopyTextButton({
  text,
  label,
  accent,
  visible = false,
  className = '',
}: {
  /** Exactly what lands on the clipboard. */
  text: string;
  /** The accessible name — "Copy this question", not "Copy". Several of these
   *  can be on screen at once, so a shared name would leave a screen reader
   *  reading out the same control four times. */
  label: string;
  /** The card's own colour, so the control reads as part of what it sits on. */
  accent: string;
  /** Its card is the focused one, so show it without needing a hover. */
  visible?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A card can unmount while the tick is still showing — the board re-lays out
  // under it — and a timer firing into a gone component is a state update on
  // nothing.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      aria-label={label}
      // `data-no-pan` so the press belongs to this button rather than starting a
      // board gesture, and `stopPropagation` so it does not also focus the card
      // underneath: copying from a card you can already read should not move the
      // board to it.
      data-no-pan
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
          })
          // A refused clipboard must not flip the label. The text is still on
          // the card, so there is something to fall back to — but only if the
          // button has not just claimed the job is done.
          .catch(() => setCopied(false));
      }}
      className={`rounded-full p-1.5 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 ${
        visible ? 'opacity-70' : 'opacity-0'
      } ${className}`}
      style={{ color: accent }}
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="9"
            y="9"
            width="11"
            height="11"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M5.5 15H5a1 1 0 01-1-1V5a1 1 0 011-1h9a1 1 0 011 1v.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
      {/* The visual confirmation is a swapped glyph, which a screen reader has
          no way to notice. The live region is how the flip is announced. */}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}

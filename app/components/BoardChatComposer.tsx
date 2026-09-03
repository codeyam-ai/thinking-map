'use client';

// Where you say something about the whole map.
//
// It owns the draft rather than lifting it, because nothing above it needs to
// know what is half-typed — and a draft held higher would be one more thing to
// preserve across the panel's open, collapsed and closed states.
//
// Enter and the button are one path, not two: `send` is written once and both
// call it, so an empty message cannot be rejected by one route and accepted by
// the other.

import { useState } from 'react';

export default function BoardChatComposer({
  onSend,
  onTyping,
}: {
  /** Called with the trimmed text. Never called with an empty string — a blank
   *  turn in the transcript reads as the person having said nothing on
   *  purpose. */
  onSend: (text: string) => void;
  /** Called on every keystroke, including the ones that empty the box again.
   *  It is a signal that someone is composing, not that a draft exists — which
   *  is why it carries no text and fires on deletions too. */
  onTyping?: () => void;
}) {
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onTyping?.();
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          send();
        }}
        placeholder="Say anything — change direction, push back…"
        className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-white outline-none placeholder:text-white/35"
      />

      <button
        type="button"
        onClick={send}
        disabled={!draft.trim()}
        aria-label="Send"
        // White on the board, matching the round control in the same bar — the
        // two sit inches apart and used to be two different limes.
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-opacity disabled:opacity-25"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

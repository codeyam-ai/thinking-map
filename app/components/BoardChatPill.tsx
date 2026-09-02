'use client';

// All that is left of the conversation when it is closed.
//
// Closing has to genuinely uncover the board — that is the whole reason the
// state exists — so this is the smallest thing that can still be found. It is
// not a decoration: without it, closing the panel would be a one-way door, and
// nobody closes a thing they cannot get back.

export default function BoardChatPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-full border border-white/12 bg-black/85 px-4 py-2.5 text-[13px] text-white/70 backdrop-blur-md transition-colors hover:text-white"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Chat
    </button>
  );
}

'use client';

// The panel's chrome: what this channel is, and the two ways to get it out of
// the way.
//
// The label earns its place. The code has always documented this input as the
// slot for "everything the partner did not think to ask about" — but the only
// thing on screen saying so was a placeholder, and a sentence is not a label.
// Naming it is what turns a general channel into a visible affordance.
//
// Collapse and close are different promises, so they are different controls.
// Collapse keeps the input row: the conversation is still here, you just are
// not reading it. Close leaves the board genuinely uncovered.

export default function BoardChatHeader({
  open,
  onToggle,
  onClose,
}: {
  /** Whether the transcript is showing — decides which way the chevron points. */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <span className="flex-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
        Chat
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Hide the conversation' : 'Show the conversation'}
        className="shrink-0 text-white/35 transition-colors hover:text-white/80"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ transform: open ? 'none' : 'rotate(180deg)' }}
        >
          <path
            d="M6 15l6-6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close the conversation"
        className="shrink-0 text-white/35 transition-colors hover:text-white/80"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

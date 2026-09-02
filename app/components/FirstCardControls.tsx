'use client';

/**
 * The row along the bottom of the first card: the ways in on the left, the way
 * on to the board at the right.
 *
 * Two attach buttons rather than a menu. Two choices is not a menu's worth of
 * choice, and putting them behind one would hide the very thing the labels are
 * there to say — that this card takes a document or a page, not just a
 * sentence.
 */
export default function FirstCardControls({
  busy,
  canStart,
  linkDisabled,
  onBrowse,
  onLink,
  onStart,
}: {
  busy: boolean;
  /** Whether there is anything to start a board FROM — a typed idea or an
   *  attached brief. Either is enough; neither is not. */
  canStart: boolean;
  /** True once a brief is in hand: there is one brief per board, so offering a
   *  second link is offering to lose the first. */
  linkDisabled: boolean;
  onBrowse: () => void;
  onLink: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBrowse}
          className="flex items-center gap-2 rounded-full bg-black/12 px-4 py-2 text-[13px] font-medium text-black hover:bg-black/20"
        >
          {/* A paperclip, so the control reads as "attach" before the label
              is read at all. */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M21 11.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Browse
        </button>

        {/* The third door, and the only one whose contents actually reach the
            board as words. */}
        <button
          type="button"
          onClick={onLink}
          disabled={linkDisabled}
          className="rounded-full bg-black/12 px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:bg-black/20 disabled:opacity-30"
        >
          Add a link
        </button>
      </div>

      {/* The affordance is a button, not a sentence. "Press enter" told you the
          shortcut but gave you nothing to aim at — and on a card whose whole
          job is to be filled in and sent, the send has to be a thing you can
          hit. Enter still works. */}
      <button
        type="button"
        onClick={onStart}
        disabled={busy || !canStart}
        aria-label="Start your board"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-[#e4ec4b] transition-opacity disabled:opacity-30"
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-[#e4ec4b]" />
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h13M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

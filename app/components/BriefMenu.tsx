'use client';

import { useCallback, useRef, useState } from 'react';
import { useDismissOnOutside } from '../hooks/useDismissOnOutside';

/**
 * The whole brief intake, stated in a line of width instead of 140px of height.
 *
 * Attaching a document is a capability, not a step — most arrivals type a
 * sentence and never touch it — so it sits inside the input's own frame and
 * opens a three-item menu rather than occupying a panel above the fold. Once a
 * document is in hand the button becomes a chip naming it, so the state is
 * still visible without the panel.
 *
 * The trigger says what it takes rather than showing a bare `+`. That `+` was
 * the reason drag-and-drop read as missing when it had worked all along: a
 * symbol with no noun invites nobody to drop anything on it. The label states
 * what is TRUE today — a doc or a link — and will have to change again when
 * images land, which is the correct trade against advertising a door that is
 * not built yet.
 *
 * Drag-and-drop is unaffected: the form itself is the drop target, and this
 * menu is the advertisement the dashed panel used to be.
 */
export default function BriefMenu({
  busy,
  attachedName = null,
  onChooseFile,
  onPaste,
  onLink,
}: {
  busy: boolean;
  /** The attached brief's source name, or null when nothing is attached. */
  attachedName?: string | null;
  onChooseFile: () => void;
  onPaste: () => void;
  onLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A menu that outlives the intent to use it is in the way. Close it on the
  // three gestures that all mean "not this": clicking away, Escape, choosing —
  // the first two shared with every other overlay on the app, the third below.
  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutside(root, open, close);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={root} className="absolute top-1/2 left-3 -translate-y-1/2">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          attachedName ? `Brief attached: ${attachedName}` : 'Attach a brief'
        }
        // Neutral tokens on purpose. The design system spends `--lime` on the
        // single node that just changed, and a permanent control wearing it
        // would retire that meaning everywhere else.
        className={`flex h-[40px] max-w-[160px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition disabled:opacity-40 ${
          attachedName
            ? 'border-ink bg-surface text-ink'
            : 'border-line bg-surface text-ink-soft hover:border-ink hover:text-ink'
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="shrink-0"
        >
          {/* A paperclip: the one shape that says "attach" without a word. */}
          <path
            d="M10.8 5.2 6.3 9.7a1.6 1.6 0 0 0 2.3 2.3l4.6-4.6a3 3 0 0 0-4.3-4.3L4.1 7.9a4.4 4.4 0 0 0 6.2 6.2l3.4-3.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="truncate">{attachedName ?? 'Add a doc or link'}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Attach a brief"
          // Opens DOWNWARD: the space under the input is empty, and opening up
          // would put the menu over the question the screen exists to ask.
          className="absolute top-[calc(100%+10px)] left-0 z-20 w-[200px] overflow-hidden rounded-[20px] border border-line bg-surface py-1.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onChooseFile)}
            className="block w-full px-4 py-2.5 text-left text-[13.5px] text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            Upload a file
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onPaste)}
            className="block w-full px-4 py-2.5 text-left text-[13.5px] text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            Paste a brief
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onLink)}
            className="block w-full px-4 py-2.5 text-left text-[13.5px] text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            Add a link
          </button>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The whole brief intake, stated in 28px of width instead of 140px of height.
 *
 * Attaching a document is a capability, not a step — most arrivals type a
 * sentence and never touch it — so it sits as a `+` inside the input's own
 * frame and opens a two-item menu rather than occupying a panel above the fold.
 * Once a document is in hand the button becomes a chip naming it, so the state
 * is still visible without the panel.
 *
 * Drag-and-drop is unaffected: the form itself is the drop target, and this
 * menu is the advertisement the dashed panel used to be.
 */
export default function BriefMenu({
  busy,
  attachedName = null,
  onChooseFile,
  onPaste,
}: {
  busy: boolean;
  /** The attached brief's source name, or null when nothing is attached. */
  attachedName?: string | null;
  onChooseFile: () => void;
  onPaste: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A menu that outlives the intent to use it is in the way. Close it on the
  // three gestures that all mean "not this": clicking away, Escape, choosing.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
        className={`flex h-[40px] items-center justify-center rounded-full border transition disabled:opacity-40 ${
          attachedName
            ? 'max-w-[160px] gap-1.5 border-ink bg-surface px-3 text-[12.5px] text-ink'
            : 'w-[40px] border-line bg-surface text-ink-soft hover:border-ink hover:text-ink'
        }`}
      >
        {attachedName ? (
          <span className="truncate">{attachedName}</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 3.5 V12.5 M3.5 8 H12.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
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
        </div>
      ) : null}
    </div>
  );
}

'use client';

// The way out of a board.
//
// Replaces the phase track that used to sit here. That track listed six stages
// — Idea, Deconstruct, Map, Research, Explore, Next steps — as though the
// person were meant to walk through them in order. The board does not work that
// way any more: the lines of thinking are named by what they are ABOUT, they
// open and close as the thinking goes, and the arc from idea to conclusion is
// drawn on the board itself. A stage indicator over a board that already shows
// its own progress is a second, less accurate answer to the same question.
//
// What was actually missing is what a person needs at the top of a page they
// might be done with: a way to start something else, and a way back to what
// they were working on before.

import { useEffect, useRef, useState } from 'react';

export interface BoardMenuMap {
  id: string;
  title: string;
}

export default function BoardMenu({
  maps,
  currentId,
}: {
  /** Other boards, newest first. */
  maps: BoardMenuMap[];
  currentId?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on an outside click or on Escape. A menu that can only be closed by
  // the button that opened it is a trap on a surface where every other click
  // pans a canvas.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const others = maps.filter((m) => m.id !== currentId);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full border border-black/15 px-4 py-2 text-[13px] font-medium text-black/70 transition-colors hover:border-black/40 hover:text-black"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Boards
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[330px] overflow-hidden rounded-[16px] border border-white/12 bg-[#0b0b0c] shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
        >
          <a
            href="/"
            role="menuitem"
            className="flex items-center gap-3 border-b border-white/8 px-5 py-4 text-[14px] font-semibold text-[#e4ec4b] hover:bg-white/5"
          >
            <span className="text-[17px] leading-none">+</span>
            Start a new board
          </a>

          {others.length > 0 ? (
            <>
              <p className="px-5 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Earlier boards
              </p>
              <ul className="max-h-[300px] overflow-y-auto pb-2">
                {others.map((m) => (
                  <li key={m.id}>
                    <a
                      href={`/map/${m.id}`}
                      role="menuitem"
                      className="block truncate px-5 py-2.5 text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      {m.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-5 py-4 text-[13px] text-white/35">
              This is your only board so far.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

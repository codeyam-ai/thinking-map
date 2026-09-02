'use client';

// The chat, over the whole map.
//
// It replaced a thin bar at the bottom, and the difference is not cosmetic. A
// bar reads as a control belonging to the board — one more widget beside the
// zoom buttons — and what you typed into it vanished with no trace that anyone
// had heard you. A panel that sits ABOVE the map says the true thing: this is
// the conversation, the map is what the conversation has produced so far, and
// what you say here applies to all of it rather than to whichever card is
// nearest.
//
// It also keeps the exchange visible. Every note, every answer, every time the
// partner wrote back — in order. Without that, a person answering cards has no
// way to see the shape of what they have already said.

import { useEffect, useRef, useState } from 'react';
import type { ExchangeEvent } from '@/app/lib/exchange';

/** What the log's kinds look like when read as a conversation. */
function line(e: ExchangeEvent): { who: 'you' | 'partner'; text: string } | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case 'user.note':
      return { who: 'you', text: String(p.text ?? '') };
    case 'user.answer': {
      const answers = Array.isArray(p.answers) ? p.answers : [];
      const said = answers
        .map((a) => String((a as { answer?: unknown })?.answer ?? '').trim())
        .filter(Boolean)
        .join(' · ');
      return said ? { who: 'you', text: said } : null;
    }
    case 'agent.note':
      return { who: 'partner', text: String(p.text ?? '') };
    case 'question.asked': {
      const qs = Array.isArray(p.questions) ? p.questions : [];
      // The recorded shape is `{ id, text }` per question — see the
      // `question.asked` write in `toolRuntime`. Stringifying the object gave
      // every agent-asked question the bubble "[object Object]". A bare string
      // is still accepted because it costs nothing and a log written by an
      // older or hand-rolled caller should degrade to its words, not to noise.
      const asked = qs
        .map((q) =>
          typeof q === 'string'
            ? q.trim()
            : String((q as { text?: unknown })?.text ?? '').trim(),
        )
        .filter(Boolean);
      return asked.length ? { who: 'partner', text: asked.join(' · ') } : null;
    }
    default:
      // node.added, theme.added, phase.set and friends are things you can SEE
      // on the board. Narrating them here would make the panel a changelog of
      // a picture the person is already looking at.
      return null;
  }
}

export default function BoardChat({
  events,
  onSend,
  trailing,
}: {
  events: ExchangeEvent[];
  onSend: (text: string) => void;
  /** The round control, when there is a round to end. */
  trailing?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  const lines = events.map(line).filter(Boolean) as {
    who: 'you' | 'partner';
    text: string;
  }[];

  // Stay pinned to the newest. A transcript that keeps its scroll position
  // while new turns arrive below the fold is a transcript you have to chase.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, open]);

  return (
    <div
      className="pointer-events-auto absolute bottom-6 left-1/2 z-30 w-[min(720px,90%)] -translate-x-1/2"
      data-no-pan
    >
      <div className="overflow-hidden rounded-[22px] border border-white/12 bg-black/85 backdrop-blur-md">
        {open && lines.length > 0 ? (
          <div
            ref={scroller}
            className="max-h-[230px] overflow-y-auto px-5 pb-2 pt-4"
          >
            {lines.map((l, i) => (
              <div
                key={i}
                className={`mb-2.5 flex ${l.who === 'you' ? 'justify-end' : 'justify-start'}`}
              >
                <span
                  className="max-w-[80%] rounded-[14px] px-3.5 py-2 text-[13px] leading-relaxed"
                  style={
                    l.who === 'you'
                      ? { background: '#e4ec4b', color: '#000' }
                      : {
                          background: 'rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.82)',
                        }
                  }
                >
                  {l.text}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3 border-t border-white/8 px-5 py-3">
          {lines.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
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
          ) : null}

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const text = draft.trim();
              if (!text) return;
              onSend(text);
              setDraft('');
              setOpen(true);
            }}
            placeholder="Say anything — change direction, push back, add context…"
            className="min-w-0 flex-1 bg-transparent py-1 text-[14px] text-white outline-none placeholder:text-white/35"
          />

          <button
            type="button"
            onClick={() => {
              const text = draft.trim();
              if (!text) return;
              onSend(text);
              setDraft('');
              setOpen(true);
            }}
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4ec4b] text-black transition-opacity disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h13M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {trailing}
        </div>
      </div>
    </div>
  );
}

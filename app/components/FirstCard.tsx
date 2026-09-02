'use client';

// The first card.
//
// One card, centred on black, asking the only question the board can ask before
// it knows anything. It carries the core idea's own yellow rather than the
// theme colours, because what you type here becomes the yellow circle the whole
// board ends up orbiting — the card and the thing it turns into are the same
// object, seen before and after.
//
// Nothing is offered back at this stage. The partner's response to what you
// type IS the questions it opens, not a paragraph about your idea — answering a
// sentence with an insight would be the partner talking over you before it has
// understood anything.

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function FirstCard() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function start() {
    const seedIdea = value.trim();
    if (!seedIdea || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Names travel, bytes do not. What the board needs to know is that a
        // scope doc is part of this thinking, so the partner can ask about it.
        body: JSON.stringify({
          seedIdea,
          attachments: files.map((f) => ({ name: f.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start a map.');
      router.push(`/map/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a map.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{
          background: '#e4ec4b',
          boxShadow: '0 0 130px rgba(228,236,75,0.22)',
          minHeight: 520,
        }}
      >
        <p className="text-center text-[19px] font-semibold text-black">
          What are you trying to figure out?
        </p>

        {/* The field sits in the middle of the card rather than under the
            heading: the card is mostly empty on purpose, and the empty space is
            what says "this is yours to fill". */}
        <div className="flex flex-1 items-center">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void start();
              }
            }}
            rows={3}
            placeholder="Type here…"
            disabled={busy}
            className="w-full resize-none bg-transparent text-center text-[17px] text-black outline-none placeholder:text-black/40"
          />
        </div>

        {/* Attachments. Held on the client for now and named back to the person
            so the card can show what it is carrying; nothing is uploaded until
            there is a map to hang them on. */}
        {files.length > 0 ? (
          <ul className="mb-3 flex flex-wrap gap-2">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-2 rounded-full bg-black/12 px-3 py-1.5 text-[12px] text-black"
              >
                {f.name.length > 26 ? `${f.name.slice(0, 24)}…` : f.name}
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() =>
                    setFiles((prev) => prev.filter((x) => x.name !== f.name))
                  }
                  className="text-black/50 hover:text-black"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex items-center gap-2 rounded-full bg-black/12 px-4 py-2 text-[13px] font-medium text-black hover:bg-black/20"
          >
            {/* A paperclip, so the control reads as "attach" before the label
                is read at all. */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

          {/* The affordance is a button, not a sentence. "Press enter" told you
              the shortcut but gave you nothing to aim at — and on a card whose
              whole job is to be filled in and sent, the send has to be a thing
              you can hit. Enter still works. */}
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || !value.trim()}
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

        <input
          ref={picker}
          type="file"
          multiple
          accept="image/*,.pdf,.md,.txt"
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            // De-duplicate by name so browsing twice for the same file does not
            // list it twice.
            setFiles((prev) => {
              const names = new Set(prev.map((f) => f.name));
              return [...prev, ...picked.filter((f) => !names.has(f.name))];
            });
            e.target.value = '';
          }}
        />

        {error ? (
          <p className="mt-3 text-center text-[12px] text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

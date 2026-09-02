'use client';

// The first card.
//
// One card, centred on black, asking the only question the board can ask
// before it knows anything. It carries the core idea's own yellow rather than
// the theme colours, because what you type here becomes the yellow circle the
// whole board ends up orbiting — the card and the thing it turns into are the
// same object, seen before and after.
//
// Nothing is offered back at this stage. The partner's response to what you
// type IS the questions it opens, not a paragraph about your idea — answering
// a sentence with an insight would be the partner talking over you before it
// has understood anything.
//
// What remains here is the STATE and the composition: the question, what is
// attached, and the trip to `/api/maps`. The three visible parts — the link
// box, the attachment chips, the control row — are their own components, so
// this file says what the card is rather than how each piece of it is drawn.

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { fetchBriefFromLink, type FetchedBrief } from '@/app/lib/briefFetch';
import FirstCardAttachments from './FirstCardAttachments';
import FirstCardControls from './FirstCardControls';
import FirstCardLinkBox from './FirstCardLinkBox';

export default function FirstCard() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const [reading, setReading] = useState(false);
  const [brief, setBrief] = useState<FetchedBrief | null>(null);

  /**
   * Hand the address to the server and keep what comes back.
   *
   * The browser cannot make this request itself — CORS blocks a page fetching
   * almost any third-party document — and it should not be trusted with the
   * decision either: `/api/briefs/fetch` is where the address is checked
   * against the private ranges it must never reach.
   */
  async function attachLink() {
    const address = url.trim();
    if (!address || reading) return;
    setReading(true);
    setError(null);
    try {
      const { brief: fetched, error: failed } =
        await fetchBriefFromLink(address);
      if (!fetched) {
        setError(failed);
        return;
      }
      setBrief(fetched);
      setUrl('');
      setLinking(false);
    } finally {
      setReading(false);
    }
  }

  async function start() {
    const seedIdea = value.trim();
    // A brief is enough on its own — the page you pointed at says what you
    // want thought through. What the board cannot start from is neither. This
    // is the same rule `/api/maps` already enforces, said here so the button
    // agrees with the server instead of being stricter than it.
    if ((!seedIdea && !brief) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Names travel, bytes do not. What the board needs to know is that a
        // scope doc is part of this thinking, so the partner can ask about it.
        // A fetched page is the exception: its words are already text, so they
        // travel in full as the brief.
        body: JSON.stringify({
          seedIdea,
          attachments: files.map((f) => ({ name: f.name })),
          ...(brief
            ? {
                brief: {
                  text: brief.text,
                  sourceName: brief.sourceName,
                  mediaType: brief.mediaType,
                },
              }
            : {}),
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

        {linking ? (
          <FirstCardLinkBox
            url={url}
            reading={reading}
            onChange={setUrl}
            onAttach={() => void attachLink()}
            onCancel={() => {
              setLinking(false);
              setUrl('');
            }}
          />
        ) : null}

        <FirstCardAttachments
          brief={brief}
          files={files}
          onClearBrief={() => setBrief(null)}
          onRemoveFile={(name) =>
            setFiles((prev) => prev.filter((f) => f.name !== name))
          }
        />

        <FirstCardControls
          busy={busy}
          canStart={value.trim().length > 0 || brief !== null}
          linkDisabled={brief !== null}
          onBrowse={() => picker.current?.click()}
          onLink={() => setLinking((was) => !was)}
          onStart={() => void start()}
        />

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

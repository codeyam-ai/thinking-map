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
import { admitFiles } from '@/app/lib/attachments';
import FirstCardAttachments from './FirstCardAttachments';
import FirstCardControls from './FirstCardControls';
import FirstCardLinkBox from './FirstCardLinkBox';
import FirstCardPrompt from './FirstCardPrompt';

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
  const [dragging, setDragging] = useState(false);

  /**
   * Take files in — browsed, pasted or dropped — and refuse the ones that
   * cannot land.
   *
   * The rules themselves are `admitFiles`, shared with the upload route's own
   * `fitsAttachmentCaps` so the two cannot word the same refusal differently.
   * What is left here is the local part: which state to set.
   */
  function addFiles(picked: File[]) {
    if (picked.length === 0) return;
    setFiles((prev) => {
      const { accepted, error: refused } = admitFiles(prev, picked);
      setError(refused);
      return [...prev, ...accepted];
    });
  }

  /**
   * Send the files to the board that was just created.
   *
   * This is the earliest moment they can go anywhere: the upload route is
   * addressed by a map id, and until `POST /api/maps` answers there is no id.
   * The brief keeps its own rule and travels in that POST, because a brief is
   * the document the board is ABOUT and has to exist or not exist with it;
   * an attachment is something brought along, and arriving a moment later
   * costs nothing.
   *
   * A refusal is recorded and then gone past. The board exists by this point
   * and is what the person asked for — holding them on this screen to complain
   * about the third file would leave them looking at a start button that would
   * create a SECOND board.
   */
  async function uploadFiles(mapId: string) {
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', file);
        await fetch(`/api/maps/${mapId}/attachments`, {
          method: 'POST',
          body: form,
        });
      } catch {
        // The board is already made. Nothing here is worth losing it over.
      }
    }
  }

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
        // Bytes travel now — but not here. Files go up in their own requests
        // once this one has answered with an id, because a JSON body carrying
        // a megabyte of base64 alongside the idea would make the one request
        // the board cannot start without the slowest one on the screen.
        // A fetched page is still the exception: its words are already text,
        // so they travel in full as the brief.
        body: JSON.stringify({
          seedIdea,
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
      if (files.length) await uploadFiles(data.id);
      router.push(`/map/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a map.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div
        // The whole card is the drop target, not a dashed box inside it. A
        // dashed box is an advertisement for a gesture; the card already reads
        // as the one place on this screen where things go, so making it the
        // target means the gesture works where people already aim.
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9 transition-shadow"
        style={{
          background: '#e4ec4b',
          // The glow tightens while something is over the card — the only
          // state change available on a surface that is already one flat
          // colour, and enough to say the drop will land.
          boxShadow: dragging
            ? '0 0 0 3px rgba(0,0,0,0.35), 0 0 130px rgba(228,236,75,0.4)'
            : '0 0 130px rgba(228,236,75,0.22)',
          minHeight: 520,
        }}
      >
        <FirstCardPrompt
          value={value}
          busy={busy}
          onChange={setValue}
          onSubmit={() => void start()}
          onPasteFiles={addFiles}
        />

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
            addFiles(Array.from(e.target.files ?? []));
            // Reset so choosing the same file twice still fires a change.
            e.target.value = '';
          }}
        />

        {error ? (
          <p className="mt-3 text-[12px] text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

'use client';

// What the person brought with the idea.
//
// Hung off the core circle rather than filed in a line of thinking, because an
// attachment is context for the WHOLE idea — a scope doc, a screenshot of the
// thing being replaced — not evidence for one branch of it.
//
// It used to say "names only", and it meant it: the board recorded that a
// document was part of this thinking and stored nothing. It holds the file now,
// which is what makes a thumbnail possible here and `read_attachment` possible
// at all — a filename the partner cannot open is not a contribution to the
// thinking. An attachment that predates that still renders as a name, because
// there is nothing behind it to show.
//
// Two verbs, not one. Removing and renaming go through the whole-list PUT the
// way they always did; a new file goes through its own POST, because a
// whole-list replace carrying bytes would re-upload every image whenever
// somebody removed one.

import { useRef, useState } from 'react';
import {
  MAX_ATTACHMENTS_PER_MAP,
  type Attachment,
} from '@/app/lib/attachments';
import AttachmentAddButton from './AttachmentAddButton';
import AttachmentChip from './AttachmentChip';

export type { Attachment };

export default function CoreAttachments({
  mapId,
  attachments,
}: {
  mapId: string;
  attachments: Attachment[];
}) {
  const [items, setItems] = useState<Attachment[]>(attachments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function save(next: Attachment[]) {
    // Optimistic: the list is the person's own edit, and waiting on a round
    // trip to see a filename disappear would feel broken rather than careful.
    const previous = items;
    setItems(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/attachments`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          attachments: next.map((a) => ({ id: a.id, name: a.name })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Put it back rather than leaving the screen claiming something the
      // database does not agree with.
      setItems(previous);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Upload one file and land the row it created.
   *
   * NOT optimistic, unlike the removals above: the caps are enforced on the
   * server and a file can be refused, so showing a thumbnail before the server
   * has agreed to keep it would mean taking it away again. Each file is its own
   * request so one refusal does not lose the rest.
   */
  async function upload(files: File[]) {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`/api/maps/${mapId}/attachments`, {
          method: 'POST',
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? `Could not attach ${file.name}.`);
          // Stop at the first refusal. Past a cap, every file after it would
          // be refused for the same reason and the person would get four
          // sentences saying one thing.
          break;
        }
        if (body?.attachment) {
          setItems((was) => [...was, body.attachment as Attachment]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const full = items.length >= MAX_ATTACHMENTS_PER_MAP;

  return (
    <div className="w-[430px]" data-no-pan onClick={(e) => e.stopPropagation()}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
        Brought along
      </span>

      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((a) => (
          <AttachmentChip
            key={a.id ?? a.name}
            mapId={mapId}
            attachment={a}
            busy={busy}
            onRemove={() => void save(items.filter((x) => x !== a))}
          />
        ))}

        {full ? null : (
          <AttachmentAddButton
            busy={busy}
            onClick={() => picker.current?.click()}
          />
        )}
      </ul>

      {/* The refusal the server gave, in the server's own words. A cap the
          person only discovers by hitting it needs to say what to do next, and
          the route already writes that sentence. */}
      {error ? (
        <p className="mt-2 text-[12px] text-white/50">{error}</p>
      ) : null}

      <input
        ref={picker}
        type="file"
        multiple
        accept="image/*,.pdf,.md,.txt"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) void upload(picked);
          e.target.value = '';
        }}
      />
    </div>
  );
}

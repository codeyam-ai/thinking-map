'use client';

// What the person brought with the idea.
//
// Hung off the core circle rather than filed in a line of thinking, because an
// attachment is context for the WHOLE idea — a scope doc, a screenshot of the
// thing being replaced — not evidence for one branch of it.
//
// Names only. The board records that a document is part of this thinking so the
// partner can ask about it and the person can see it is accounted for; storing
// the bytes is a different product with its own problems, and none of them are
// the one being solved here.

import { useRef, useState } from 'react';

export interface Attachment {
  name: string;
}

export default function CoreAttachments({
  mapId,
  attachments,
}: {
  mapId: string;
  attachments: Attachment[];
}) {
  const [items, setItems] = useState<Attachment[]>(attachments);
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ attachments: next }),
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

  return (
    <div className="w-[430px]" data-no-pan onClick={(e) => e.stopPropagation()}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
        Brought along
      </span>

      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((a) => (
          <li
            key={a.name}
            className="flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/70"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 11.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {a.name.length > 28 ? `${a.name.slice(0, 26)}…` : a.name}
            <button
              type="button"
              aria-label={`Remove ${a.name}`}
              disabled={busy}
              onClick={() => void save(items.filter((x) => x.name !== a.name))}
              className="text-white/35 hover:text-white"
            >
              ×
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-[12px] text-white/45 hover:border-white/40 hover:text-white/80"
          >
            + Add
          </button>
        </li>
      </ul>

      <input
        ref={picker}
        type="file"
        multiple
        accept="image/*,.pdf,.md,.txt"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((f) => ({
            name: f.name,
          }));
          const names = new Set(items.map((a) => a.name));
          void save([...items, ...picked.filter((a) => !names.has(a.name))]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import BriefMenu from './BriefMenu';
import SendButton from './SendButton';

/**
 * The single free-text input the whole product starts from.
 *
 * With a brief attached the line stops being the idea and becomes the ask —
 * the sentence saying what you want out of the document — so its label, its
 * placeholder and its send button all change to say so, and it becomes
 * optional: the document is enough on its own.
 *
 * The frame carries the intake on the left and the send on the right, and the
 * form itself is the drop target: dropping a document anywhere over the prompt
 * attaches it, which is what lets the dashed panel that used to advertise that
 * disappear.
 */
export default function IdeaForm({
  value,
  busy,
  hasBrief = false,
  attachedName = null,
  onChange,
  onSubmit,
  onChooseFile,
  onPaste,
  onLink,
  onDropFile,
  onDropLink,
}: {
  value: string;
  busy: boolean;
  hasBrief?: boolean;
  attachedName?: string | null;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onChooseFile: () => void;
  onPaste: () => void;
  onLink: () => void;
  onDropFile: (file: File) => void;
  /** A link dragged out of another tab. Separate from `onDropFile` because it
   *  arrives as an address rather than bytes, and is fetched rather than read. */
  onDropLink: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const label = hasBrief
    ? 'What do you want out of this brief?'
    : 'What would you like to figure out?';
  const send = hasBrief ? 'Start on this brief' : 'Start thinking this through';

  return (
    <form
      onSubmit={onSubmit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          onDropFile(file);
          return;
        }
        // Dragging a tab, a bookmark or a link out of another window yields no
        // file at all — it yields `text/uri-list`, which is why dropping a page
        // on this form used to do nothing at all. `text/plain` is the fallback
        // for the sources that only set that one, and it is accepted only when
        // it actually parses as an address: dropping a sentence should still
        // do nothing rather than attach a brief nobody asked for.
        const list = e.dataTransfer.getData('text/uri-list');
        const dropped =
          list.split('\n').find((line) => line.trim() && !line.startsWith('#')) ??
          e.dataTransfer.getData('text/plain');
        if (!dropped) return;
        try {
          const { protocol } = new URL(dropped.trim());
          if (protocol === 'http:' || protocol === 'https:') {
            onDropLink(dropped.trim());
          }
        } catch {
          // Not an address. Nothing to attach, and nothing to say about it.
        }
      }}
      className="relative"
    >
      <label htmlFor="idea" className="sr-only">
        {label}
      </label>
      <input
        id="idea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder={
          hasBrief
            ? 'What do you want out of it? (optional)'
            : 'I want to build an educational game for kids…'
        }
        // `pl-44` reserves the width of the attach control, which sits inside
        // this frame at `left-3` rather than beside it. The two numbers move
        // together: a labelled trigger is wider than the `+` it replaced, and
        // leaving the old `pl-16` would run the placeholder underneath it.
        className={`h-[76px] w-full rounded-full border-[1.5px] bg-surface pl-44 pr-24 text-[16px] text-ink outline-none transition placeholder:text-muted focus:border-ink disabled:opacity-60 ${
          dragging ? 'border-ink bg-paper' : 'border-ink'
        }`}
      />
      <BriefMenu
        busy={busy}
        attachedName={attachedName}
        onChooseFile={onChooseFile}
        onPaste={onPaste}
        onLink={onLink}
      />
      <SendButton
        size="large"
        disabled={busy || (!hasBrief && value.trim().length === 0)}
        label={send}
      />
    </form>
  );
}

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
  onDropFile,
}: {
  value: string;
  busy: boolean;
  hasBrief?: boolean;
  attachedName?: string | null;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onChooseFile: () => void;
  onPaste: () => void;
  onDropFile: (file: File) => void;
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
        if (file) onDropFile(file);
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
        className={`h-[76px] w-full rounded-full border-[1.5px] bg-surface pl-16 pr-24 text-[16px] text-ink outline-none transition placeholder:text-muted focus:border-ink disabled:opacity-60 ${
          dragging ? 'border-ink bg-paper' : 'border-ink'
        }`}
      />
      <BriefMenu
        busy={busy}
        attachedName={attachedName}
        onChooseFile={onChooseFile}
        onPaste={onPaste}
      />
      <SendButton
        size="large"
        disabled={busy || (!hasBrief && value.trim().length === 0)}
        label={send}
      />
    </form>
  );
}

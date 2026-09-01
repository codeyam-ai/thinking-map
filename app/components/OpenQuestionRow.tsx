'use client';

import { useState } from 'react';
import SendButton from './SendButton';

/**
 * One question addressed to the person, with somewhere to answer it.
 *
 * The draft is held here rather than by the panel: each row owns exactly one
 * answer, and a shared draft map was one more thing to key correctly for no
 * gain.
 */
export default function OpenQuestionRow({
  id,
  label,
  onAnswer,
}: {
  id: string;
  label: string;
  /** Resolves when the answer is safely recorded; rejects if it was not. */
  onAnswer(id: string, label: string, answer: string): Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const answer = draft.trim();
    if (!answer || busy) return;
    setBusy(true);
    try {
      await onAnswer(id, label, answer);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <p className="mb-1.5 text-[12.5px] font-semibold leading-snug text-ink">
        {label}
      </p>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          className="w-full rounded-full border border-line bg-surface py-2 pl-3.5 pr-11 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-ink"
          placeholder="Answer…"
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        {/* The label names the question: several of these sit in the panel at
            once, and one repeated "Send answer" leaves both a screen reader and
            a click target unable to tell them apart. */}
        <SendButton
          label={`Send answer to: ${label}`}
          disabled={!draft.trim() || busy}
        />
      </form>
    </li>
  );
}

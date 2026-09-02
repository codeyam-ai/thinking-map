'use client';

import { useState } from 'react';
import AnswerChips from './AnswerChips';
import RecordedAnswer from './RecordedAnswer';
import SendButton from './SendButton';

/**
 * The answering affordance inside a question card.
 *
 * This is the change the whole plan is for: the question and the place you
 * answer it are one object now, instead of a dashed pill on a map and a row in
 * a panel beside it.
 *
 * The draft is held here rather than by the row, for the reason
 * `OpenQuestionRow` held it before: each card owns exactly one answer, and a
 * shared draft map was one more thing to key correctly for no gain.
 */
export default function MapCardAnswer({
  id,
  label,
  options,
  answer,
  onAnswer,
}: {
  id: string;
  label: string;
  /** A few likely answers, offered as chips. Empty is ordinary. */
  options: string[];
  /** What the person said last time, from the log. Null while it is still
   *  open. */
  answer: string | null;
  /** Resolves when the answer is safely recorded; rejects if it was not.
   *  Absent in an isolated scenario, where there is no exchange to write to —
   *  the card still reads correctly, it simply cannot be answered. */
  onAnswer?(id: string, label: string, answer: string): Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // An answer is edited by re-opening the input on top of it. The previous
  // answer is not cleared while editing: abandoning a half-typed correction
  // must leave what you originally said standing.
  const [editing, setEditing] = useState(false);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy || !onAnswer) return;
    setBusy(true);
    try {
      await onAnswer(id, label, text);
      setDraft('');
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (answer !== null && !editing) {
    return (
      <RecordedAnswer
        answer={answer}
        onEdit={() => {
          // Pre-filled, because an edit is almost always a correction to what
          // you said rather than a different answer typed from nothing.
          setDraft(answer);
          setEditing(true);
        }}
      />
    );
  }

  return (
    <div>
      <AnswerChips options={options} onPick={setDraft} />

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
        {/* The label names the question. Several of these sit on screen at
            once, and one repeated "Send answer" leaves both a screen reader and
            a click target unable to tell them apart — the same reason
            `OpenQuestionRow` named its own. */}
        <SendButton
          label={`Send answer to: ${label}`}
          disabled={!draft.trim() || busy || !onAnswer}
        />
      </form>
    </div>
  );
}

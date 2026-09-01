'use client';

import SendButton from './SendButton';

/** The reply box at the foot of the conversation, with its error region. */
export default function ReplyForm({
  value,
  busy,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  error: string | null;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      {error ? (
        <p role="alert" className="mb-3 px-1 text-[12.5px] leading-snug text-risk">
          {error}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="relative">
        <label htmlFor="reply" className="sr-only">
          Answer, or ask anything
        </label>
        <input
          id="reply"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          placeholder={busy ? 'Thinking…' : 'Answer, or ask anything…'}
          className="h-[54px] w-full rounded-full border-[1.5px] border-ink bg-surface pl-5 pr-16 text-[14px] outline-none placeholder:text-muted disabled:opacity-60"
        />
        <SendButton disabled={busy || value.trim().length === 0} label="Send" />
      </form>
    </div>
  );
}

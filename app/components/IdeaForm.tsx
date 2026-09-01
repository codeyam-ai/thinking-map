'use client';

import SendButton from './SendButton';

/** The single free-text input the whole product starts from. */
export default function IdeaForm({
  value,
  busy,
  onChange,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="relative">
      <label htmlFor="idea" className="sr-only">
        What would you like to figure out?
      </label>
      <input
        id="idea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder="I want to build an educational game for kids…"
        className="h-[76px] w-full rounded-full border-[1.5px] border-ink bg-surface pl-8 pr-24 text-[16px] text-ink outline-none placeholder:text-muted focus:border-ink disabled:opacity-60"
      />
      <SendButton
        size="large"
        disabled={busy || value.trim().length === 0}
        label="Start thinking this through"
      />
    </form>
  );
}

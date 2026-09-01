'use client';

import SendButton from './SendButton';

/**
 * The single free-text input the whole product starts from.
 *
 * With a brief attached the line stops being the idea and becomes the ask —
 * the sentence saying what you want out of the document — so its label, its
 * placeholder and its send button all change to say so, and it becomes
 * optional: the document is enough on its own.
 */
export default function IdeaForm({
  value,
  busy,
  hasBrief = false,
  onChange,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  hasBrief?: boolean;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const label = hasBrief
    ? 'What do you want out of this brief?'
    : 'What would you like to figure out?';
  const send = hasBrief ? 'Start on this brief' : 'Start thinking this through';

  return (
    <form onSubmit={onSubmit} className="relative">
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
        className="h-[76px] w-full rounded-full border-[1.5px] border-ink bg-surface pl-8 pr-24 text-[16px] text-ink outline-none placeholder:text-muted focus:border-ink disabled:opacity-60"
      />
      <SendButton
        size="large"
        disabled={busy || (!hasBrief && value.trim().length === 0)}
        label={send}
      />
    </form>
  );
}

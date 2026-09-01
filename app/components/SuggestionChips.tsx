'use client';

import { SUGGESTIONS } from '../lib/suggestions';

/**
 * Clicking a chip fills the prompt rather than submitting it — the person
 * stays in control of their own words.
 */
export default function SuggestionChips({
  onPick,
}: {
  onPick: (text: string) => void;
}) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion.replace(/…$/, ' '))}
          className="rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] text-ink-soft transition hover:border-ink hover:text-ink"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

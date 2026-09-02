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
    // One row, always. Four chips wrapped to a second row at half width, which
    // was the single biggest source of crowding on this screen — so three show
    // under `lg`, all four above it, and the row scrolls rather than wraps.
    <div className="no-scrollbar mt-7 flex flex-nowrap items-center justify-start gap-2 overflow-x-auto lg:justify-center lg:gap-2.5">
      {SUGGESTIONS.map((suggestion, index) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion.replace(/…$/, ' '))}
          className={`shrink-0 rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] whitespace-nowrap text-ink-soft transition hover:border-ink hover:text-ink ${
            index >= 3 ? 'hidden lg:inline-block' : ''
          }`}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

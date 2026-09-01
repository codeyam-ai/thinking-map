'use client';

/**
 * A question's suggested answers, as chips.
 *
 * Clicking one FILLS the answer box rather than submitting it — the rule
 * `SuggestionChips` established on the landing screen, and the reason these are
 * a head start rather than a set of choices. A chip that submitted would turn
 * every question carrying suggestions into a multiple-choice question, which is
 * not what a thinking partner asks.
 *
 * Deliberately not `SuggestionChips` itself: that component is bound to the
 * landing page's fixed `SUGGESTIONS` list and has no per-question input. Same
 * rule, different source of options.
 */
export default function AnswerChips({
  options,
  onPick,
}: {
  options: string[];
  onPick: (text: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-ink hover:text-ink"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

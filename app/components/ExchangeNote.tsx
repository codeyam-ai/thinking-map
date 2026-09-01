import { splitAssistantLines } from '../lib/messageLines';

/**
 * Free text a side actually wrote, inside an activity row.
 *
 * A question keeps its weight here for the same reason it did in the
 * conversation panel this replaces: the questions are the product, and a
 * question buried in an agent's note is the one line the person is meant to
 * act on.
 */
export default function ExchangeNote({ text }: { text: string }) {
  const lines = splitAssistantLines(text);
  if (lines.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((line, i) => (
        <p
          key={i}
          className={`text-[12.5px] leading-snug ${
            line.isQuestion ? 'font-semibold text-ink' : 'text-muted'
          }`}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}

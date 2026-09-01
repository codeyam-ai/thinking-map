import type { NodeKind } from '../lib/mapKinds';
import { ACCENT_KINDS } from '../lib/mapKinds';

/**
 * The mark in a card's top-right corner, for the kinds that carry one.
 *
 * Only three kinds do, and they come from `ACCENT_KINDS` rather than a list of
 * its own — the card and the vocabulary agree by construction, so a kind added
 * to the accent table cannot end up with a colour here and no mark, or the
 * reverse.
 *
 * The magnifier is the same one the node pill used for a research finding,
 * carried across when the pill became a card: it is the one accent that reads
 * as an activity ("went and looked") rather than a judgement.
 */
export default function NodeAccentMark({ kind }: { kind: string }) {
  const accent = ACCENT_KINDS[kind as NodeKind];
  if (!accent) return null;

  if (accent === 'find') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 14 14"
        className="shrink-0 text-ink"
        aria-hidden="true"
      >
        <circle
          cx="6"
          cy="6"
          r="4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M9.2 9.2 L12.5 12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Pro and risk are the design system's two sparing colours, so they are a
  // dot rather than a glyph: the colour IS the information, and a shape would
  // be a second thing to learn for the same fact.
  return (
    <span
      aria-hidden="true"
      className={`mt-1 block h-2.5 w-2.5 shrink-0 rounded-full ${
        accent === 'risk' ? 'bg-risk' : 'bg-pro'
      }`}
    />
  );
}

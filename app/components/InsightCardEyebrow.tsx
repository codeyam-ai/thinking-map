/**
 * The line above an insight's claim: what kind of thing it is, and how far
 * behind the thinking it has fallen.
 *
 * Presentational only, in the manner of `MapCardEyebrow` — which words go in
 * the line is `cardEyebrow`'s and `staleNote`'s business, because both are
 * string logic with rules worth testing ("an experiment says Try this", "one
 * answer is not 1 answers") rather than anything about rendering.
 *
 * The two facts sit at opposite ends of one line rather than stacking, because
 * they answer different questions — what is this, and can I still trust it —
 * and a person scanning a column of four cards reads the left edge for the
 * first and notices the second only on the cards that have it.
 */
import { cardEyebrow } from '../lib/cardEyebrow';
import { staleNote } from '../lib/insightStale';

export default function InsightCardEyebrow({
  kind,
  answersSince,
  hue,
}: {
  kind: string;
  /** Answers that landed after this was written. Zero draws no marker. */
  answersSince: number;
  hue: number;
}) {
  const stale = staleNote(answersSince);

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: `hsl(${hue} 85% 65%)` }}
      >
        {cardEyebrow({ kind })}
      </span>
      {stale ? (
        <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/35">
          {stale}
        </span>
      ) : null}
    </div>
  );
}

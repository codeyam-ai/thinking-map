/**
 * Things to try, and what trying one would settle.
 *
 * The region that changed the far end from a report into a next move, and it
 * draws from two places on purpose. The map's `slice` nodes are the small
 * builds, each naming an assumption it would test; the partner's `experiment`
 * and `suggestion` insights are the things worth running that nobody has to
 * build. Both answer "what could I do that would tell me something", so they
 * belong in one list rather than in two regions the reader has to reconcile.
 *
 * A slice that settles nothing is MARKED rather than dropped. An increment
 * that tests no assumption is not a validating slice — it is just work
 * scheduled early — and a list that quietly rendered those alongside the real
 * ones would be a plan with rounded corners. Same reasoning `buildSequence`
 * holds, shown here as a dashed edge: the board's own word for unsettled, and
 * the same treatment an unanswered card wears.
 */
import BoardTradeoffs from './BoardTradeoffs';
import BoardWhereNextEmpty from './BoardWhereNextEmpty';
import BoardWhereNextPanel from './BoardWhereNextPanel';
import type { SequencedSlice } from '../lib/buildSequence';
import type { Insight } from '../lib/insightStream';

export default function BoardWhereNextTry({
  experiments,
  sequence,
  changed,
  eyebrowFor,
}: {
  experiments: Insight[];
  sequence: SequencedSlice[];
  /** What arrived while the person was answering elsewhere. Marked in place
   *  rather than sorted to the top: the value of the mark is that it can be
   *  read AGAINST what was already there, and a list that reorders itself
   *  between visits is a list nobody can keep their place in. */
  changed?: ReadonlySet<string>;
  /** The word for a kind, from the one tested place that decides it. Passed in
   *  rather than imported so this file holds no second opinion about what an
   *  `unknown` node is called. */
  eyebrowFor: (kind: string) => string;
}) {
  const empty = experiments.length === 0 && sequence.length === 0;

  return (
    // NOT "Try this", which is what `KIND_EYEBROW` already calls an experiment
    // — the panel heading and the first card's eyebrow read as a stutter, the
    // same two words twice with nothing between them. The heading names the
    // whole region, which holds experiments AND builds; the eyebrows name what
    // each row is.
    <BoardWhereNextPanel title="Things you could do">
      <ol className="flex flex-col gap-3">
        {experiments.map((insight) => (
          <li
            key={insight.id}
            className="flex flex-col gap-1.5 break-words rounded-[16px] border border-white/20 px-4 py-3.5"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                {eyebrowFor(insight.kind)}
              </span>
              {/* Lime as a fill, on the one thing that just changed — the
                  palette's rule for the accent, and the only place in this
                  column it is spent. */}
              {changed?.has(insight.id) ? (
                <span className="rounded-full bg-[#D5F560] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-black">
                  New
                </span>
              ) : null}
            </div>
            <span className="text-[13.5px] font-semibold leading-snug text-white">
              {insight.label}
            </span>
            {insight.detail ? (
              <span className="text-[12.5px] leading-snug text-white/45">
                {insight.detail}
              </span>
            ) : null}
            <BoardTradeoffs tradeoffs={insight.tradeoffs} />
          </li>
        ))}

        {sequence.map((entry, index) => (
          <li
            key={entry.slice.id}
            className={`flex flex-col gap-1.5 break-words rounded-[16px] border px-4 py-3.5 ${
              entry.provesNothing
                ? 'border-dashed border-white/25'
                : 'border-white/20'
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                Build {index + 1}
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/30">
                ·{' '}
                {entry.proves
                  ? eyebrowFor(entry.proves.kind)
                  : 'settles nothing yet'}
              </span>
            </div>
            <span className="text-[13.5px] font-semibold leading-snug text-white">
              {entry.slice.label}
            </span>
            <span className="text-[12.5px] leading-snug text-white/45">
              {entry.proves
                ? `Would settle: ${entry.proves.label}`
                : entry.danglingId
                  ? 'This was going to settle something that is no longer on the map.'
                  : 'Nothing on the map gets settled by building this.'}
            </span>
            <BoardTradeoffs tradeoffs={entry.slice.tradeoffs} />
          </li>
        ))}

        {empty ? <BoardWhereNextEmpty /> : null}
      </ol>
    </BoardWhereNextPanel>
  );
}

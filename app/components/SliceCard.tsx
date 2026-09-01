import { KIND_EYEBROW } from '../lib/mapKinds';
import type { SequencedSlice } from '../lib/buildSequence';

/**
 * One increment in the build sequence: what you build, what it would prove,
 * and roughly what it costs.
 *
 * Its own component so each state — validated, proves nothing, dangling link —
 * gets an isolated scenario, following the BulletCard / DirectionsCard split.
 *
 * The effort note is the agent's own sentence, printed as written. Nothing
 * parses it and nothing validates it: a rough "about two days" a human can
 * argue with is more honest than a number that merely looks computed.
 */
export default function SliceCard({
  entry,
  index,
}: {
  entry: SequencedSlice;
  index: number;
}) {
  const { slice, proves, provesNothing, danglingId } = entry;

  return (
    <li
      className={`flex flex-col gap-2 rounded-[16px] border px-5 py-4 ${
        provesNothing ? 'border-dashed border-muted' : 'border-ink'
      }`}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="eyebrow">Build {index + 1}</span>
        {/* The kind of thing this settles rides in the eyebrow, so the body
            below can be one plain sentence rather than a label glued to a
            category name. */}
        <span className="eyebrow text-muted">
          ·{' '}
          {proves
            ? (KIND_EYEBROW[proves.kind as keyof typeof KIND_EYEBROW] ??
              proves.kind)
            : 'proves nothing yet'}
        </span>
      </div>

      <span className="text-[14px] font-semibold leading-snug">
        {slice.label}
      </span>

      {proves ? (
        <span className="text-[13px] leading-snug text-muted">
          Would settle: {proves.label}
        </span>
      ) : (
        // The gap is the point. A slice with nothing to settle is shown in
        // place, in the client's own reading order, so they ask about it —
        // hiding it or dropping it to the bottom would make the sequence look
        // tidier than the thinking behind it actually is.
        <span className="text-[13px] leading-snug text-muted">
          {danglingId
            ? 'This was going to settle something that is no longer on the map.'
            : 'Nothing on the map gets settled by building this.'}
        </span>
      )}

      {slice.detail ? (
        <span className="text-[13px] leading-snug text-muted">
          {slice.detail}
        </span>
      ) : null}
    </li>
  );
}

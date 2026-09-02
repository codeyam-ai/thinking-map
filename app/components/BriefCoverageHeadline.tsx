import { formatCharCount } from '../lib/briefFormat';

/**
 * The panel's one sentence, and the bar under it.
 *
 * It leads with what is UNTOUCHED rather than what is covered, because the
 * covered sections already have their evidence — the map is sitting next to
 * this. What is left for the panel to say is what nobody has dealt with.
 *
 * The character count is on its own line under the section count because a
 * count of sections understates the finding on its own: four short sections
 * and four long ones are not the same news for a client.
 */
export default function BriefCoverageHeadline({
  untouchedCount,
  untouchedCharCount,
  covered,
  total,
}: {
  untouchedCount: number;
  untouchedCharCount: number;
  covered: number;
  total: number;
}) {
  // Guarded rather than assumed: a brief whose sections are all empty has
  // nothing to account for, and a bar filled to NaN renders as nothing at all.
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100);

  return (
    <>
      {untouchedCount === 0 ? (
        <p className="mb-1.5 text-[17px] font-extrabold leading-tight tracking-[-0.015em]">
          Every section is accounted for.
        </p>
      ) : (
        <>
          <p className="mb-1.5 text-[17px] font-extrabold leading-tight tracking-[-0.015em]">
            <span className="tabular-nums">
              {untouchedCount} section{untouchedCount === 1 ? '' : 's'}
            </span>{' '}
            nobody has touched
          </p>
          <p className="mb-3.5 text-[12px] leading-relaxed text-muted">
            {formatCharCount(untouchedCharCount)} characters with nothing on the
            map pointing at them.
          </p>
        </>
      )}

      <div className="mb-[22px] h-[5px] overflow-hidden rounded-[3px] bg-line">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

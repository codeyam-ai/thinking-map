/**
 * What document this is, and how much of it the map accounts for.
 *
 * The source name is the client's own filename rather than anything derived —
 * a person recognises `northgate-renewal-brief.pdf` as the thing they sent,
 * and a tidied-up title would break that recognition for no gain.
 */
export default function BriefPanelHeader({
  sourceName,
  covered,
  total,
}: {
  sourceName: string;
  covered: number;
  total: number;
}) {
  return (
    <>
      <div className="flex items-baseline gap-2.5">
        <span className="eyebrow">Brief</span>
        <span className="text-[12.5px] text-muted">
          {covered} of {total} accounted for
        </span>
      </div>
      {/* Truncated rather than wrapped: a long filename would push the whole
          panel's content down, and the headline below it is what matters. */}
      <p className="mb-[18px] truncate text-[13px] font-semibold text-ink-soft">
        {sourceName}
      </p>
    </>
  );
}

/**
 * One line of the quiet type at the foot of the handoff band.
 *
 * Its own component because "quiet" is the decision, and it was previously
 * three identical class strings across two files. The panel used to LEAD with
 * this prose; demoting it was the change, and a demotion asserted by copy-paste
 * is one bad merge away from being partly undone — one paragraph creeping back
 * to a larger size while its neighbours stay small is exactly the drift nobody
 * would notice.
 *
 * Deliberately not a general-purpose text component: it takes no size, weight
 * or colour prop, because a caller that could pass those could also make this
 * loud, which is the one thing it exists to prevent. `spacing` is the
 * exception and is not the same kind of prop — where a line sits in a stack is
 * genuinely the caller's business, and the type treatment it is guarding is
 * identical at all three values.
 */
export default function FootnoteLine({
  children,
  spacing = 'tight',
}: {
  children: React.ReactNode;
  /**
   * `lead` is the step down from whatever sits above the group, `tight` the
   * gap between siblings inside it, and `none` for a line whose container
   * already owns the space above it.
   */
  spacing?: 'lead' | 'tight' | 'none';
}) {
  const gap = spacing === 'lead' ? 'mt-4' : spacing === 'tight' ? 'mt-2' : '';
  return (
    <p className={`${gap} text-[12px] leading-[1.6] text-muted`}>{children}</p>
  );
}

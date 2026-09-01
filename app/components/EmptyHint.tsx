/**
 * The summary screen's empty state. Per the design system, an empty state
 * describes the next action rather than the absence of data.
 */
export default function EmptyHint() {
  return (
    <li className="text-[13px] text-muted">
      Nothing here yet — keep talking and this fills in.
    </li>
  );
}

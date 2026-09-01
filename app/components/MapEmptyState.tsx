/**
 * The map on day one.
 *
 * Per the design system, an empty state describes what happens next rather than
 * reporting an absence — so this says the map fills in as you answer, not that
 * there is nothing here.
 *
 * Deliberately not `EmptyHint`: that renders an `<li>` for the summary screen's
 * list and would be invalid markup inside the map's column.
 */
export default function MapEmptyState() {
  return (
    <p className="pt-16 text-center text-[13px] text-muted">
      The map fills in as you answer.
    </p>
  );
}

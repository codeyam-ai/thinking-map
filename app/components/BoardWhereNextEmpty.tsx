/**
 * A region of the far-end column with nothing in it yet.
 *
 * Per the design system, an empty state describes the next action rather than
 * the absence of data — and here that rule carries the column's whole argument:
 * a thin region is a fact about how much thinking has happened, not about the
 * rendering, and the honest response to it is to keep going.
 *
 * The board-toned twin of `EmptyHint`, which says the same sentence in the
 * paper palette. Two components rather than one prop because the two grounds
 * share no colour at all.
 */
export default function BoardWhereNextEmpty() {
  return (
    <li className="text-[13px] text-white/40">
      Nothing here yet — keep going and this fills in.
    </li>
  );
}

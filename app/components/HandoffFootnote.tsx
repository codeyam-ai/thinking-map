/**
 * The honest paragraph about why nobody is attached, and the two ways to fix
 * that for good — kept, and kept small.
 *
 * Its own component because of the decision it owns: these two travel together
 * and they travel BELOW the action. The panel used to lead with the
 * explanation, which answered a question someone who just pressed return had
 * not asked yet. Deleting it would have been the other mistake — it is the only
 * thing on the page that says a map cannot summon a thinking partner, and that
 * is true and worth saying to whoever wants to know.
 *
 * So it is demoted rather than dropped, and grouping it here is what makes
 * "demoted" a structural fact instead of two loose paragraphs that could drift
 * back up the page one edit at a time.
 */
export default function HandoffFootnote({
  explanation,
  attachHint,
}: {
  explanation: string;
  attachHint: string;
}) {
  return (
    <>
      <p className="mt-4 text-[12px] leading-[1.6] text-muted">{explanation}</p>
      <p className="mt-2 text-[12px] leading-[1.6] text-muted">{attachHint}</p>
    </>
  );
}

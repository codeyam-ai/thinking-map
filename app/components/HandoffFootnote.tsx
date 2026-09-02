import FootnoteLine from './FootnoteLine';
import HandoffAttachTabs from './HandoffAttachTabs';
import type { HandoffAttachTab } from '../lib/handoffCopy';

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
 *
 * What the group holds, in the order it reads: why nobody is attached, what
 * attaching would buy — and then the ways in, as tabs. Two sentences and a tab
 * strip, deliberately: an earlier draft stacked three paragraphs and both
 * endpoint spellings here, and the result read as a wall of instructions in
 * which a reader could not tell which line was theirs. The doors are
 * alternatives, so `HandoffAttachTabs` shows exactly one at a time.
 */
export default function HandoffFootnote({
  explanation,
  attachHint,
  attachTabs,
}: {
  explanation: string;
  attachHint: string;
  attachTabs: readonly HandoffAttachTab[];
}) {
  return (
    <>
      <FootnoteLine spacing="lead">{explanation}</FootnoteLine>
      <FootnoteLine>{attachHint}</FootnoteLine>
      <HandoffAttachTabs tabs={attachTabs} />
    </>
  );
}

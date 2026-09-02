import CopyablePrompt from './CopyablePrompt';
import FootnoteLine from './FootnoteLine';
import type { HandoffAttachTab } from '../lib/handoffCopy';

/**
 * What one way in actually says: a line, and at most one thing to copy.
 *
 * Its own component because of the decision it owns — that a tab with nothing
 * to copy renders NO box, not an empty one. The `browser` tab's whole point is
 * that a browser implementing WebMCP needs nothing pasted anywhere, and a
 * disabled or blank mono box under that sentence would contradict it in the
 * most visible way available. Encoding the absence in `copy?` and honouring it
 * here keeps that a structural fact rather than a branch someone later
 * "tidies up" into a placeholder.
 *
 * The copy block stays at the default tone: the start prompt above is the one
 * control on this band asking to be pressed, and a promoted block down here
 * would be two things competing for that.
 */
export default function AttachTabPanel({ tab }: { tab: HandoffAttachTab }) {
  return (
    <div
      role="tabpanel"
      id={`attach-panel-${tab.id}`}
      aria-labelledby={`attach-tab-${tab.id}`}
      className="mt-3"
    >
      {/* `none`: this panel's own `mt-3` is the gap below the tab strip. */}
      <FootnoteLine spacing="none">{tab.body}</FootnoteLine>
      {tab.copy && (
        <CopyablePrompt text={tab.copy.text} label={tab.copy.label} />
      )}
    </div>
  );
}

import KeepThinkingPanel from './KeepThinkingPanel';
import SummaryView from './SummaryView';
import type { SummaryNode } from '../lib/summaryGroups';

/**
 * The end of the loop — and deliberately not a dead end. The plan is a
 * starting point, so there is still somewhere to put the next thought and the
 * map can keep moving.
 */
export default function SummaryScreen({ nodes }: { nodes: SummaryNode[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SummaryView nodes={nodes} />
      <KeepThinkingPanel />
    </div>
  );
}

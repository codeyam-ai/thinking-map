import ConversationPanel, { type ChatMessage } from './ConversationPanel';
import SummaryView from './SummaryView';
import type { SummaryNode } from '../lib/summaryGroups';

/**
 * The end of the loop — and deliberately not a dead end. The plan is a
 * starting point, so the conversation stays open beneath it and the map can
 * keep moving.
 */
export default function SummaryScreen({
  mapId,
  messages,
  nodes,
}: {
  mapId: string;
  messages: ChatMessage[];
  nodes: SummaryNode[];
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SummaryView nodes={nodes} />
      <section className="mx-auto max-w-[560px] pb-4">
        <h2 className="eyebrow mb-3 text-center">Keep thinking</h2>
        <div className="[&>section]:max-h-[320px] [&>section]:w-full">
          <ConversationPanel mapId={mapId} messages={messages} />
        </div>
      </section>
    </div>
  );
}

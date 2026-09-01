import ConversationPanel, { type ChatMessage } from './ConversationPanel';
import ThinkingMapView from './ThinkingMapView';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The working view: conversation on the left, map on the right. Two views of
 * the same thinking process, side by side.
 */
export default function MapWorkspace({
  mapId,
  messages,
  nodes,
  caption,
}: {
  mapId: string;
  messages: ChatMessage[];
  nodes: FlatNode[];
  caption: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <ConversationPanel mapId={mapId} messages={messages} />
      <ThinkingMapView nodes={nodes} caption={caption} />
    </div>
  );
}

import { summarizeMap } from './mapStore';

export interface MapListRow {
  id: string;
  title: string;
  phase: string;
  _count: { nodes: number; messages: number };
}

export interface MapDetail {
  title: string;
  phase: string;
  seedIdea: string;
  messages: { role: string; content: string }[];
  nodes: {
    id: string;
    parentId: string | null;
    kind: string;
    label: string;
    status: string;
  }[];
}

/**
 * Render the map list for an MCP client.
 *
 * Ids lead every row because they are what the client passes back to
 * get_thinking_map and every mutating tool — a pretty list without them would
 * be a dead end.
 */
export function formatMapList(maps: MapListRow[]): string {
  if (maps.length === 0) return 'No thinking maps yet.';
  return maps
    .map(
      (m) =>
        `[${m.id}] ${m.title} — phase ${m.phase}, ${m._count.nodes} nodes, ${m._count.messages} messages`,
    )
    .join('\n');
}

/**
 * Render one map in full for an MCP client: the seed idea kept verbatim, the
 * conversation, and the node tree. The two views are shown together because
 * they are two renderings of the same thinking.
 */
export function formatMapDetail(map: MapDetail): string {
  const conversation = map.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  return [
    `# ${map.title}`,
    `phase: ${map.phase}`,
    `seed idea: ${map.seedIdea}`,
    '',
    '## Conversation',
    conversation || '(none)',
    '',
    '## Map',
    summarizeMap(map.nodes),
  ].join('\n');
}

// The second front door.
//
// Everything the web UI can do to a thinking map, an MCP client can do too —
// and through the same mapStore functions, so the two surfaces cannot drift
// apart. One brain, two front doors: the browser is one, this is the other.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { applyToolCalls, createMap, getMap, listMaps } from './mapStore';
import { formatMapDetail, formatMapList } from './mcpFormat';
import { NODE_KINDS, NODE_STATUSES, PHASES } from './mapKinds';

const nodeShape = z.object({
  ref: z
    .string()
    .describe(
      'A temporary id for this node so later nodes in the same call can name it as their parent.',
    ),
  parentRef: z
    .string()
    .optional()
    .describe(
      'The ref of a node created earlier in this call, or the real id of an existing node. Omit only for a root idea.',
    ),
  kind: z.enum(NODE_KINDS),
  label: z.string().describe('Short text for the pill; aim for under 40 characters.'),
  detail: z.string().optional(),
  status: z.enum(NODE_STATUSES).optional(),
  sourceUrl: z.string().optional(),
});

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * Build a fresh server instance. One per request in the stateless HTTP mode —
 * the server object is cheap, and per-request construction keeps concurrent
 * clients from sharing transport state.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'thinking-map',
    version: '0.1.0',
  });

  server.registerTool(
    'list_thinking_maps',
    {
      title: 'List thinking maps',
      description:
        'List every thinking map, newest first, with the phase each has reached.',
    },
    async () => textResult(formatMapList(await listMaps())),
  );

  server.registerTool(
    'get_thinking_map',
    {
      title: 'Read a thinking map',
      description:
        'Read one map in full: the conversation so far and the current node tree, indented by depth.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const map = await getMap(id);
      if (!map) return textResult(`No map with id ${id}.`);
      return textResult(formatMapDetail(map));
    },
  );

  server.registerTool(
    'create_thinking_map',
    {
      title: 'Start a thinking map',
      description:
        'Start a new map from an unstructured idea, problem, or goal. The idea is kept verbatim as the root node and as the first message.',
      inputSchema: { seedIdea: z.string() },
    },
    async ({ seedIdea }) => {
      const map = await createMap(seedIdea);
      return textResult(`Created map ${map.id} — "${map.title}".`);
    },
  );

  server.registerTool(
    'add_map_nodes',
    {
      title: 'Add nodes to a map',
      description:
        'Add one or more nodes. Parents must appear before their children. Use status "open" for a question nobody has answered yet.',
      inputSchema: { mapId: z.string(), nodes: z.array(nodeShape) },
    },
    async ({ mapId, nodes }) => {
      await applyToolCalls(mapId, [{ name: 'add_nodes', input: { nodes } }]);
      return textResult(`Added ${nodes.length} node(s) to ${mapId}.`);
    },
  );

  server.registerTool(
    'update_map_node',
    {
      title: 'Update a node',
      description:
        'Change an existing node — typically when an answer resolves an open question. Set status "updated" for the one thing that just changed.',
      inputSchema: {
        mapId: z.string(),
        id: z.string(),
        label: z.string().optional(),
        detail: z.string().optional(),
        kind: z.enum(NODE_KINDS).optional(),
        status: z.enum(NODE_STATUSES).optional(),
      },
    },
    async ({ mapId, ...patch }) => {
      await applyToolCalls(mapId, [{ name: 'update_node', input: patch }]);
      return textResult(`Updated node ${patch.id}.`);
    },
  );

  server.registerTool(
    'set_map_phase',
    {
      title: 'Move a map to a new phase',
      description:
        'Advance the map through the loop once the conversation has genuinely reached the next phase.',
      inputSchema: { mapId: z.string(), phase: z.enum(PHASES) },
    },
    async ({ mapId, phase }) => {
      await applyToolCalls(mapId, [{ name: 'set_phase', input: { phase } }]);
      return textResult(`Map ${mapId} is now in the ${phase} phase.`);
    },
  );

  return server;
}

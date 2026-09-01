// The server front doors.
//
// Everything the page can do to a thinking map, an MCP client over HTTP or
// stdio can do too — and now through the same tool catalog rather than a
// parallel hand-written list, so the three doors cannot drift apart. This file
// is only the server-side binding: it loops the catalog, injects `mapId` from
// each call's input, and adds the two tools that make sense only out here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createMap, listMaps } from './mapStore';
import { formatMapList } from './mcpFormat';
import { TOOL_CATALOG } from './toolCatalog';
import { runTool } from './toolRuntime';

function textResult(text: string, structured?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/**
 * Build a fresh server instance. One per request in the stateless HTTP mode —
 * the server object is cheap, and per-request construction keeps concurrent
 * clients from sharing transport state.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'thinking-map',
    version: '0.2.0',
  });

  // ── Server-door-only tools ───────────────────
  // A page is already scoped to one map, so neither of these belongs in the
  // shared catalog.

  server.registerTool(
    'list_thinking_maps',
    {
      title: 'List thinking maps',
      description:
        'List every thinking map, newest first, with the phase each has reached.',
      annotations: { readOnlyHint: true },
    },
    async () => textResult(formatMapList(await listMaps())),
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

  // ── The shared catalog ───────────────────────
  // Out here the agent has no page, so it must name the map it means. The
  // `mapId` argument is spliced onto each tool's own schema and stripped back
  // off before the tool runs, which is the only difference between this door
  // and the page's.

  for (const tool of TOOL_CATALOG) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: {
          mapId: z.string().describe('The map to act on.'),
          ...(tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape,
        },
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (args: Record<string, unknown>) => {
        const { mapId, ...input } = args;
        // No `client` on a server door: there is no page to raise a question
        // in, so `ask_user` degrades to leaving the questions on the map and
        // handing back a cursor to poll.
        return runTool(tool.name, input, {
          mapId: String(mapId),
          origin: 'agent',
        });
      },
    );
  }

  return server;
}

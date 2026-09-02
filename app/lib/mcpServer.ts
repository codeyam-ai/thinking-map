// The server front doors.
//
// Everything the page can do to a thinking map, an MCP client over HTTP or
// stdio can do too — and now through the same tool catalog rather than a
// parallel hand-written list, so the three doors cannot drift apart. This file
// is only the server-side binding: it loops the catalog, injects `mapId` from
// each call's input, and adds the two tools that make sense only out here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { waitForNewMap } from './exchange';
import { createMap, listMaps } from './mapStore';
import { formatMapList, formatNewMaps } from './mcpFormat';
import { TOOL_CATALOG, timeoutMsFrom } from './toolCatalog';
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

  server.registerTool(
    'await_new_map',
    {
      title: 'Wait for someone to start a map',
      // The description IS the interface here: it is the only thing an agent
      // reads before deciding whether to call this, so it has to say what the
      // call is for and what to do with the result, not just what it returns.
      description:
        'Park here when you have nothing else to do. Blocks until someone starts a new thinking map, then hands you each one with its id, title and seed idea, and whether it was started from a brief. Then read it — read_brief when it has a brief, otherwise read_map — and begin deconstructing the idea. Bounded: on expiry you get timedOut true and a cursor; that is normal, not an error, so call again with the cursor and keep waiting. Pass the cursor every time and you cannot miss a map created in the gap.',
      inputSchema: {
        since: z.string().optional(),
        timeoutSeconds: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ since, timeoutSeconds }) => {
      // An absent or unparseable `since` means "from now" — an agent parking
      // for the first time wants what happens next, not the entire backlog.
      const parsed = since ? new Date(since) : null;
      const from =
        parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();

      // The existing clamp, not a fresh one, so this cannot be talked into an
      // unbounded wait any more than `await_user_activity` can.
      const result = await waitForNewMap(from, timeoutMsFrom(timeoutSeconds));

      return textResult(formatNewMaps(result.maps, result.cursor), {
        timedOut: result.timedOut,
        cursor: result.cursor,
        maps: result.maps.map((map) => ({
          id: map.id,
          title: map.title,
          seedIdea: map.seedIdea,
          hasBrief: map.hasBrief,
          createdAt: map.createdAt.toISOString(),
        })),
      });
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

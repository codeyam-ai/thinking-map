// Thinking Map as a stdio MCP server, for clients that launch the server as a
// child process (Claude Desktop among them) rather than calling it over HTTP.
//
// It is the same `buildMcpServer()` the /api/mcp route serves, against the same
// database — the transport differs, and so does the map scope: this door lists
// every map, where the HTTP one lists only the calling browser's. See `MapScope`.
//
// Run with:  npm run mcp
//
// That script sets `--conditions=react-server`, and the door does not open
// without it. `app/lib/toolRuntime.ts` and `app/lib/briefText.ts` both import
// `server-only`, whose whole job is to throw when it is reached from anywhere
// but a server component — out here there is no bundler mapping it away, so
// plain Node runs the throwing module and this process dies before the
// transport is ever connected. The condition resolves it to the package's own
// empty module, exactly as Next does, which keeps the guard meaningful in the
// app without making it fatal here.
//
// The Prisma client resolves DATABASE_URL through the usual dotenv cascade, so
// a client launching this needs no environment beyond the working directory.

import '../app/lib/loadEnv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from '../app/lib/mcpServer';

async function main() {
  // Every map, unlike the HTTP door. A client that can launch this process can
  // already read the database it points at, so there is nothing for a visitor
  // filter to protect here — and a client launched by a person to work on their
  // own maps must be able to see them without first holding a browser cookie.
  const server = buildMcpServer({ kind: 'all' });
  // stdout is the JSON-RPC channel here, so anything we want to say goes to
  // stderr — a stray console.log would corrupt the protocol stream.
  await server.connect(new StdioServerTransport());
  console.error('thinking-map MCP server ready on stdio');
}

main().catch((error) => {
  console.error('thinking-map MCP server failed to start:', error);
  process.exit(1);
});

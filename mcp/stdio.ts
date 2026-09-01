// Thinking Map as a stdio MCP server, for clients that launch the server as a
// child process (Claude Desktop among them) rather than calling it over HTTP.
//
// It is the same `buildMcpServer()` the /api/mcp route serves, against the same
// database — only the transport differs.
//
// Run with:  npm run mcp
//
// The Prisma client resolves DATABASE_URL through the usual dotenv cascade, so
// a client launching this needs no environment beyond the working directory.

import '../app/lib/loadEnv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from '../app/lib/mcpServer';

async function main() {
  const server = buildMcpServer();
  // stdout is the JSON-RPC channel here, so anything we want to say goes to
  // stderr — a stray console.log would corrupt the protocol stream.
  await server.connect(new StdioServerTransport());
  console.error('thinking-map MCP server ready on stdio');
}

main().catch((error) => {
  console.error('thinking-map MCP server failed to start:', error);
  process.exit(1);
});

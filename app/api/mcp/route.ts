import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildMcpServer } from '@/app/lib/mcpServer';

export const dynamic = 'force-dynamic';

/**
 * The MCP endpoint. Stateless: a fresh server and transport per request, so
 * concurrent clients never share transport state. The tools underneath are the
 * same mapStore functions the web UI calls.
 */
async function handle(request: Request): Promise<Response> {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

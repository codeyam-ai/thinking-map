import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildMcpServer } from '@/app/lib/mcpServer';
import {
  VISITOR_COOKIE,
  mintVisitorId,
  readVisitorId,
  visitorCookieOptions,
} from '@/app/lib/visitor';

export const dynamic = 'force-dynamic';

/**
 * The MCP endpoint. Stateless: a fresh server and transport per request, so
 * concurrent clients never share transport state. The tools underneath are the
 * same mapStore functions the web UI calls.
 *
 * Visitor-scoped, unlike the stdio door in `mcp/stdio.ts`. This one is on the
 * public URL, so an unscoped `list_thinking_maps` here would keep handing out
 * every map's id and title after the landing page it mirrors had stopped —
 * the same enumeration, one endpoint over.
 *
 * A caller with no visitor cookie gets one minted on its way out, exactly as it
 * would from `POST /api/maps`. A client that keeps cookies can therefore create
 * a map and list it back; one that discards them creates maps belonging to
 * nobody and lists nothing, and still gets each new map's id in the reply.
 */
async function handle(request: Request): Promise<Response> {
  const existingVisitorId = await readVisitorId();
  const visitorId = existingVisitorId ?? mintVisitorId();

  const server = buildMcpServer({ kind: 'visitor', visitorId });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);

  if (!existingVisitorId) {
    // Appended rather than set on a fresh response: the transport owns this one,
    // including the streaming body, so it must be handed back untouched apart
    // from the header.
    const { httpOnly, sameSite, secure, maxAge, path } = visitorCookieOptions();
    response.headers.append(
      'Set-Cookie',
      [
        `${VISITOR_COOKIE}=${visitorId}`,
        `Path=${path}`,
        `Max-Age=${maxAge}`,
        `SameSite=${sameSite === 'lax' ? 'Lax' : sameSite}`,
        httpOnly ? 'HttpOnly' : '',
        secure ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; '),
    );
  }
  return response;
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

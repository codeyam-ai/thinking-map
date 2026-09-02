// How a tool called in the page actually runs.
//
// The WebMCP binding lives in the browser, but every tool it exposes ends in
// SQLite — so the page cannot execute the catalog itself. It describes the
// tools to the agent and forwards each call here, where the shared runtime runs
// it exactly as the HTTP and stdio doors do. That forwarding is the only
// difference between the three front doors; the behaviour behind them is one
// implementation.

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { TOOL_CATALOG } from '@/app/lib/toolCatalog';
import { runTool } from '@/app/lib/toolRuntime';
import { withFailure } from '@/app/lib/apiFailure';

export const dynamic = 'force-dynamic';

/** GET — what this map's agent can do. Useful to a driver, and to a human
 *  wondering what the page is offering. */
export const GET = withFailure(async () => {
  return NextResponse.json({
    tools: TOOL_CATALOG.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      annotations: t.annotations ?? {},
    })),
  });
});

export const POST = withFailure(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const map = await prisma.thinkingMap.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!map) {
      return NextResponse.json({ error: 'No such map' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Expected a JSON body.' },
        { status: 400 },
      );
    }

    const { name, input } = (body ?? {}) as { name?: unknown; input?: unknown };
    if (typeof name !== 'string') {
      return NextResponse.json(
        { error: '`name` must be the name of a tool.' },
        { status: 400 },
      );
    }

    // No `client` here: the person is on the other side of this request, not
    // reachable from it. `ask_user` therefore returns its pending result, and the
    // browser bridge is what adds the waiting-for-a-human step around it.
    const result = await runTool(name, input, { mapId: id, origin: 'agent' });

    // A tool that declined a write, or timed out, still answered the question it
    // was asked — so the transport is 200 and the outcome is in the body. Only a
    // malformed request gets a non-2xx.
    return NextResponse.json(result);
  },
);

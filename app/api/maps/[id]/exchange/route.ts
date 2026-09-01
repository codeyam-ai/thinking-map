// The page's write path into the exchange log.
//
// The tools run in the browser, but the log lives in SQLite — so everything the
// person contributes has to come back through here. Both the WebMCP bridge and
// the contribution affordances in the UI write through this one route, which
// keeps "what the human did" a server-side fact rather than browser state an
// agent on another front door could never see.

import { NextResponse } from 'next/server';
import {
  isUserEventKind,
  readSince,
  recordEvents,
  USER_EVENT_KINDS,
} from '@/app/lib/exchange';
import { contributionEvents } from '@/app/lib/contributions';
import { prisma } from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

async function mapExists(id: string): Promise<boolean> {
  const map = await prisma.thinkingMap.findUnique({
    where: { id },
    select: { id: true },
  });
  return map !== null;
}

/**
 * The node a question is about, if it is genuinely on this map.
 *
 * Scoping the lookup by `mapId` is the same ownership check `mapExists` makes,
 * pushed down to the payload: without it a caller could ask about a node
 * belonging to somebody else's map and have the question logged here. The label
 * comes back with it because the rail names the node, and reading it once here
 * is cheaper than making the renderer re-query per row.
 */
async function nodeOnMap(
  mapId: string,
  nodeId: string,
): Promise<{ id: string; label: string } | null> {
  return prisma.mapNode.findFirst({
    where: { id: nodeId, mapId },
    select: { id: true, label: true },
  });
}

/**
 * GET /api/maps/:id/exchange?since=<revision>
 *
 * Omit `since` for the whole log. The current revision comes back either way,
 * so a caller with an empty delta still leaves holding a usable cursor.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await mapExists(id))) {
    return NextResponse.json({ error: 'No such map' }, { status: 404 });
  }

  const raw = new URL(request.url).searchParams.get('since');
  const since = raw === null ? null : Number(raw);
  if (since !== null && !Number.isInteger(since)) {
    return NextResponse.json(
      { error: '`since` must be a whole number.' },
      { status: 400 },
    );
  }

  return NextResponse.json(await readSince(id, since));
}

/**
 * POST /api/maps/:id/exchange
 *
 * Records one user-origin event. Only the user-side kinds are accepted: the
 * agent's own kinds are minted by the tools, and taking one from the browser
 * would let the page forge the other side of the conversation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await mapExists(id))) {
    return NextResponse.json({ error: 'No such map' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const { kind, payload, requestId } = (body ?? {}) as {
    kind?: unknown;
    payload?: unknown;
    requestId?: unknown;
  };

  if (typeof kind !== 'string' || !isUserEventKind(kind)) {
    return NextResponse.json(
      {
        error: `\`kind\` must be one of: ${USER_EVENT_KINDS.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  // A question is about one specific node, and that is the whole point of the
  // kind — so a `nodeId` that names nothing on this map is a bad request, not a
  // question to log and puzzle over later. Resolving it here also picks up the
  // label the rail needs, which is why the payload goes on enriched.
  let contributed = payload;
  if (kind === 'user.question') {
    const nodeId = (payload as { nodeId?: unknown } | null)?.nodeId;
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      return NextResponse.json(
        { error: '`payload.nodeId` is required for a user.question.' },
        { status: 400 },
      );
    }
    const node = await nodeOnMap(id, nodeId);
    if (!node) {
      return NextResponse.json(
        { error: 'No such node on this map.' },
        { status: 400 },
      );
    }
    contributed = { ...(payload as Record<string, unknown>), label: node.label };
  }

  // A contribution is an event, but the interesting ones are also a change to
  // the map — a node that has to appear, a question that has to stop being
  // open. Those writes happen first, and everything they produce is recorded in
  // one batch so the act and its consequences share one run of revisions.
  const events = await contributionEvents(id, kind, contributed);

  const result = await recordEvents(id, events, {
    requestId: typeof requestId === 'string' ? requestId : null,
  });

  return NextResponse.json({
    revision: result.revision,
    events: result.events,
    deduped: result.deduped,
  });
}

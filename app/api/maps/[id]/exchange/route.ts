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

  // A contribution is an event, but the interesting ones are also a change to
  // the map — a node that has to appear, a question that has to stop being
  // open. Those writes happen first, and everything they produce is recorded in
  // one batch so the act and its consequences share one run of revisions.
  const events = await contributionEvents(id, kind, payload);

  const result = await recordEvents(id, events, {
    requestId: typeof requestId === 'string' ? requestId : null,
  });

  return NextResponse.json({
    revision: result.revision,
    events: result.events,
    deduped: result.deduped,
  });
}

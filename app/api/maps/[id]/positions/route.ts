// Where a nudged node's arrangement is written down.
//
// VESTIGIAL as of the "The Map Builds Downward" plan: nothing calls this any
// more. The map is a scrolling column of card rows with no plane to drag a node
// around on, so no nudge is ever produced. It is kept rather than removed
// because the `offsetX` / `offsetY` columns it writes are kept, and dropping
// those is a migration that plan deliberately is not.
//
// Deliberately NOT an exchange event. Every other change to the map becomes an
// ordered MapEvent, because the activity rail is the record of what the two
// sides *thought* — and "moved a node 40px left" would bury that under
// furniture-rearranging. The honest cost, called out so it is a decision rather
// than a surprise: a move does not bump `revision`, so a second viewer picks it
// up on their next load rather than immediately. For a tool that is one person
// and their agent, that is the right trade.

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

/** One node's arrangement, as a client would ask for it. */
interface Nudge {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

/**
 * Read a nudge batch off a request body.
 *
 * Returns the parsed batch, or a string carrying the message to send back —
 * the caller decides the status code, this decides what is acceptable.
 *
 * A drag could settle several nodes at once, so the batch is the shape of the
 * request; a lone object is accepted as a batch of one rather than making the
 * common case wrap itself in an array.
 *
 * Inlined here when the plane was retired. It used to be its own module so the
 * rule could be unit-tested without standing up an HTTP request; with no caller
 * left to produce a nudge, a separate module for one dead route's validation
 * was more structure than the thing deserves. Exported rather than local for
 * the same reason it was ever separate: the rule about what a well-formed nudge
 * is stays checkable without an HTTP request.
 */
export function parseNudges(body: unknown): Nudge[] | string {
  const raw = Array.isArray(body) ? body : [body];
  if (raw.length === 0) return 'Expected at least one node position.';

  const nudges: Nudge[] = [];
  for (const entry of raw) {
    const { nodeId, offsetX, offsetY } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof nodeId !== 'string' || nodeId === '') {
      return '`nodeId` must be a non-empty string.';
    }
    // Finite, not merely numeric: NaN and Infinity are both `typeof number`,
    // and either one written to the column would put a node nowhere.
    if (typeof offsetX !== 'number' || !Number.isFinite(offsetX)) {
      return '`offsetX` and `offsetY` must be finite numbers.';
    }
    if (typeof offsetY !== 'number' || !Number.isFinite(offsetY)) {
      return '`offsetX` and `offsetY` must be finite numbers.';
    }
    nudges.push({ nodeId, offsetX, offsetY });
  }
  return nudges;
}

/**
 * PATCH /api/maps/:id/positions
 *
 * Body: `{ nodeId, offsetX, offsetY }` or an array of them.
 *
 * The offsets are a nudge away from the computed tidy position, not a
 * coordinate — see the MapNode schema comment for why that distinction is
 * load-bearing.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = parseNudges(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  // Every node has to belong to THIS map. Without the check, a known node id
  // could be moved through any map's URL.
  const owned = await prisma.mapNode.findMany({
    where: { mapId: id, id: { in: parsed.map((n) => n.nodeId) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((n) => n.id));
  const stranger = parsed.find((n) => !ownedIds.has(n.nodeId));
  if (stranger) {
    return NextResponse.json(
      { error: `No node ${stranger.nodeId} on this map.` },
      { status: 404 },
    );
  }

  await prisma.$transaction(
    parsed.map((n) =>
      prisma.mapNode.update({
        where: { id: n.nodeId },
        data: { offsetX: n.offsetX, offsetY: n.offsetY },
      }),
    ),
  );

  return NextResponse.json({ moved: parsed.length });
}

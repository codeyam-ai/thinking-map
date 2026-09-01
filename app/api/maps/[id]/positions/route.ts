// Where a nudged node's arrangement is written down.
//
// Deliberately NOT an exchange event. Every other change to the map becomes an
// ordered MapEvent, because the activity rail is the record of what the two
// sides *thought* — and "moved a node 40px left" would bury that under
// furniture-rearranging. The honest cost, called out so it is a decision rather
// than a surprise: a move does not bump `revision`, so a second viewer picks it
// up on their next load rather than immediately. For a tool that is one person
// and their agent, that is the right trade.

import { NextResponse } from 'next/server';
import { parseNudges } from '@/app/lib/nodePositions';
import { prisma } from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

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

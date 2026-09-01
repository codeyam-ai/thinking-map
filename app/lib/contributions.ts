// What a contribution from the page actually does to the map.
//
// A contribution is an event, but the interesting ones are also a change: a
// node the person added has to appear in the tree, and a question they answered
// has to stop being open. Doing that here rather than in the route keeps the
// route thin, and keeps the effect server-side — where every front door sees
// it, rather than as browser state an agent on the stdio door could never know
// about.
//
// Each function returns the events its writes should be logged as. The caller
// records them in one batch so a contribution and its consequences share one
// run of revisions, and an agent reading the log sees them together.

import { prisma } from './prisma';
import { isNodeKind } from './mapKinds';
import type { EventInput, EventKind } from './exchange';

/** The person's answers, as the page sends them. */
interface AnswerInput {
  id?: unknown;
  text?: unknown;
  answer?: unknown;
}

function answersOf(payload: unknown): { id: string; answer: string }[] {
  const raw = (payload as { answers?: AnswerInput[] } | null)?.answers;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => ({
      id: typeof a?.id === 'string' ? a.id : '',
      answer: typeof a?.answer === 'string' ? a.answer : '',
    }))
    .filter((a) => a.id.length > 0);
}

/**
 * Close the questions an answer resolves.
 *
 * Only a node that is genuinely still open is touched, so answering the same
 * question twice logs the second answer without inventing a second change. A
 * node that has since been deleted is skipped rather than failing the write —
 * the answer itself is the part worth keeping.
 */
async function resolveAnswered(
  mapId: string,
  payload: unknown,
): Promise<EventInput[]> {
  const answers = answersOf(payload);
  if (answers.length === 0) return [];

  const events: EventInput[] = [];
  for (const { id } of answers) {
    const { count } = await prisma.mapNode.updateMany({
      where: { id, mapId, status: 'open' },
      data: { status: 'answered' },
    });
    if (count > 0) {
      events.push({
        kind: 'node.updated',
        origin: 'user',
        payload: { id, status: 'answered' },
      });
    }
  }
  return events;
}

/**
 * Put the person's node on the map.
 *
 * It is written with `origin: 'user'`, which is the same fact the pill reads to
 * badge it and the tools read to avoid re-ingesting their own writes. With no
 * parent named it hangs off the root, because a second root would read as a
 * second idea rather than a contribution to this one.
 */
async function addUserNode(
  mapId: string,
  payload: unknown,
): Promise<EventInput[]> {
  const record = (payload ?? {}) as Record<string, unknown>;
  const label = typeof record.label === 'string' ? record.label.trim() : '';
  const kind =
    typeof record.kind === 'string' && isNodeKind(record.kind)
      ? record.kind
      : 'finding';
  if (label.length === 0) return [];

  let parentId =
    typeof record.parentId === 'string' && record.parentId.length > 0
      ? record.parentId
      : null;
  if (parentId === null) {
    const root = await prisma.mapNode.findFirst({
      where: { mapId, parentId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    parentId = root?.id ?? null;
  }

  const last = await prisma.mapNode.findFirst({
    where: { mapId, parentId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const created = await prisma.mapNode.create({
    data: {
      mapId,
      parentId,
      kind,
      label,
      status: 'answered',
      order: (last?.order ?? -1) + 1,
      origin: 'user',
    },
  });

  return [
    {
      kind: 'user.node',
      origin: 'user',
      payload: {
        id: created.id,
        parentId: created.parentId,
        kind: created.kind,
        label: created.label,
        status: created.status,
      },
    },
  ];
}

/**
 * Turn one contribution into the events that should be recorded for it.
 *
 * `user.note` and `user.question` are only ever events — something said about
 * the map rather than a change to it. A question deliberately does NOT touch
 * the node it names: asking about a pill should not mark it, reorder it, or
 * reopen it, because the person asking has not decided anything yet. The other
 * two change the map first and then say so.
 */
export async function contributionEvents(
  mapId: string,
  kind: EventKind,
  payload: unknown,
): Promise<EventInput[]> {
  if (kind === 'user.node') {
    // The node's own event carries the real id, so the raw request is not
    // logged as well — one act, one event.
    return addUserNode(mapId, payload);
  }

  const events: EventInput[] = [
    { kind, origin: 'user', payload: payload ?? {} },
  ];
  if (kind === 'user.answer') {
    events.push(...(await resolveAnswered(mapId, payload)));
  }
  return events;
}

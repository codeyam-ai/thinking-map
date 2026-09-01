// Database access for thinking maps. Everything that reads or writes the map
// goes through here so the API routes and the MCP server share one
// implementation rather than drifting apart.

import { prisma } from './prisma';
import type { BriefInput } from './briefInput';
import { computeBriefCoverage, type CoverageNode } from './briefCoverage';
import { splitIntoSections } from './briefSections';
import { KIND_EYEBROW } from './mapKinds';
import { planMapMutations, type ToolInvocation } from './nodePlan';
import {
  MAP_CREATED,
  mapEvents,
  recordEvents,
  type EventInput,
  type NewMapSummary,
  type Origin,
} from './exchange';

export async function listMaps() {
  return prisma.thinkingMap.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      seedIdea: true,
      phase: true,
      updatedAt: true,
      _count: { select: { nodes: true, messages: true } },
    },
  });
}

export async function getMap(id: string) {
  return prisma.thinkingMap.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      nodes: { orderBy: [{ createdAt: 'asc' }, { order: 'asc' }] },
      // Metadata only. The brief's text has exactly one reader — `read_brief` —
      // and pulling it in here would put tens of thousands of characters into
      // every page render and every full `read_map`.
      brief: { select: { sourceName: true, mediaType: true, charCount: true } },
    },
  });
}

/** The brief's text, for the one caller that is allowed to want it. */
export async function getBrief(mapId: string) {
  return prisma.mapBrief.findUnique({ where: { mapId } });
}

/**
 * The brief's coverage by the nodes on the map, ready to render.
 *
 * Lives here rather than in `briefCoverage.ts` on purpose: that module is
 * deliberately pure — sections and nodes in, counts out, no database — and it
 * is the pure half that is worth testing. This is the thin part that reaches
 * for the text.
 *
 * Note what does NOT come back: the brief's text. `getMap` fetches the brief's
 * metadata without it precisely because a document can be tens of thousands of
 * characters, and splitting into sections needs the text but yields only
 * headings and lengths. So the panel can be rendered on the server without the
 * document ever crossing to the client.
 *
 * Returns null when the map has no brief — the workspace renders that by
 * mounting no panel at all, not by rendering an empty one.
 */
export async function getBriefCoverage(mapId: string, nodes: CoverageNode[]) {
  const brief = await getBrief(mapId);
  if (!brief) return null;
  return {
    sourceName: brief.sourceName,
    coverage: computeBriefCoverage(splitIntoSections(brief.text), nodes),
  };
}

/**
 * Name the map from whatever the person gave us.
 *
 * A brief's first markdown heading is the document's own title and is almost
 * always the right answer; its first non-empty line is the next best guess.
 * Without a brief this is the original behaviour, unchanged: the seed idea,
 * clipped — which is how every map that already exists was named.
 */
export function deriveTitle(seedIdea: string, brief?: BriefInput): string {
  const clip = (text: string) =>
    text.length > 60 ? `${text.slice(0, 57)}…` : text;

  if (brief) {
    const lines = brief.text.split('\n');
    const heading = lines.find((line) => /^#{1,6}\s+\S/.test(line));
    if (heading) return clip(heading.replace(/^#{1,6}\s+/, '').trim());
    const firstLine = lines.find((line) => line.trim().length > 0);
    if (firstLine) return clip(firstLine.trim());
  }

  return clip(seedIdea.trim());
}

/** Start a new map from an unstructured idea. The seed idea becomes both the
 *  root node and the person's first message — the conversation and the map are
 *  two views of the same thing from the very first turn.
 *
 *  A brief, when there is one, is written in the SAME transaction: it is the
 *  map's source, so a map existing without the document it was started from is
 *  a state nothing downstream should have to handle. It is written once here
 *  and never again — a revised brief is a new map. */
export async function createMap(seedIdea: string, brief?: BriefInput) {
  const trimmed = seedIdea.trim();
  const title = deriveTitle(trimmed, brief);

  // The seed idea is the person's, so the root node and the opening message are
  // user-origin. An agent reading the log must not mistake the human's starting
  // idea for something it wrote itself.
  const map = await prisma.thinkingMap.create({
    data: {
      title,
      seedIdea: trimmed,
      phase: 'map',
      ...(brief
        ? {
            brief: {
              create: {
                text: brief.text,
                sourceName: brief.sourceName,
                mediaType: brief.mediaType,
                charCount: brief.text.length,
              },
            },
          }
        : {}),
      // A brief can arrive with no sentence beside it, and an empty opening
      // message would read to an agent as a person who said nothing — worse
      // than a conversation that has not started yet.
      ...(trimmed
        ? {
            messages: {
              create: [{ role: 'user', origin: 'user', content: trimmed }],
            },
          }
        : {}),
      nodes: {
        create: [
          {
            kind: 'idea',
            label: title,
            status: 'answered',
            order: 0,
            origin: 'user',
          },
        ],
      },
    },
    include: { nodes: true },
  });

  // Revision 1 is "the root idea exists". Leaving a new map at revision 0 with
  // an empty log would give an agent no way to tell a brand-new map from one it
  // has already read to the end.
  const root = map.nodes[0];
  await recordEvents(map.id, [
    {
      kind: 'node.added',
      origin: 'user',
      payload: { id: root?.id, kind: 'idea', label: title },
    },
  ]);

  // Wake anyone parked in `waitForNewMap`.
  //
  // AFTER `recordEvents`, deliberately: a waiter woken before the root node's
  // event exists would read a map whose log is empty and conclude there was
  // nothing to do — the one race that would make parking worse than polling.
  //
  // Best-effort and in-process only. Correctness across processes is the
  // waiter's poll, not this: the stdio MCP server does not share an emitter
  // with Next, so an agent connected there is woken by the poll and this emit
  // is purely the same-process fast path.
  const summary: NewMapSummary = {
    id: map.id,
    title: map.title,
    seedIdea: map.seedIdea,
    hasBrief: brief !== undefined,
    createdAt: map.createdAt,
  };
  mapEvents.emit(MAP_CREATED, summary);

  return map;
}

/** A compact rendering of the current map, given to the model as context so it
 *  can reference real node ids when it updates them. */
export function summarizeMap(
  nodes: { id: string; parentId: string | null; kind: string; label: string; status: string }[],
): string {
  if (nodes.length === 0) return '(empty — nothing on the map yet)';
  const byParent = new Map<string | null, typeof nodes>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const lines: string[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const n of byParent.get(parentId) ?? []) {
      const eyebrow = KIND_EYEBROW[n.kind as keyof typeof KIND_EYEBROW] ?? n.kind;
      lines.push(
        `${'  '.repeat(depth)}- [${n.id}] (${eyebrow}, ${n.status}) ${n.label}`,
      );
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return lines.join('\n');
}

/**
 * Apply the model's requested map mutations.
 *
 * The rules — which kinds are drawable, which statuses are real, what order
 * siblings take — all live in `planMapMutations`, which is pure and tested.
 * This function is the thin executor: it walks the plan in order, resolving
 * each temporary ref to the real id the database just handed back, so one
 * add_nodes call can create a parent and its children together.
 *
 * It now has a second output: every write also becomes an ordered event on the
 * map's log, tagged with the side that made it. That is what lets a person and
 * an agent work the same map without either one having to be told what the
 * other did.
 */
export async function applyToolCalls(
  mapId: string,
  calls: ToolInvocation[],
  options: { origin?: Origin; requestId?: string | null } = {},
) {
  const origin: Origin = options.origin ?? 'agent';
  const { inserts, updates, phase } = planMapMutations(calls);
  const refToId = new Map<string, string>();
  const events: EventInput[] = [];

  for (const node of inserts) {
    // A parentRef is either a ref from earlier in this same plan or the real
    // id of a node already on the map.
    const parentId = node.parentRef
      ? (refToId.get(node.parentRef) ?? node.parentRef)
      : null;

    // The same resolution, for the same reason: a slice usually names an
    // assumption created earlier in this very call, so the ref has to become a
    // real id before it is stored. Unresolvable values are written through
    // rather than dropped — a dangling link is reported on screen, and losing
    // it silently would hide the fact that the slice claimed to settle
    // something at all.
    const testsNodeId = node.testsRef
      ? (refToId.get(node.testsRef) ?? node.testsRef)
      : null;

    const created = await prisma.mapNode.create({
      data: {
        mapId,
        parentId,
        kind: node.kind,
        label: node.label,
        detail: node.detail,
        status: node.status,
        sourceUrl: node.sourceUrl,
        testsNodeId,
        sourceRef: node.sourceRef,
        options: node.options,
        order: node.order,
        origin,
      },
    });
    if (node.ref) refToId.set(node.ref, created.id);
    events.push({
      kind: 'node.added',
      origin,
      payload: {
        id: created.id,
        parentId,
        kind: created.kind,
        label: created.label,
        status: created.status,
        // Carried on the event so an agent reading the log after the fact can
        // see which assumption a slice claimed to settle, not just that a
        // slice appeared.
        ...(testsNodeId ? { testsNodeId } : {}),
        // Carried in the payload so a second front door reading the log learns
        // where a claim came from, rather than that provenance existing only in
        // the database where the log's readers cannot see it. Omitted entirely
        // when absent, so an unreferenced node's event is unchanged.
        ...(created.sourceRef ? { sourceRef: created.sourceRef } : {}),
        // Carried for the same reason `sourceRef` is: a second front door
        // reading the log should learn what was offered alongside a question,
        // not just that a question appeared. Sent as the array the tools take
        // rather than the JSON string the column holds — the log speaks the
        // contract's language, not the database's. Omitted when absent, so an
        // ordinary question's event is byte-for-byte what it always was.
        ...(created.options
          ? { options: JSON.parse(created.options) as string[] }
          : {}),
      },
    });
  }

  for (const update of updates) {
    const resolved = refToId.get(update.id) ?? update.id;
    // A model can name a node that has since been deleted; updateMany skips
    // a miss rather than failing the whole turn.
    const { count } = await prisma.mapNode.updateMany({
      where: { id: resolved, mapId },
      data: { ...update.data, origin },
    });
    // Only log what actually changed. An event for a node that was not there
    // would be a revision no agent could reconcile against the map it can read.
    if (count > 0) {
      events.push({
        kind: 'node.updated',
        origin,
        payload: { id: resolved, ...update.data },
      });
    }
  }

  if (phase) {
    await prisma.thinkingMap.update({ where: { id: mapId }, data: { phase } });
    events.push({ kind: 'phase.set', origin, payload: { phase } });
  }

  return recordEvents(mapId, events, { requestId: options.requestId });
}

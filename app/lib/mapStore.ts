// Database access for thinking maps. Everything that reads or writes the map
// goes through here so the API routes and the MCP server share one
// implementation rather than drifting apart.

import { prisma } from './prisma';
import type { BriefInput } from './briefInput';
import { computeBriefCoverage, type CoverageNode } from './briefCoverage';
import { splitIntoSections } from './briefSections';
import { KIND_EYEBROW } from './mapKinds';
import { hueForIndex } from './themeHue';
import { planMapMutations, type ToolInvocation } from './nodePlan';
import {
  MAP_CREATED,
  findPriorBatch,
  mapEvents,
  recordEvents,
  type EventInput,
  type ExchangeClient,
  type NewMapSummary,
  type Origin,
} from './exchange';

/**
 * How long `applyToolCalls`' transaction may run before Prisma gives up.
 *
 * Prisma's 5s default was sized for a transaction holding one or two
 * statements; this one now holds every theme, node and update of a batch plus
 * the event append, and a large add_nodes call would trip that default. Long
 * enough for a whole board, short enough that a genuinely stuck write still
 * releases SQLite's single write lock rather than parking every other writer
 * behind it.
 */
const APPLY_TOOL_CALLS_TIMEOUT_MS = 30_000;

/**
 * Turn a ref into the id it names.
 *
 * A ref is one of two things and the caller cannot tell which: a temporary name
 * minted earlier in this same plan, or the real id of something already on the
 * board. Resolution tries the plan first and falls through to the value itself.
 *
 * An unresolvable value is returned UNCHANGED rather than dropped. That is the
 * load-bearing half: a dangling link is reported on screen, whereas silently
 * discarding it would hide the fact that the node claimed a relationship at all.
 */
export function resolveRef(refs: Map<string, string>, ref: string): string {
  return refs.get(ref) ?? ref;
}

/**
 * The `node.added` payload, as the log should carry it.
 *
 * Separate from the insert that produced the row because it is a translation,
 * not a write: the database's vocabulary in, the exchange contract's vocabulary
 * out. `options` is stored as a JSON string because SQLite has no array type,
 * and the log speaks the contract's language rather than the column's.
 *
 * The optional fields are OMITTED entirely when absent rather than sent as
 * null, so an ordinary node's event is byte-for-byte what it has always been
 * and a reader can treat presence as meaning.
 */
export function nodeAddedPayload(
  created: {
    id: string;
    kind: string;
    label: string;
    status: string;
    themeId: string | null;
    sourceRef: string | null;
    options: string | null;
  },
  parentId: string | null,
  testsNodeId: string | null,
  fromNodeIds: string[] | null = null,
): Record<string, unknown> {
  return {
    id: created.id,
    parentId,
    kind: created.kind,
    label: created.label,
    status: created.status,
    themeId: created.themeId,
    // Carried so an agent reading the log after the fact can see which
    // assumption a slice claimed to settle, not just that a slice appeared.
    ...(testsNodeId ? { testsNodeId } : {}),
    // Carried for the same reason, in the other direction: a reader should be
    // able to see what an insight came OUT of, not just that an insight
    // appeared. The RESOLVED ids rather than the JSON string the column holds —
    // the log speaks the contract's language, and a reader of the log should
    // never have to know how the row happens to be stored.
    ...(fromNodeIds && fromNodeIds.length > 0 ? { fromNodeIds } : {}),
    // Carried so a second front door reading the log learns where a claim came
    // from, rather than that provenance existing only in the database where the
    // log's readers cannot see it.
    ...(created.sourceRef ? { sourceRef: created.sourceRef } : {}),
    // Carried for the same reason `sourceRef` is: a reader should learn what
    // was offered alongside a question, not just that a question appeared.
    ...(created.options
      ? { options: JSON.parse(created.options) as string[] }
      : {}),
  };
}

/**
 * Write a plan's new themes and report what they became.
 *
 * Its own concern because the hue is positional: a theme's colour comes from
 * how many themes the map already had, so the count is taken ONCE up front
 * rather than re-read per theme, and it is taken inside the caller's
 * transaction so the index cannot be computed against a count another writer
 * has since changed.
 */
async function createThemes(
  tx: ExchangeClient,
  mapId: string,
  themes: { ref: string; label: string }[],
  origin: Origin,
): Promise<{ themeRefToId: Map<string, string>; events: EventInput[] }> {
  const themeRefToId = new Map<string, string>();
  const events: EventInput[] = [];
  if (themes.length === 0) return { themeRefToId, events };

  const existing = await tx.theme.count({ where: { mapId } });
  for (const [i, theme] of themes.entries()) {
    const created = await tx.theme.create({
      data: {
        mapId,
        label: theme.label,
        hue: hueForIndex(existing + i),
        order: existing + i,
      },
    });
    themeRefToId.set(theme.ref, created.id);
    events.push({
      kind: 'theme.added',
      origin,
      payload: { id: created.id, label: created.label, hue: created.hue },
    });
  }
  return { themeRefToId, events };
}

const MAP_LIST_SELECT = {
  id: true,
  title: true,
  seedIdea: true,
  phase: true,
  updatedAt: true,
  _count: { select: { nodes: true, messages: true } },
} as const;

/**
 * One browser's saved maps, newest first.
 *
 * The visitor id is REQUIRED rather than optional, and `null` returns nothing
 * rather than everything. That asymmetry is the whole point: an unfiltered list
 * used to hand every visitor every map anyone had ever made, so absence has to
 * mean "no maps of your own yet" — the day-one state the landing page is built
 * around — and never "here is everybody's".
 *
 * This scopes the LIST. It is not access control: `/map/<id>` stays reachable
 * by anyone holding the link, which is already how this product is used.
 */
export async function listMaps(visitorId: string | null) {
  if (!visitorId) return [];
  return prisma.thinkingMap.findMany({
    where: { visitorId },
    orderBy: { updatedAt: 'desc' },
    select: MAP_LIST_SELECT,
  });
}

/**
 * Every map on the instance, whoever made it.
 *
 * Deliberately its own function with a name that says so, rather than a `null`
 * or a missing argument to `listMaps`. One door legitimately wants this — the
 * MCP server door, whose caller is the operator running the process — and making
 * that door type out `listAllMaps` means the unscoped read can be found with one
 * grep instead of hiding inside a default.
 */
export async function listAllMaps() {
  return prisma.thinkingMap.findMany({
    orderBy: { updatedAt: 'desc' },
    select: MAP_LIST_SELECT,
  });
}

export async function getMap(id: string) {
  return prisma.thinkingMap.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      nodes: { orderBy: [{ createdAt: 'asc' }, { order: 'asc' }] },
      themes: { orderBy: { order: 'asc' } },
      // Metadata only. The brief's text has exactly one reader — `read_brief` —
      // and pulling it in here would put tens of thousands of characters into
      // every page render and every full `read_map`.
      brief: { select: { sourceName: true, mediaType: true, charCount: true } },
      // Metadata only, on exactly the reasoning above it: an attachment is a
      // megabyte where a brief is forty thousand characters, so selecting
      // `bytes` here would put a picture into every page render and every full
      // `read_map`. `byteSize` is the denormalised column that lets this say
      // whether there is a file without touching the file.
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, mediaType: true, byteSize: true },
      },
    },
  });
}

/** The brief's text, for the one caller that is allowed to want it. */
export async function getBrief(mapId: string) {
  return prisma.mapBrief.findUnique({ where: { mapId } });
}

/**
 * One attachment WITH its bytes, for the one caller that is allowed to want
 * them — `read_attachment`.
 *
 * The map-scoped lookup is the access rule and not a convenience: an id is a
 * cuid rather than a secret, so a query keyed on the attachment alone would let
 * an id learned from one board fetch a file off another. A mismatched pair
 * comes back null, which is the same answer as an id that never existed.
 */
export async function getAttachment(mapId: string, attachmentId: string) {
  return prisma.mapAttachment.findFirst({
    where: { id: attachmentId, mapId },
    select: { id: true, name: true, mediaType: true, bytes: true, byteSize: true },
  });
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
 *  and never again — a revised brief is a new map.
 *
 *  Attachments are names, not bytes, and are a different thing from a brief: a
 *  brief is a document the map is DERIVED from and can cite into, while these
 *  are things the person mentioned bringing along. Conflating them would let a
 *  filename be cited as a source. */
export async function createMap(
  seedIdea: string,
  brief?: BriefInput,
  attachments: { name: string }[] = [],
  visitorId: string | null = null,
) {
  const trimmed = seedIdea.trim();
  const title = deriveTitle(trimmed, brief);

  // The seed idea is the person's, so the root node and the opening message are
  // user-origin. An agent reading the log must not mistake the human's starting
  // idea for something it wrote itself.
  const map = await prisma.thinkingMap.create({
    data: {
      title,
      seedIdea: trimmed,
      // Which browser gets to see this in its saved-map list. Null for the doors
      // with no browser behind them — the MCP server door most of all — and a map
      // stamped null belongs to nobody rather than to everybody.
      visitorId,
      // Rows now, not a JSON column — but still names and no bytes. This door
      // is the one that creates a map and its attachments in a single
      // transaction, and bytes cannot travel in a JSON body alongside the
      // idea; the upload route is what carries a file, after the map exists.
      // A row with no bytes is exactly what it always was: a record that
      // something is part of this thinking, with nothing to look at.
      ...(attachments.length
        ? {
            attachments: {
              create: attachments.map((a) => ({
                name: a.name,
                mediaType: 'application/octet-stream',
                byteSize: 0,
              })),
            },
          }
        : {}),
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
 *
 * The whole call is ONE transaction, and the `requestId` check is its first
 * statement. Both facts are load-bearing:
 *
 *   • The check has to run before the writes, or a retry inserts a second copy
 *     of every node and is then told by `recordEvents` that nothing happened —
 *     a duplicate card on the board that the event log, the revision counter
 *     and the tool's own reply all agree does not exist.
 *   • The check has to run INSIDE the transaction, or two concurrent retries
 *     can both miss it and both write. A bare early return at the top of this
 *     function would fix the reported symptom and leave that race open.
 *   • The writes have to share the transaction with the event append, or a
 *     throw partway through the insert loop leaves nodes on the map with no
 *     events and no revision bump — a state no agent reading the log can
 *     reconcile, and one that also renders as an unexplained card.
 */
export async function applyToolCalls(
  mapId: string,
  calls: ToolInvocation[],
  options: { origin?: Origin; requestId?: string | null } = {},
) {
  const origin: Origin = options.origin ?? 'agent';
  const requestId = options.requestId ?? null;
  const { themes, inserts, updates, phase } = planMapMutations(calls);

  const result = await prisma.$transaction(
    async (tx) => {
      // First statement, before anything is written: a retry leaves the map
      // exactly as the original call left it, and gets that call's revision
      // and events back.
      const prior = await findPriorBatch(tx, mapId, requestId);
      if (prior) return prior;

      const refToId = new Map<string, string>();

      const themeWrites = await createThemes(tx, mapId, themes, origin);
      const themeRefToId = themeWrites.themeRefToId;
      const events: EventInput[] = [...themeWrites.events];

      for (const node of inserts) {
        // A parentRef is either a ref from earlier in this same plan or the real
        // id of a node already on the map.
        const parentId = node.parentRef
          ? resolveRef(refToId, node.parentRef)
          : null;

        // The same resolution, for the same reason: a slice usually names an
        // assumption created earlier in this very call, so the ref has to become
        // a real id before it is stored.
        const testsNodeId = node.testsRef
          ? resolveRef(refToId, node.testsRef)
          : null;

        // And again, once per cited source. An insight typically names the
        // questions the agent answered moments earlier in this same call, so
        // every ref has to become a real id before it is stored. Unresolvable
        // values are written through rather than dropped, for the reason
        // `resolveRef` already gives: a ref that names nothing is a mistake
        // worth being able to see in the row, not one to hide.
        const fromNodeIds = node.fromRefs
          ? node.fromRefs.map((ref) => resolveRef(refToId, ref))
          : null;

        const created = await tx.mapNode.create({
          data: {
            mapId,
            parentId,
            kind: node.kind,
            label: node.label,
            detail: node.detail,
            status: node.status,
            sourceUrl: node.sourceUrl,
            choices: node.choices ? JSON.stringify(node.choices) : null,
            diagram: node.diagram ? JSON.stringify(node.diagram) : null,
            imageUrl: node.imageUrl,
            imageAlt: node.imageAlt,
            testsNodeId,
            fromNodeIds: fromNodeIds ? JSON.stringify(fromNodeIds) : null,
            sourceRef: node.sourceRef,
            options: node.options,
            order: node.order,
            // Same two-source resolution as parentRef: a ref from this call, or
            // an id of a theme already on the board.
            themeId: node.themeRef
              ? resolveRef(themeRefToId, node.themeRef)
              : null,
            origin,
          },
        });
        if (node.ref) refToId.set(node.ref, created.id);
        events.push({
          kind: 'node.added',
          origin,
          payload: nodeAddedPayload(created, parentId, testsNodeId, fromNodeIds),
        });
      }

      for (const update of updates) {
        const resolved = resolveRef(refToId, update.id);
        // A model can name a node that has since been deleted; updateMany skips
        // a miss rather than failing the whole turn.
        const { count } = await tx.mapNode.updateMany({
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
        await tx.thinkingMap.update({ where: { id: mapId }, data: { phase } });
        events.push({ kind: 'phase.set', origin, payload: { phase } });
      }

      // The same client, so the events land or roll back with the rows they
      // describe. `recordEvents` leaves the emit to us for that reason.
      return recordEvents(mapId, events, { requestId, tx });
    },
    // A single add_nodes call can carry a whole board's worth of inserts, and
    // the boundary now spans all of them rather than one statement at a time.
    { timeout: APPLY_TOOL_CALLS_TIMEOUT_MS },
  );

  // Outside the transaction, deliberately: a waiter woken on a revision that
  // then rolled back would read a map that never existed.
  if (!result.deduped && result.events.length > 0) {
    mapEvents.emit(mapId, result);
  }
  return result;
}

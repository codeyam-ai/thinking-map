// Database access for thinking maps. Everything that reads or writes the map
// goes through here so the API routes and the MCP server share one
// implementation rather than drifting apart.

import { prisma } from './prisma';
import { KIND_EYEBROW } from './mapKinds';
import { hueForIndex } from './themeHue';
import { planMapMutations, type ToolInvocation } from './nodePlan';
import { recordEvents, type EventInput, type Origin } from './exchange';

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
      themes: { orderBy: { order: 'asc' } },
    },
  });
}

/** Start a new map from an unstructured idea. The seed idea becomes both the
 *  root node and the person's first message — the conversation and the map are
 *  two views of the same thing from the very first turn. */
export async function createMap(seedIdea: string) {
  const trimmed = seedIdea.trim();
  const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;

  // The seed idea is the person's, so the root node and the opening message are
  // user-origin. An agent reading the log must not mistake the human's starting
  // idea for something it wrote itself.
  const map = await prisma.thinkingMap.create({
    data: {
      title,
      seedIdea: trimmed,
      phase: 'deconstruct',
      messages: { create: [{ role: 'user', origin: 'user', content: trimmed }] },
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
  const { themes, inserts, updates, phase } = planMapMutations(calls);
  const refToId = new Map<string, string>();
  const themeRefToId = new Map<string, string>();
  const events: EventInput[] = [];

  // Themes are written before nodes because a node names its theme, and the
  // hue depends on how many themes the map already has — so this counts once,
  // up front, rather than re-reading per theme.
  if (themes.length > 0) {
    const existing = await prisma.theme.count({ where: { mapId } });
    for (const [i, theme] of themes.entries()) {
      const created = await prisma.theme.create({
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
  }

  for (const node of inserts) {
    // A parentRef is either a ref from earlier in this same plan or the real
    // id of a node already on the map.
    const parentId = node.parentRef
      ? (refToId.get(node.parentRef) ?? node.parentRef)
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
        choices: node.choices ? JSON.stringify(node.choices) : null,
        order: node.order,
        // Same two-source resolution as parentRef: a ref from this call, or an
        // id of a theme already on the board.
        themeId: node.themeRef
          ? (themeRefToId.get(node.themeRef) ?? node.themeRef)
          : null,
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
        themeId: created.themeId,
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

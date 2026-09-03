import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { textOf } from './toolInvocation';
import { setUpTestSchema } from './testDatabase';

// `toolRuntime` imports `server-only`, whose whole job is to throw when it is
// pulled into a client bundle. Under Vitest there is no bundle to be in, so the
// guard fires on the one module that most needs testing. Stubbing it HERE
// rather than aliasing it away in `vitest.config.ts` keeps the protection in
// place for every other file — this test is opting out of one guard, not
// removing it from the project.
vi.mock('server-only', () => ({}));

// The database-bound half of "insights the agent keeps supplying", against a
// real PostgreSQL schema of its own.
//
// A pure test cannot reach any of it. `fromRefs` becomes `fromNodeIds` only by
// being resolved against ids the database just minted inside the same
// transaction, and the standing ask reaches the agent only by being rendered
// out of a map that was actually read back. Both are the point of the feature,
// so they get a real database rather than a hand-waved exemption — the same
// call `exchange.integration.test.ts` makes for the same reason.

let teardown: (() => Promise<void>) | undefined;
let mapStore: typeof import('./mapStore');
let toolRuntime: typeof import('./toolRuntime');
let prisma: typeof import('./prisma').prisma;

const MAP = 'insight-map-under-test';

beforeAll(async () => {
  // Assigns DATABASE_URL and pushes the schema. Must complete before the
  // imports below: app/lib/prisma.ts reads DATABASE_URL at import time, so a
  // later assignment would be ignored.
  ({ teardown } = await setUpTestSchema('insight'));

  mapStore = await import('./mapStore');
  toolRuntime = await import('./toolRuntime');
  prisma = (await import('./prisma')).prisma;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await teardown?.();
});

async function freshMap(id = MAP) {
  await prisma.mapEvent.deleteMany({});
  await prisma.thinkingMap.deleteMany({});
  await prisma.thinkingMap.create({
    data: { id, title: 'Under test', seedIdea: 'under test', revision: 0 },
  });
  return id;
}

/** Two answered questions and an insight that cites them, all in ONE call —
 *  which is the ordinary shape, and the one that makes resolution necessary:
 *  the agent names nodes by ref because their real ids do not exist yet. */
const questionsAndInsight = (fromRefs: string[]) => [
  {
    name: 'add_nodes',
    input: {
      nodes: [
        { ref: 'q1', kind: 'open-question', label: 'Who is this for?', status: 'answered' },
        { ref: 'q2', kind: 'open-question', label: 'What do they do today?', status: 'answered' },
        { ref: 's1', kind: 'suggestion', label: 'Start from the doc they already keep', fromRefs },
      ],
    },
  },
];

describe('fromRefs resolution', () => {
  // The whole reason this is a ref and not an id: an insight almost always
  // cites questions created moments earlier in the very same call, so a ref
  // written through raw would be a citation pointing at nothing.
  it('turns refs from the same call into the ids the database just minted', async () => {
    const id = await freshMap();
    await mapStore.applyToolCalls(id, questionsAndInsight(['q1', 'q2']), {
      origin: 'agent',
    });

    const nodes = await prisma.mapNode.findMany({ where: { mapId: id } });
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const insight = byLabel.get('Start from the doc they already keep')!;

    expect(JSON.parse(insight.fromNodeIds!)).toEqual([
      byLabel.get('Who is this for?')!.id,
      byLabel.get('What do they do today?')!.id,
    ]);
  });

  // An insight drawn from the whole map genuinely has no single source, and a
  // node that named nothing must be indistinguishable from one written before
  // the field existed — not one carrying an empty array nobody can render.
  it('leaves the column null when the agent named no sources', async () => {
    const id = await freshMap();
    await mapStore.applyToolCalls(id, questionsAndInsight([]), { origin: 'agent' });

    const insight = await prisma.mapNode.findFirst({
      where: { mapId: id, kind: 'suggestion' },
    });
    expect(insight!.fromNodeIds).toBeNull();
  });

  // An id that resolves to nothing is written through rather than dropped, the
  // same call `resolveRef` already makes for parentRef: a citation naming
  // nothing is a mistake worth being able to see in the row, and the read side
  // drops it at render time so it never reaches the person.
  it('writes an unresolvable ref through, and the read side drops it', async () => {
    const id = await freshMap();
    await mapStore.applyToolCalls(id, questionsAndInsight(['q1', 'never-existed']), {
      origin: 'agent',
    });

    const insight = await prisma.mapNode.findFirst({
      where: { mapId: id, kind: 'suggestion' },
    });
    expect(JSON.parse(insight!.fromNodeIds!)).toContain('never-existed');

    const { insightStream } = await import('./insightStream');
    const map = await mapStore.getMap(id);
    const stream = insightStream(map!.nodes);
    expect(stream.insights[0].from.map((f) => f.label)).toEqual(['Who is this for?']);
  });

  // The log speaks the contract's language, not the column's. A reader of the
  // exchange log should learn what an insight came out of without having to
  // know that SQLite made it a string.
  it('carries the resolved ids on the node.added event as an array', async () => {
    const id = await freshMap();
    const result = await mapStore.applyToolCalls(id, questionsAndInsight(['q1']), {
      origin: 'agent',
    });

    const added = result.events.filter((e) => e.kind === 'node.added');
    const insightEvent = added.find(
      (e) => (e.payload as { kind: string }).kind === 'suggestion',
    )!;
    const payload = insightEvent.payload as { fromNodeIds?: string[] };
    expect(Array.isArray(payload.fromNodeIds)).toBe(true);
    expect(payload.fromNodeIds).toHaveLength(1);

    // And omitted entirely, not sent as null, on an ordinary node — so a reader
    // can treat presence as meaning and an existing event stays what it was.
    const questionEvent = added.find(
      (e) => (e.payload as { kind: string }).kind === 'open-question',
    )!;
    expect('fromNodeIds' in (questionEvent.payload as object)).toBe(false);
  });
});

describe('read_map carries the standing ask', () => {
  /** Through `runTool` rather than the implementation directly, so the schema
   *  parse the real front doors perform is part of what is under test. */
  const readMap = async (mapId: string, input: { sinceRevision?: number } = {}) => {
    const out = await toolRuntime.runTool('read_map', input, {
      mapId,
      origin: 'agent',
    });
    return {
      // `textOf` rather than reading `c.text` off each block: a tool response's
      // content became a text-or-image union when read_attachment landed, and
      // an image block has no `text`. This reads the words and ignores any
      // picture, which is what this test is asserting about.
      text: textOf(out),
      structured: out.structuredContent,
    };
  };

  // The full read. Without this the agent is told the map's contents and left
  // to invent its own sense of whether it owes anything.
  it('reports the budget on a full read', async () => {
    const id = await freshMap();
    await mapStore.applyToolCalls(id, questionsAndInsight(['q1', 'q2']), {
      origin: 'agent',
    });

    const out = await readMap(id);
    expect(out.text).toContain('## Insights');
    expect(out.text).toContain('live: 1');
    expect(out.text).toContain('target: 3');
    expect(out.structured!.insights).toMatchObject({ live: 1, stale: 0, target: 3 });
  });

  // The delta branch is the one a WORKING agent actually calls. An ask that
  // appeared only on the full read would be an ask the agent saw once, on its
  // first turn, and never again — which is the difference between a mechanism
  // that works and one that reads well in a diff.
  it('reports the same budget on a delta read', async () => {
    const id = await freshMap();
    await mapStore.applyToolCalls(id, questionsAndInsight(['q1', 'q2']), {
      origin: 'agent',
    });

    const out = await readMap(id, { sinceRevision: 0 });
    expect(out.text).toContain('## Insights');
    expect(out.text).toContain('live: 1');
    expect(out.structured!.delta).toBe(true);
    expect(out.structured!.insights).toMatchObject({ live: 1, target: 3 });
  });

  // Day one. A map that has done nothing wrong should read an invitation, not a
  // shortfall — and the empty case is the one every fresh map produces.
  it('reads as an invitation on a map with no insights yet', async () => {
    const id = await freshMap();
    const out = await readMap(id);
    expect(out.text).toContain('none yet');
    expect(out.structured!.insights).toMatchObject({ live: 0, answersSinceNewest: 0 });
  });
});

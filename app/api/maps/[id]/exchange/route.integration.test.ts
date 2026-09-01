import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The page's write path, at the point where it decides whether a question is
// about a real node.
//
// This is the check that makes a node-scoped question worth having: the id has
// to name a node on THIS map, or the whole premise — that the agent no longer
// has to guess which pill you meant — collapses into a question pointing at
// nothing. It is database-bound by nature, so it runs against a real temporary
// SQLite file like the exchange spine's own integration suite.

let dir: string;
let route: typeof import('./route');
let prisma: typeof import('@/app/lib/prisma').prisma;

const MAP = 'map-under-test';
const OTHER = 'someone-elses-map';

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'exchange-route-test-'));
  const url = `file:${path.join(dir, 'test.db')}`;
  // Set before the modules load: app/lib/prisma.ts reads DATABASE_URL at import
  // time, so a later assignment would be ignored.
  process.env.DATABASE_URL = url;

  execFileSync('npx', ['prisma', 'db', 'push', '--url', url], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  route = await import('./route');
  prisma = (await import('@/app/lib/prisma')).prisma;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Two maps, each with one node, so "belongs to this map" is falsifiable. */
async function freshMaps() {
  await prisma.mapEvent.deleteMany({});
  await prisma.mapNode.deleteMany({});
  await prisma.thinkingMap.deleteMany({});

  for (const [id, title] of [
    [MAP, 'Under test'],
    [OTHER, 'Somebody else'],
  ]) {
    await prisma.thinkingMap.create({
      data: { id, title, seedIdea: title, revision: 0 },
    });
  }
  await prisma.mapNode.create({
    data: {
      id: 'ours',
      mapId: MAP,
      kind: 'approach',
      label: 'Capture the thought, not the book',
      status: 'answered',
      order: 0,
      origin: 'agent',
    },
  });
  await prisma.mapNode.create({
    data: {
      id: 'theirs',
      mapId: OTHER,
      kind: 'approach',
      label: 'Not your node',
      status: 'answered',
      order: 0,
      origin: 'agent',
    },
  });
}

function post(mapId: string, body: unknown) {
  return route.POST(
    new Request(`http://test/api/maps/${mapId}/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: mapId }) },
  );
}

describe('POST /api/maps/:id/exchange — user.question', () => {
  // The ordinary case, and the reason the label is denormalised: the rail names
  // the node, and it should not have to re-query per row to do it.
  it('records the question with the node label resolved', async () => {
    await freshMaps();
    const res = await post(MAP, {
      kind: 'user.question',
      payload: { nodeId: 'ours', text: 'Does this replace the log?' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].kind).toBe('user.question');
    expect(body.events[0].payload).toMatchObject({
      nodeId: 'ours',
      label: 'Capture the thought, not the book',
      text: 'Does this replace the log?',
    });
  });

  // The check that matters. A node on somebody else's map must be refused, not
  // logged here — otherwise the ownership boundary the route already keeps for
  // the map itself has a hole in it at the payload.
  it('refuses a node that belongs to a different map', async () => {
    await freshMaps();
    const res = await post(MAP, {
      kind: 'user.question',
      payload: { nodeId: 'theirs', text: 'Whose node is this?' },
    });

    expect(res.status).toBe(400);
    expect(await prisma.mapEvent.count()).toBe(0);
  });

  // A question about a node that does not exist at all is the same refusal —
  // there is nothing for it to be about.
  it('refuses a nodeId that names nothing', async () => {
    await freshMaps();
    const res = await post(MAP, {
      kind: 'user.question',
      payload: { nodeId: 'no-such-node', text: 'Hello?' },
    });

    expect(res.status).toBe(400);
  });

  // Without an id this is a note wearing a question's name, and the agent is
  // back to guessing which pill was meant.
  it('refuses a question with no nodeId', async () => {
    await freshMaps();
    const res = await post(MAP, {
      kind: 'user.question',
      payload: { text: 'About one of them.' },
    });

    expect(res.status).toBe(400);
  });

  // Asking about a node must not change it. The person has not decided
  // anything yet, so marking, reopening or reordering the node would be the
  // route inventing an act they did not perform.
  it('leaves the node it asks about untouched', async () => {
    await freshMaps();
    const before = await prisma.mapNode.findUnique({ where: { id: 'ours' } });
    await post(MAP, {
      kind: 'user.question',
      payload: { nodeId: 'ours', text: 'Just asking.' },
    });
    const after = await prisma.mapNode.findUnique({ where: { id: 'ours' } });

    expect(after).toEqual(before);
  });

  // The kind has to be in the accepted set at all — this is what makes it wake
  // an agent parked on await_user_activity rather than sitting inert.
  it('accepts user.question as a user-writable kind', async () => {
    await freshMaps();
    const res = await post(MAP, {
      kind: 'user.question',
      payload: { nodeId: 'ours', text: 'Anything?' },
    });

    expect(res.status).not.toBe(400);
  });
});

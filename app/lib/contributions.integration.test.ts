import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// What a contribution from the page actually DOES to the map.
//
// These are database-bound by nature — a node the person added has to appear in
// the tree, and a question they answered has to stop being open — and the whole
// point of doing them server-side is that every front door sees the result,
// not just the browser that did it. A pure test could not tell that apart from
// browser state, so this runs against a real (temporary) SQLite file like the
// exchange spine's own integration suite.

let dir: string;
let contributions: typeof import('./contributions');
let prisma: typeof import('./prisma').prisma;

const MAP = 'map-under-test';

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'contributions-test-'));
  const url = `file:${path.join(dir, 'test.db')}`;
  // Set before the modules load: app/lib/prisma.ts reads DATABASE_URL at import
  // time, so a later assignment would be ignored.
  process.env.DATABASE_URL = url;

  execFileSync('npx', ['prisma', 'db', 'push', '--url', url], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  contributions = await import('./contributions');
  prisma = (await import('./prisma')).prisma;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** A map with a root idea and one open question hanging off it. */
async function freshMap() {
  await prisma.mapEvent.deleteMany({});
  await prisma.mapNode.deleteMany({});
  await prisma.thinkingMap.deleteMany({});
  await prisma.thinkingMap.create({
    data: { id: MAP, title: 'Under test', seedIdea: 'under test', revision: 0 },
  });
  await prisma.mapNode.create({
    data: {
      id: 'root',
      mapId: MAP,
      kind: 'idea',
      label: 'Under test',
      status: 'answered',
      order: 0,
      origin: 'user',
    },
  });
  await prisma.mapNode.create({
    data: {
      id: 'q1',
      mapId: MAP,
      parentId: 'root',
      kind: 'open-question',
      label: 'Who is it for?',
      status: 'open',
      order: 0,
      origin: 'agent',
    },
  });
  return MAP;
}

describe('contributionEvents — answering', () => {
  // The answer is the person's act; closing the question is its consequence.
  // Both must be logged, because an agent reading the log has to see that the
  // map changed, not just that something was said.
  it('closes the answered question and logs both halves', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.answer', {
      answers: [{ id: 'q1', text: 'Who is it for?', answer: 'Teachers.' }],
    });

    expect(events.map((e) => e.kind)).toEqual(['user.answer', 'node.updated']);
    const node = await prisma.mapNode.findUnique({ where: { id: 'q1' } });
    expect(node?.status).toBe('answered');
  });

  // Answering twice must not invent a second change. The second answer is
  // still worth logging — the person said something — but the node moved once.
  it('does not report a second close when the question is already answered', async () => {
    const id = await freshMap();
    const payload = {
      answers: [{ id: 'q1', text: 'Who is it for?', answer: 'Teachers.' }],
    };
    await contributions.contributionEvents(id, 'user.answer', payload);
    const again = await contributions.contributionEvents(id, 'user.answer', payload);

    expect(again.map((e) => e.kind)).toEqual(['user.answer']);
  });

  // A node the agent has since deleted must not fail the write. The answer
  // itself is the part worth keeping.
  it('keeps the answer when the question node is gone', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.answer', {
      answers: [{ id: 'vanished', text: 'gone', answer: 'still said it' }],
    });
    expect(events.map((e) => e.kind)).toEqual(['user.answer']);
  });

  // The payload arrives from a browser and is untrusted on this side of the
  // wire; a malformed one must degrade to "they said something", not throw.
  it('tolerates a malformed answers payload', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.answer', {
      answers: 'not an array',
    });
    expect(events.map((e) => e.kind)).toEqual(['user.answer']);
  });
});

describe('contributionEvents — adding a node', () => {
  // Without this the person's node would be logged as an intention and never
  // appear on the map — the bug this module exists to fix.
  it('creates the node and logs it with the real id', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.node', {
      kind: 'finding',
      label: 'Search has to be instant',
    });

    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as { id: string; label: string };
    const node = await prisma.mapNode.findUnique({ where: { id: payload.id } });
    expect(node).toMatchObject({
      label: 'Search has to be instant',
      kind: 'finding',
      origin: 'user',
    });
  });

  // `origin: user` is the same fact the pill reads to badge the node and the
  // tools read to avoid re-ingesting their own writes, so the badge and the
  // tool contract agree by construction.
  it('marks the node as the person’s', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.node', {
      label: 'Mine',
    });
    expect(events[0]!.origin).toBe('user');
  });

  // A second root would read as a second idea rather than a contribution to
  // this one, so an unparented node hangs off the root.
  it('attaches to the root when no parent is named', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.node', {
      label: 'Hangs off the root',
    });
    const payload = events[0]!.payload as { id: string; parentId: string | null };
    expect(payload.parentId).toBe('root');
  });

  // The root fallback must not override a caller that knows where the node
  // belongs — an answer elaborating on a question hangs under that question.
  it('honours an explicit parent', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.node', {
      label: 'Under the question',
      parentId: 'q1',
    });
    const payload = events[0]!.payload as { parentId: string | null };
    expect(payload.parentId).toBe('q1');
  });

  // The kind comes from a picker over NODE_KINDS, but the route is reachable
  // by anything; an unknown kind the map cannot draw must not reach the tree.
  it('falls back to a drawable kind when the requested one is not real', async () => {
    const id = await freshMap();
    const events = await contributions.contributionEvents(id, 'user.node', {
      kind: 'not-a-real-kind',
      label: 'Still drawable',
    });
    const payload = events[0]!.payload as { kind: string };
    expect(payload.kind).toBe('finding');
  });

  // An empty label would put an unreadable pill on the map, so nothing is
  // written and nothing is logged.
  it('writes nothing for an empty label', async () => {
    const id = await freshMap();
    const before = await prisma.mapNode.count({ where: { mapId: id } });
    const events = await contributions.contributionEvents(id, 'user.node', {
      label: '   ',
    });
    expect(events).toEqual([]);
    expect(await prisma.mapNode.count({ where: { mapId: id } })).toBe(before);
  });

  // Siblings are ordered, and a new one belongs after the ones already there.
  it('orders a new sibling after the existing ones', async () => {
    const id = await freshMap();
    await contributions.contributionEvents(id, 'user.node', { label: 'First' });
    await contributions.contributionEvents(id, 'user.node', { label: 'Second' });

    const siblings = await prisma.mapNode.findMany({
      where: { mapId: id, parentId: 'root' },
      orderBy: { order: 'asc' },
    });
    expect(siblings.map((n) => n.label)).toEqual([
      'Who is it for?',
      'First',
      'Second',
    ]);
  });
});

describe('contributionEvents — leaving a note', () => {
  // A note is something said ABOUT the map, not a change to it. Writing a node
  // here would put the person's aside into the tree.
  it('logs the note and changes nothing on the map', async () => {
    const id = await freshMap();
    const before = await prisma.mapNode.count({ where: { mapId: id } });
    const events = await contributions.contributionEvents(id, 'user.note', {
      text: 'The retrieval angle is the one I keep coming back to.',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'user.note', origin: 'user' });
    expect(await prisma.mapNode.count({ where: { mapId: id } })).toBe(before);
  });
});

// What the person brought along with the idea.
//
// Database-bound for the same reason the rest of this file is: the bug already
// found by hand was that the names were collected in the UI and never sent, and
// the mirror of it on this side is that they are sent and not durably stored.
// Only a real round trip can tell those apart from a page that merely looks
// right immediately after the click.
describe('attachments', () => {
  /** The route handler, imported lazily so it picks up the temporary database
   *  the same way the other modules here do. */
  async function putAttachments(mapId: string, attachments: unknown) {
    const { PUT } = await import('@/app/api/maps/[id]/attachments/route');
    return PUT(
      new Request('http://test/attachments', {
        method: 'PUT',
        body: JSON.stringify({ attachments }),
      }),
      { params: Promise.resolve({ id: mapId }) },
    );
  }

  const storedNames = async (id: string) => {
    const map = await prisma.thinkingMap.findUnique({ where: { id } });
    const raw = map?.attachments;
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  };

  // The round trip the hand-found bug was about: what the person browsed for
  // has to still be there when the board is re-read, not just while the tab
  // that added it is open.
  it('keeps what was attached across a re-read', async () => {
    const id = await freshMap();

    await putAttachments(id, [
      { name: 'shift-handover-notes.pdf' },
      { name: 'whiteboard-photo.jpg' },
    ]);

    expect(await storedNames(id)).toEqual([
      { name: 'shift-handover-notes.pdf' },
      { name: 'whiteboard-photo.jpg' },
    ]);
  });

  // A whole-list PUT REPLACES. If it appended, removing an attachment would be
  // impossible through the only endpoint there is, and every save would
  // duplicate the list the client sent.
  it('replaces the list rather than appending to it', async () => {
    const id = await freshMap();

    await putAttachments(id, [{ name: 'first.pdf' }, { name: 'second.pdf' }]);
    await putAttachments(id, [{ name: 'only.pdf' }]);

    expect(await storedNames(id)).toEqual([{ name: 'only.pdf' }]);
  });

  // Clearing has to leave NOTHING, not an empty JSON array. `[]` is truthy as a
  // stored string, so the board would go on rendering the "brought along" strip
  // with no items in it — a stray empty row where the attachments used to be.
  it('clears to nothing rather than to an empty list', async () => {
    const id = await freshMap();

    await putAttachments(id, [{ name: 'temporary.pdf' }]);
    await putAttachments(id, []);

    const map = await prisma.thinkingMap.findUnique({ where: { id } });
    expect(map?.attachments ?? null).toBeNull();
  });

  // Names are the only thing stored. The board is a place to point AT things,
  // not to hold them, and a column that quietly grew a second shape is one the
  // rest of the app does not know how to read.
  it('stores names and drops everything else sent with them', async () => {
    const id = await freshMap();

    await putAttachments(id, [
      { name: 'notes.pdf', size: 91_234, url: 'https://example.test/notes.pdf' },
    ]);

    expect(await storedNames(id)).toEqual([{ name: 'notes.pdf' }]);
  });

  // A blank name would render as an unlabelled row that cannot be identified or
  // removed, so it is dropped the way an unlabelled theme is.
  it('drops an entry with no usable name', async () => {
    const id = await freshMap();

    await putAttachments(id, [
      { name: '   ' },
      {},
      { name: 'real.pdf' },
    ]);

    expect(await storedNames(id)).toEqual([{ name: 'real.pdf' }]);
  });

  // Attaching to a map that does not exist is a 404 rather than a silent
  // success — `updateMany` matches zero rows without complaining, so without
  // the count check the client would be told its files were saved.
  it('reports a missing map instead of silently saving nothing', async () => {
    await freshMap();

    const res = await putAttachments('no-such-map', [{ name: 'a.pdf' }]);

    expect(res.status).toBe(404);
  });

  // Malformed input is refused rather than stored. Anything that reached the
  // column in a shape the reader cannot parse would make the board unable to
  // open its own attachment list.
  it('refuses a body that is not a list of attachments', async () => {
    const id = await freshMap();

    expect((await putAttachments(id, 'nope')).status).toBe(400);
    expect((await putAttachments(id, { name: 'a.pdf' })).status).toBe(400);
    expect(await storedNames(id)).toBeNull();
  });
});

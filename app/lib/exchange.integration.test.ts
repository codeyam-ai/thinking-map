import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The database-bound half of the exchange spine, against a real (temporary)
// SQLite file. These four functions cannot be covered by a pure test — minting
// a revision, deduplicating a retry, and waking a waiter are all things that
// only mean anything against a real transaction — and they are the heart of the
// feature, so they get a real database rather than a hand-waved exemption.
//
// One waiting bug has already been caught here in spirit: an earlier
// waitForUserActivity unref'd its deadline timer as well as its poll, which let
// Node exit with the promise unsettled — "wait, then time out cleanly" silently
// became "the agent's call never returns".

let dir: string;
let exchange: typeof import('./exchange');
let prisma: typeof import('./prisma').prisma;

const MAP = 'map-under-test';

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'exchange-test-'));
  const url = `file:${path.join(dir, 'test.db')}`;
  // Set before the modules load: app/lib/prisma.ts reads DATABASE_URL at import
  // time, so a later assignment would be ignored.
  process.env.DATABASE_URL = url;

  // `--url` rather than the env alone: this Prisma reads its datasource from
  // prisma.config.ts, so DATABASE_URL by itself would push to the dev database.
  execFileSync('npx', ['prisma', 'db', 'push', '--url', url], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  exchange = await import('./exchange');
  prisma = (await import('./prisma')).prisma;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

async function freshMap(id = MAP) {
  await prisma.mapEvent.deleteMany({});
  await prisma.thinkingMap.deleteMany({});
  await prisma.thinkingMap.create({
    data: { id, title: 'Under test', seedIdea: 'under test', revision: 0 },
  });
  return id;
}

describe('recordEvents', () => {
  // The revision must advance once per event and the returned events must carry
  // the revisions they were given, or an agent's cursor points at nothing.
  it('mints one revision per event and returns them in order', async () => {
    const id = await freshMap();
    const result = await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: { text: 'one' } },
      { kind: 'agent.note', origin: 'agent', payload: { text: 'two' } },
    ]);
    expect(result.revision).toBe(2);
    expect(result.events.map((e) => e.revision)).toEqual([1, 2]);
    expect(result.deduped).toBe(false);
  });

  // The bump and the insert share a transaction, so the map's own revision must
  // agree with the last event written.
  it('leaves the map at the revision of its last event', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'user.note', origin: 'user', payload: { text: 'hi' } },
    ]);
    const map = await prisma.thinkingMap.findUnique({ where: { id } });
    expect(map?.revision).toBe(1);
  });

  // The idempotency key is what makes an agent's retry safe. Without it a
  // timed-out call that is retried inserts the same nodes twice.
  it('treats a repeated requestId as a no-op and returns the original revision', async () => {
    const id = await freshMap();
    const first = await exchange.recordEvents(
      id,
      [{ kind: 'node.added', origin: 'agent', payload: { id: 'n-1' } }],
      { requestId: 'retry-me' },
    );
    const second = await exchange.recordEvents(
      id,
      [{ kind: 'node.added', origin: 'agent', payload: { id: 'n-1' } }],
      { requestId: 'retry-me' },
    );
    expect(second.deduped).toBe(true);
    expect(second.revision).toBe(first.revision);
    expect(await prisma.mapEvent.count({ where: { mapId: id } })).toBe(1);
  });

  // A retry must see everything the first attempt wrote, not just its first row.
  it('returns every event the original call wrote on a retry', async () => {
    const id = await freshMap();
    await exchange.recordEvents(
      id,
      [
        { kind: 'node.added', origin: 'agent', payload: { id: 'a' } },
        { kind: 'node.added', origin: 'agent', payload: { id: 'b' } },
      ],
      { requestId: 'batch' },
    );
    const retry = await exchange.recordEvents(
      id,
      [{ kind: 'node.added', origin: 'agent', payload: { id: 'a' } }],
      { requestId: 'batch' },
    );
    expect(retry.events).toHaveLength(2);
    expect(retry.revision).toBe(2);
  });

  // An empty batch is not an error — it is a caller whose plan produced no
  // changes, and it must not move the revision.
  it('records nothing and holds the revision for an empty batch', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: {} },
    ]);
    const result = await exchange.recordEvents(id, []);
    expect(result.revision).toBe(1);
    expect(result.events).toEqual([]);
  });

  // Writing to a map that does not exist must fail loudly rather than minting a
  // revision nobody can read.
  it('refuses to write against an unknown map', async () => {
    await freshMap();
    await expect(
      exchange.recordEvents('no-such-map', [
        { kind: 'agent.note', origin: 'agent', payload: {} },
      ]),
    ).rejects.toThrow(/no map/i);
  });
});

describe('readSince', () => {
  // No cursor means "give me everything", which is what a fresh agent needs.
  it('returns the whole log when given no cursor', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: { text: 'a' } },
      { kind: 'user.note', origin: 'user', payload: { text: 'b' } },
    ]);
    const { revision, events } = await exchange.readSince(id, null);
    expect(revision).toBe(2);
    expect(events).toHaveLength(2);
  });

  // A cursor means "only what I have not seen", which is what stops an agent
  // re-ingesting its own writes as new information.
  it('returns only what happened after the cursor', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: { text: 'a' } },
      { kind: 'agent.note', origin: 'agent', payload: { text: 'b' } },
      { kind: 'user.note', origin: 'user', payload: { text: 'c' } },
    ]);
    const { events } = await exchange.readSince(id, 2);
    expect(events.map((e) => e.revision)).toEqual([3]);
  });

  // A caught-up agent must still leave holding a usable cursor, or it has no
  // way to ask again.
  it('reports the current revision even when the delta is empty', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: {} },
    ]);
    const { revision, events } = await exchange.readSince(id, 1);
    expect(events).toEqual([]);
    expect(revision).toBe(1);
  });

  // The payload round-trips through a text column, so a reader must get the
  // object back rather than the string.
  it('decodes stored payloads back into objects', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'node.added', origin: 'user', payload: { id: 'n-9', label: 'mine' } },
    ]);
    const { events } = await exchange.readSince(id, null);
    expect(events[0].payload).toEqual({ id: 'n-9', label: 'mine' });
    expect(events[0].origin).toBe('user');
  });
});

describe('currentRevision', () => {
  // The cheap cursor read the waiting tools report from.
  it('reports the map’s revision without reading the log', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: {} },
      { kind: 'agent.note', origin: 'agent', payload: {} },
    ]);
    expect(await exchange.currentRevision(id)).toBe(2);
  });

  // A missing map must be an error rather than a zero, which a caller would
  // mistake for a real cursor at the start of the log.
  it('throws for a map that does not exist', async () => {
    await freshMap();
    await expect(exchange.currentRevision('nope')).rejects.toThrow(/no map/i);
  });
});

describe('waitForUserActivity', () => {
  // An event may already be waiting. A waiter that subscribed before checking
  // would sleep through it and time out with the answer already on disk.
  it('returns immediately when the person already acted', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'user.note', origin: 'user', payload: { text: 'already here' } },
    ]);
    const result = await exchange.waitForUserActivity(id, 0, 5_000);
    expect(result.timedOut).toBe(false);
    expect(result.events.map((e) => e.kind)).toEqual(['user.note']);
  });

  // The agent's own writes must not wake it — otherwise an agent that posts a
  // note wakes itself and never actually waits for the person.
  it('does not wake on the agent’s own writes', async () => {
    const id = await freshMap();
    const cursor = await exchange.currentRevision(id);
    setTimeout(() => {
      void exchange.recordEvents(id, [
        { kind: 'agent.note', origin: 'agent', payload: { text: 'mine' } },
      ]);
    }, 100);
    const result = await exchange.waitForUserActivity(id, cursor, 700, {
      pollIntervalMs: 50,
    });
    expect(result.timedOut).toBe(true);
  });

  // The wake path: a user write during the wait must be delivered.
  it('wakes and returns the user’s events when they act during the wait', async () => {
    const id = await freshMap();
    const cursor = await exchange.currentRevision(id);
    setTimeout(() => {
      void exchange.recordEvents(id, [
        { kind: 'user.answer', origin: 'user', payload: { answer: 'yes' } },
      ]);
    }, 100);
    const result = await exchange.waitForUserActivity(id, cursor, 5_000, {
      pollIntervalMs: 50,
    });
    expect(result.timedOut).toBe(false);
    expect(result.events.map((e) => e.kind)).toEqual(['user.answer']);
  });

  // The timeout must RESOLVE, not hang and not throw. This is the guarantee an
  // earlier unref'd-deadline bug broke: the promise simply never settled.
  it('times out cleanly with a resume cursor when nobody acts', async () => {
    const id = await freshMap();
    await exchange.recordEvents(id, [
      { kind: 'agent.note', origin: 'agent', payload: {} },
    ]);
    const started = Date.now();
    const result = await exchange.waitForUserActivity(id, 1, 400, {
      pollIntervalMs: 50,
    });
    expect(result.timedOut).toBe(true);
    expect(result.revision).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
  });
});

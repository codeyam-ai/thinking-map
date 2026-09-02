// The exchange spine.
//
// WebMCP is pull-only. A page cannot wake an agent, there is no push channel,
// and the person editing the map is under no obligation to wait for anyone. So
// the give-and-take between the two sides is built out of a durable, ordered,
// resumable record instead of a live connection: every change becomes an
// append-only event carrying the revision it created and the side that made it.
//
// This module is the ONLY place map revisions are minted. Everything else —
// the store, the tool catalog, the HTTP route — goes through `recordEvents`,
// so there is exactly one notion of "what happened after revision N?" no
// matter which front door asked.

import { EventEmitter } from 'events';
import { prisma } from './prisma';

/** Which side of the exchange produced a write. */
export type Origin = 'user' | 'agent';

/**
 * The kinds of thing that can happen to a map.
 *
 * Agent-side and user-side kinds live in one list on purpose: an agent reading
 * the log needs to see the person's contributions in the same ordered stream as
 * its own, and the activity feed renders both.
 */
export const EVENT_KINDS = [
  'theme.added',
  'node.added',
  'node.updated',
  'phase.set',
  'agent.note',
  'question.asked',
  'user.answer',
  'user.note',
  'user.node',
  'user.question',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

/** Kinds a page-side caller is allowed to write. The agent's own kinds are
 *  minted by the tools, never accepted from the browser.
 *
 * `user.question` is here rather than only in `EVENT_KINDS` on purpose: this is
 * the list `waitForUserActivity` filters on, so membership is what makes asking
 * about a node wake an agent parked on `await_user_activity`. Adding the kind
 * above and forgetting it here would leave the question in the log and the
 * agent asleep — the silent failure this pairing exists to prevent.
 *
 * Its payload is `{ nodeId, label, text }`. The label is denormalised at write
 * time so the rail can name the node without a second read; `nodeId` is what
 * makes the question about a specific pill rather than prose an agent has to
 * guess a target out of. */
export const USER_EVENT_KINDS = [
  'user.answer',
  'user.note',
  'user.node',
  'user.question',
] as const;

export function isUserEventKind(value: string): value is EventKind {
  return (USER_EVENT_KINDS as readonly string[]).includes(value);
}

/** An event as it is handed to `recordEvents`, before a revision exists. */
export interface EventInput {
  kind: EventKind;
  origin: Origin;
  /** Anything JSON-serialisable. Stored as a string — SQLite has no JSON type. */
  payload?: unknown;
}

/** An event as it is read back out. */
export interface ExchangeEvent {
  id: string;
  revision: number;
  kind: EventKind;
  origin: Origin;
  payload: unknown;
  createdAt: Date;
}

export interface RecordResult {
  revision: number;
  events: ExchangeEvent[];
  /** True when a matching `requestId` had already been recorded, so this call
   *  wrote nothing. The caller reports success either way — that is the whole
   *  point of an idempotency key. */
  deduped: boolean;
}

/**
 * In-process fan-out for waiters.
 *
 * This makes the same-process case instant, but it is deliberately NOT the
 * only mechanism: the stdio MCP server runs in a different process from Next,
 * so an emitter alone would be silently correct in dev and silently wrong the
 * moment a second front door wrote. `waitForUserActivity` therefore races this
 * against a database poll.
 */
export const mapEvents = new EventEmitter();
// Many concurrent waiters on one busy map is a normal state, not a leak.
mapEvents.setMaxListeners(0);

/**
 * The one channel on `mapEvents` that is not a map id.
 *
 * Every other emit is keyed by `mapId`, which cannot carry news of a map no
 * waiter knows the id of yet — and "someone just started a map" is exactly that
 * news. A reserved name sits alongside the ids rather than in a second emitter
 * so there is still one fan-out point to reason about. It is a constant because
 * a waiter subscribing to a typo'd string would simply never wake, which is
 * indistinguishable from nobody having submitted anything.
 */
export const MAP_CREATED = 'map.created';

/**
 * Turn a stored row into an event.
 *
 * Exported because the malformed-payload path is a real guarantee worth
 * pinning: a single unparseable row must not take down a whole `readSince`,
 * which is the only way an agent can catch up at all.
 */
export function decodeEvent(row: {
  id: string;
  revision: number;
  kind: string;
  origin: string;
  payload: string;
  createdAt: Date;
}): ExchangeEvent {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    // A payload that will not parse is not worth failing a read over — the
    // revision and kind are the load-bearing parts.
    payload = null;
  }
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind as EventKind,
    origin: row.origin as Origin,
    payload,
    createdAt: row.createdAt,
  };
}

/**
 * Append events to a map's log, bumping the map's revision once per event.
 *
 * The bump and the insert share a transaction because they are one fact: a
 * revision that exists without its event, or an event whose revision the map
 * has not reached, would both hand a reader a cursor it cannot resume from.
 *
 * `requestId` makes a retry a no-op. An agent that times out mid-call and
 * retries gets the original revision back rather than a duplicate node — the
 * failure mode `applyToolCalls` has today.
 */
export async function recordEvents(
  mapId: string,
  events: EventInput[],
  options: { requestId?: string | null } = {},
): Promise<RecordResult> {
  const requestId = options.requestId ?? null;

  const result = await prisma.$transaction(async (tx) => {
    if (requestId) {
      const prior = await tx.mapEvent.findFirst({
        where: { mapId, requestId },
        orderBy: { revision: 'asc' },
      });
      if (prior) {
        // Return every event that original call wrote, not just the first —
        // a retry should see exactly what the first attempt produced.
        const siblings = await tx.mapEvent.findMany({
          where: { mapId, requestId },
          orderBy: { revision: 'asc' },
        });
        return {
          revision: siblings[siblings.length - 1]!.revision,
          events: siblings.map(decodeEvent),
          deduped: true,
        };
      }
    }

    const map = await tx.thinkingMap.findUnique({
      where: { id: mapId },
      select: { revision: true },
    });
    if (!map) throw new Error(`No map with id ${mapId}.`);

    if (events.length === 0) {
      return { revision: map.revision, events: [], deduped: false };
    }

    const written: ExchangeEvent[] = [];
    let revision = map.revision;
    for (const event of events) {
      revision += 1;
      const row = await tx.mapEvent.create({
        data: {
          mapId,
          revision,
          kind: event.kind,
          origin: event.origin,
          payload: JSON.stringify(event.payload ?? {}),
          // EVERY row of the batch carries the key, not just the first. Keying
          // only the first row loses the batch's extent, so a retry would hand
          // back the FIRST revision as the resume cursor — and the agent would
          // then re-read the rest of its own batch as new information, which is
          // the exact re-ingestion this spine exists to prevent.
          requestId,
        },
      });
      written.push(decodeEvent(row));
    }

    await tx.thinkingMap.update({ where: { id: mapId }, data: { revision } });
    return { revision, events: written, deduped: false };
  });

  if (!result.deduped && result.events.length > 0) {
    mapEvents.emit(mapId, result);
  }
  return result;
}

export interface ReadSinceResult {
  revision: number;
  events: ExchangeEvent[];
}

/**
 * Everything that happened after `cursor`.
 *
 * An omitted cursor means "the whole log", which is what a fresh agent wants;
 * a cursor means "just the delta", which is what a returning one wants. Both
 * come back with the current revision so the caller always leaves with a
 * cursor it can resume from, even when the delta is empty.
 */
export async function readSince(
  mapId: string,
  cursor?: number | null,
): Promise<ReadSinceResult> {
  const map = await prisma.thinkingMap.findUnique({
    where: { id: mapId },
    select: { revision: true },
  });
  if (!map) throw new Error(`No map with id ${mapId}.`);

  const rows = await prisma.mapEvent.findMany({
    where: {
      mapId,
      ...(typeof cursor === 'number' ? { revision: { gt: cursor } } : {}),
    },
    orderBy: { revision: 'asc' },
  });

  return { revision: map.revision, events: rows.map(decodeEvent) };
}

export type WaitResult =
  | { timedOut: false; revision: number; events: ExchangeEvent[] }
  | { timedOut: true; revision: number; events: [] };

/** Default poll interval. Short enough to feel immediate to a person typing,
 *  long enough that an idle waiter costs almost nothing. */
const POLL_INTERVAL_MS = 500;

/**
 * Block until the person does something, or until the caller's patience runs out.
 *
 * The three-way race is the whole design:
 *   • the log is re-read FIRST, because an event may already be waiting and a
 *     waiter that subscribes before checking would sleep through it;
 *   • the in-process emitter makes a same-process write instant;
 *   • the poll is what makes a write from the *stdio* process still wake a
 *     waiter living in the web process.
 *
 * It always resolves. A timeout is a normal result carrying the cursor to
 * resume from, never a hang and never an error — an agent that gives up
 * mid-question loses nothing, because the question stays on screen and the
 * answer lands in the log for the next read.
 */
export async function waitForUserActivity(
  mapId: string,
  cursor: number | null | undefined,
  timeoutMs: number,
  options: { pollIntervalMs?: number } = {},
): Promise<WaitResult> {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;

  const check = async (): Promise<WaitResult | null> => {
    const { revision, events } = await readSince(mapId, cursor);
    const fromUser = events.filter((e) => e.origin === 'user');
    if (fromUser.length > 0) return { timedOut: false, revision, events: fromUser };
    return null;
  };

  const immediate = await check();
  if (immediate) return immediate;

  return new Promise<WaitResult>((resolve) => {
    let settled = false;

    const finish = async (result: WaitResult) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(deadline);
      mapEvents.off(mapId, onEvent);
      resolve(result);
    };

    const onEvent = () => {
      void check().then((hit) => {
        if (hit) void finish(hit);
      });
    };

    const poll = setInterval(() => {
      void check().then((hit) => {
        if (hit) void finish(hit);
      });
    }, pollIntervalMs);

    const deadline = setTimeout(() => {
      void readSince(mapId, cursor).then(({ revision }) =>
        finish({ timedOut: true, revision, events: [] }),
      );
    }, timeoutMs);

    // The repeating poll must not hold the process open — it never stops on its
    // own. The deadline deliberately DOES: it is bounded, and it is what
    // guarantees this call resolves. Unref'ing it too would let Node exit with
    // the promise unsettled, turning "wait, then time out cleanly" into "the
    // agent's call silently never returns".
    poll.unref?.();

    mapEvents.on(mapId, onEvent);
  });
}

/** A map that has just come into existence, as a waiter needs to see it. */
export interface NewMapSummary {
  id: string;
  title: string;
  seedIdea: string;
  /** Whether this map was started from a document rather than a sentence —
   *  it decides which tool the agent should reach for first. */
  hasBrief: boolean;
  createdAt: Date;
}

export type NewMapWaitResult =
  | { timedOut: false; cursor: string; maps: NewMapSummary[] }
  | { timedOut: true; cursor: string; maps: [] };

/**
 * Block until somebody starts a map, or until the caller's patience runs out.
 *
 * This is the server-door half of the answer to "a page cannot wake an agent".
 * It still cannot: nothing here pushes. What it does is let an agent that has
 * nothing else to do PARK, so that the moment a person submits an idea there is
 * already someone waiting to pick it up.
 *
 * Deliberately a near-copy of `waitForUserActivity` — same check-first, same
 * emitter-versus-poll race, same bounded deadline — so the two read as one
 * pattern rather than two ideas about waiting.
 *
 * The cursor is a TIMESTAMP, not a revision. `revision` is per-map, and a map
 * that does not exist yet has no revision a waiter could have read; `createdAt`
 * is the only ordering that spans maps.
 */
export async function waitForNewMap(
  since: Date,
  timeoutMs: number,
  options: { pollIntervalMs?: number } = {},
): Promise<NewMapWaitResult> {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sinceCursor = since.toISOString();

  const check = async (): Promise<NewMapWaitResult | null> => {
    const rows = await prisma.thinkingMap.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        seedIdea: true,
        createdAt: true,
        brief: { select: { mapId: true } },
      },
    });
    if (rows.length === 0) return null;

    const maps: NewMapSummary[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      seedIdea: row.seedIdea,
      hasBrief: row.brief !== null,
      createdAt: row.createdAt,
    }));
    return {
      timedOut: false,
      // The newest map handed over — so a re-park with this cursor resumes
      // exactly after the batch, never re-delivering and never skipping.
      cursor: maps[maps.length - 1]!.createdAt.toISOString(),
      maps,
    };
  };

  // Before subscribing, not after: a map created between the agent's last call
  // and this one is already waiting, and a waiter that subscribes first would
  // sleep through it.
  const immediate = await check();
  if (immediate) return immediate;

  return new Promise<NewMapWaitResult>((resolve) => {
    let settled = false;

    const finish = (result: NewMapWaitResult) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(deadline);
      mapEvents.off(MAP_CREATED, onEvent);
      resolve(result);
    };

    const onEvent = () => {
      void check().then((hit) => {
        if (hit) finish(hit);
      });
    };

    const poll = setInterval(() => {
      void check().then((hit) => {
        if (hit) finish(hit);
      });
    }, pollIntervalMs);

    const deadline = setTimeout(() => {
      // A timeout is a normal result, never an error: nobody having submitted
      // anything is the ordinary case for an agent looping on this. It hands
      // back the cursor it was given, so re-parking loses no ground.
      finish({ timedOut: true, cursor: sinceCursor, maps: [] });
    }, timeoutMs);

    // Same reasoning as `waitForUserActivity`, unchanged: the repeating poll
    // must not hold the process open, and the deadline deliberately must.
    poll.unref?.();

    mapEvents.on(MAP_CREATED, onEvent);
  });
}

/** The map's current revision, for a caller that only needs the cursor. */
export async function currentRevision(mapId: string): Promise<number> {
  const map = await prisma.thinkingMap.findUnique({
    where: { id: mapId },
    select: { revision: true },
  });
  if (!map) throw new Error(`No map with id ${mapId}.`);
  return map.revision;
}

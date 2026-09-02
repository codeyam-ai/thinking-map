'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { notifyExchangeUpdated } from '../lib/webmcp';
import type { ExchangeEvent } from '../lib/exchange';

/** How often the page re-reads the log. Fast enough that an agent's write
 *  feels immediate to someone watching, slow enough to be free. */
const POLL_INTERVAL_MS = 1500;

export interface ExchangeLog {
  /** The log as the page knows it, oldest first. */
  events: ExchangeEvent[];
  /** The map's revision as last observed. */
  revision: number | null;
  /** Fold in events from a write the page performed itself. */
  absorb(incoming: ExchangeEvent[]): void;
  /** Record a revision the page learned about out of band. */
  observeRevision(revision: number): void;
}

/**
 * The page's own copy of the exchange log, kept current.
 *
 * Everything an agent does lands server-side — through the tools route, or a
 * different front door entirely — so the page learns about it exactly the way
 * an agent would: by reading the log forward from the cursor it holds. Pull-only
 * is not a limitation being worked around here, it is the design being followed.
 *
 * It also re-renders the server component when the log moves past what was
 * rendered. The map itself is server-rendered, so without that a question
 * answered in the panel would stay dashed on the map — the artifact and its own
 * log out of step. That refresh terminates on its own: it re-runs the page,
 * `serverRevision` arrives at the revision just read, and the condition stops
 * holding.
 */
export function useExchangeLog(
  mapId: string,
  initialEvents: ExchangeEvent[],
  serverRevision: number | null,
): ExchangeLog {
  const [events, setEvents] = useState<ExchangeEvent[]>(initialEvents);
  const [revision, setRevision] = useState<number | null>(serverRevision);
  const router = useRouter();

  /** The log is append-only and revision-ordered, so a revision is the whole
   *  identity of an event and re-reading one costs nothing. */
  const absorb = useCallback((incoming: ExchangeEvent[]) => {
    if (incoming.length === 0) return;
    setEvents((prev) => {
      const seen = new Set(prev.map((e) => e.revision));
      const fresh = incoming.filter((e) => !seen.has(e.revision));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
  }, []);

  const observeRevision = useCallback((next: number) => setRevision(next), []);

  useEffect(() => {
    let live = true;
    // Seeded from the server render and advanced only by the poll's own
    // replies. A contribution that races ahead of it costs nothing, because
    // `absorb` keys on revision.
    let cursor = serverRevision;

    const tick = async () => {
      try {
        const query = cursor === null ? '' : `?since=${cursor}`;
        const res = await fetch(`/api/maps/${mapId}/exchange${query}`);
        if (!res.ok || !live) return;
        const body = (await res.json()) as {
          revision?: number;
          events?: ExchangeEvent[];
        };
        if (!live) return;
        if (typeof body.revision === 'number') {
          cursor = body.revision;
          setRevision(body.revision);
        }
        if (Array.isArray(body.events)) absorb(body.events);
      } catch {
        // A dropped poll is not worth surfacing: the next one re-reads from the
        // same cursor, so nothing is missed by losing one.
      }
    };

    const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [mapId, absorb, serverRevision]);

  // In an effect rather than inside `absorb`, because a notification is a side
  // effect and a state updater must stay pure — React may run one twice, which
  // would announce the same movement twice. Keyed on the revision, so it fires
  // once per position the log actually reaches.
  //
  // This hook already owns the cursor and sees every write, local or polled, so
  // it is the natural site for the announcement: no second piece of
  // subscription bookkeeping to keep in sync. It is a no-op on every browser
  // shipping today — see `notifyExchangeUpdated`.
  useEffect(() => {
    if (revision === null) return;
    notifyExchangeUpdated(mapId);
  }, [mapId, revision]);

  useEffect(() => {
    if (revision !== null && (serverRevision === null || revision > serverRevision)) {
      router.refresh();
    }
  }, [revision, serverRevision, router]);

  return { events, revision, absorb, observeRevision };
}

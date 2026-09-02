'use client';

// Mounts the page's front door.
//
// The bridge binds the tool catalog to the current map for as long as the map
// page is open, holds the questions an agent has asked but nobody has answered
// yet, and reports whether an agent is attached at all.
//
// It is composition, not machinery: the two clocks it coordinates live in their
// own hooks — `useExchangeLog` owns the durable record, `useAskUser` owns one
// agent's parked turn — and what remains here is binding them to the catalog.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  bindExchangeResource,
  bindTools,
  publishAgentDriver,
  webMcpUnavailableReason,
} from '@/app/lib/webmcp';
import { toolSummaries } from '@/app/lib/toolInvocation';
import { readJson } from '@/app/lib/readJson';
import { useAskUser, type PendingQuestion } from '@/app/hooks/useAskUser';
import { useExchangeLog } from '@/app/hooks/useExchangeLog';
import type { ToolClient } from '@/app/lib/toolCatalog';
import type { ExchangeEvent } from '@/app/lib/exchange';

export type { PendingQuestion };

/** unavailable — no agent can reach the page at all (no browser agent, not
 *  secure, or inside an iframe). connected — bound and idle. working — a tool
 *  is mid-flight. */
export type BridgeStatus = 'unavailable' | 'connected' | 'working';

export interface BridgeState {
  status: BridgeStatus;
  /** Why no agent is attached, when that is the case. */
  reason: string | null;
  /** Questions an agent is waiting on right now. Empty when nothing is pending. */
  pending: PendingQuestion[];
  /** The tools this page exposes. Read from the catalog rather than from the
   *  published driver: a consumer's effect runs before its parent's, so
   *  reading the driver would race the very binding that creates it. */
  tools: string[];
  /** The map's revision as last observed by the page. */
  revision: number | null;
  /** The log as the page knows it — what the activity rail renders. */
  events: ExchangeEvent[];
  /**
   * Answer questions.
   *
   * `questions` names what is being answered; omit it to answer whatever the
   * agent is currently pending on. The distinction matters because a person
   * should never have to know whether an agent is blocked on them: answering
   * an open question on the map is a valid contribution either way, and a
   * pending `ask_user` is released only if one happens to be waiting.
   */
  answer(
    answers: Record<string, string>,
    questions?: PendingQuestion[],
  ): Promise<void>;
  /** Record something the person did, so a waiting agent wakes up. */
  contribute(
    kind: 'user.answer' | 'user.note' | 'user.node' | 'user.question',
    payload: unknown,
  ): Promise<void>;
}

/** Exported so a capture fixture can supply a state the browser cannot produce
 *  on its own (see `app/isolated-components/BridgeFixture.tsx`). Application
 *  code reads the bridge through `useWebMcpBridge`, never through this. */
export const BridgeContext = createContext<BridgeState | null>(null);

export function useWebMcpBridge(): BridgeState {
  const ctx = useContext(BridgeContext);
  if (!ctx) {
    throw new Error('useWebMcpBridge must be used inside <WebMcpBridge>.');
  }
  return ctx;
}

/**
 * The bridge if there is one, `null` if there is not.
 *
 * For a component that renders in BOTH the app and an isolated scenario, where
 * the throwing version would make the second case a crash rather than a state.
 * The rule stays the same though: something that genuinely needs the exchange
 * must use `useWebMcpBridge` and say so by throwing. This is for the parts that
 * degrade honestly — a map you cannot ask about is still a map.
 */
export function useOptionalWebMcpBridge(): BridgeState | null {
  return useContext(BridgeContext);
}

export function WebMcpBridge({
  mapId,
  initialEvents = [],
  initialRevision = null,
  children,
}: {
  mapId: string;
  /** The log at server-render time, so the rail is populated on first paint. */
  initialEvents?: ExchangeEvent[];
  initialRevision?: number | null;
  children?: React.ReactNode;
}) {
  const [status, setStatus] = useState<BridgeStatus>('unavailable');
  const [reason, setReason] = useState<string | null>(null);

  const log = useExchangeLog(mapId, initialEvents, initialRevision);
  const { absorb, observeRevision } = log;

  // A settled ask means the agent's turn is running again, not that it left.
  const onSettled = useCallback(
    () => setStatus((s) => (s === 'working' ? 'connected' : s)),
    [],
  );
  const { pending, ask, settle } = useAskUser(onSettled);

  const contribute = useCallback(
    async (
      kind: 'user.answer' | 'user.note' | 'user.node' | 'user.question',
      payload: unknown,
    ) => {
      const res = await fetch(`/api/maps/${mapId}/exchange`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      // `res.ok` was already checked here; what this adds is surviving a 200
      // whose body is truncated, which would otherwise throw a raw parse error
      // into a callback with no boundary around it.
      const { data: body, error } = await readJson<{
        revision?: number;
        events?: ExchangeEvent[];
      }>(res, `Could not record ${kind}.`);
      if (!body) throw new Error(error ?? `Could not record ${kind}.`);
      if (typeof body.revision === 'number') observeRevision(body.revision);
      // The write's own events come straight back, so the rail shows the
      // contribution without waiting for the next poll.
      if (Array.isArray(body.events)) absorb(body.events);
    },
    [mapId, absorb, observeRevision],
  );

  const answer = useCallback(
    async (answers: Record<string, string>, questions?: PendingQuestion[]) => {
      const asked = questions ?? pending;
      const resolved = asked.map((q) => ({
        id: q.id,
        text: q.text,
        answer: answers[q.id] ?? '',
      }));
      // The answer is written to the log BEFORE the agent's turn is released,
      // so an agent that already gave up still finds it on its next read.
      await contribute('user.answer', { answers: resolved });
      // No-op when nothing is waiting, which is the ordinary case: the person
      // answered a question on the map rather than one an agent is blocked on.
      settle(resolved);
    },
    [pending, contribute, settle],
  );

  useEffect(() => {
    const client: ToolClient = {
      askUser: (questions, timeoutMs) => {
        setStatus('working');
        return ask(questions, timeoutMs);
      },
      requestUserInteraction: async <T,>(run: () => Promise<T>) => {
        const mc = (
          navigator as Navigator & {
            modelContext?: {
              requestUserInteraction?<R>(fn: () => Promise<R>): Promise<R>;
            };
          }
        ).modelContext;
        // Where the host supports it this brings the page forward, so the
        // person actually sees the question they are being asked.
        if (typeof mc?.requestUserInteraction === 'function') {
          return mc.requestUserInteraction(run);
        }
        return run();
      },
    };

    const ctx = { mapId, client };

    const unavailable = webMcpUnavailableReason();
    setReason(unavailable);
    setStatus(unavailable ? 'unavailable' : 'connected');

    const disposeTools = bindTools(ctx);
    // The headless driver is published whether or not a real agent is present:
    // in a preview or a captured scenario it is the ONLY way these tools can be
    // driven, because WebMCP is unreachable inside the capture iframe.
    const disposeDriver = publishAgentDriver(ctx);
    // Registers the log as something an agent can subscribe to, on the day a
    // browser can. Reads through the same HTTP route everything else does, so
    // there is one notion of what the log says.
    const disposeResource = bindExchangeResource({
      mapId,
      read: async () => {
        const res = await fetch(`/api/maps/${mapId}/exchange`);
        if (!res.ok) throw new Error(`Could not read the log (${res.status}).`);
        return res.json();
      },
    });

    return () => {
      settle(null);
      disposeTools();
      disposeDriver();
      disposeResource();
    };
  }, [mapId, ask, settle]);

  const tools = useMemo(() => toolSummaries().map((t) => t.name), []);

  const value = useMemo<BridgeState>(
    () => ({
      status,
      reason,
      pending,
      tools,
      revision: log.revision,
      events: log.events,
      answer,
      contribute,
    }),
    [status, reason, pending, tools, log.revision, log.events, answer, contribute],
  );

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}

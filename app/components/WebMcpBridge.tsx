'use client';

// Mounts the page's front door.
//
// The bridge binds the tool catalog to the current map for as long as the map
// page is open, holds the questions an agent has asked but nobody has answered
// yet, and reports whether an agent is attached at all. The follow-on UI plan
// renders that state; this component is what makes it exist.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  bindTools,
  publishAgentDriver,
  webMcpUnavailableReason,
} from '@/app/lib/webmcp';
import { toolSummaries } from '@/app/lib/toolInvocation';
import type { ToolClient } from '@/app/lib/toolCatalog';

/** unavailable — no agent can reach the page at all (no browser agent, not
 *  secure, or inside an iframe). connected — bound and idle. working — a tool
 *  is mid-flight. */
export type BridgeStatus = 'unavailable' | 'connected' | 'working';

export interface PendingQuestion {
  id: string;
  text: string;
}

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
  /** Answer the pending questions, releasing the agent's turn. */
  answer(answers: Record<string, string>): void;
  /** Record something the person did, so a waiting agent wakes up. */
  contribute(
    kind: 'user.answer' | 'user.note' | 'user.node',
    payload: unknown,
  ): Promise<void>;
}

const BridgeContext = createContext<BridgeState | null>(null);

export function useWebMcpBridge(): BridgeState {
  const ctx = useContext(BridgeContext);
  if (!ctx) {
    throw new Error('useWebMcpBridge must be used inside <WebMcpBridge>.');
  }
  return ctx;
}

export function WebMcpBridge({
  mapId,
  children,
}: {
  mapId: string;
  children?: React.ReactNode;
}) {
  const [status, setStatus] = useState<BridgeStatus>('unavailable');
  const [reason, setReason] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [revision, setRevision] = useState<number | null>(null);

  // The in-flight ask_user, if any. Held in a ref because the tool's promise
  // has to be resolved from an event handler that must not re-render to work.
  const waiting = useRef<{
    resolve: (
      answers: { id: string; text: string; answer: string }[] | null,
    ) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const settle = useCallback(
    (answers: { id: string; text: string; answer: string }[] | null) => {
      const current = waiting.current;
      if (!current) return;
      clearTimeout(current.timer);
      waiting.current = null;
      setPending([]);
      setStatus((s) => (s === 'working' ? 'connected' : s));
      current.resolve(answers);
    },
    [],
  );

  const contribute = useCallback(
    async (
      kind: 'user.answer' | 'user.note' | 'user.node',
      payload: unknown,
    ) => {
      const res = await fetch(`/api/maps/${mapId}/exchange`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      if (res.ok) {
        const body = (await res.json()) as { revision?: number };
        if (typeof body.revision === 'number') setRevision(body.revision);
      }
    },
    [mapId],
  );

  const answer = useCallback(
    (answers: Record<string, string>) => {
      const resolved = pending.map((q) => ({
        id: q.id,
        text: q.text,
        answer: answers[q.id] ?? '',
      }));
      // The answer is written to the log BEFORE the agent's turn is released,
      // so an agent that already gave up still finds it on its next read.
      void contribute('user.answer', { answers: resolved }).then(() =>
        settle(resolved),
      );
    },
    [pending, contribute, settle],
  );

  useEffect(() => {
    const client: ToolClient = {
      askUser: (questions, timeoutMs) =>
        new Promise((resolve) => {
          // A second ask while one is outstanding releases the first as
          // unanswered rather than stranding its promise forever.
          settle(null);
          setPending(questions);
          setStatus('working');
          const timer = setTimeout(() => settle(null), timeoutMs);
          timer.unref?.();
          waiting.current = { resolve, timer };
        }),
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

    return () => {
      settle(null);
      disposeTools();
      disposeDriver();
    };
  }, [mapId, settle]);

  const tools = useMemo(() => toolSummaries().map((t) => t.name), []);

  const value = useMemo<BridgeState>(
    () => ({ status, reason, pending, tools, revision, answer, contribute }),
    [status, reason, pending, tools, revision, answer, contribute],
  );

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}

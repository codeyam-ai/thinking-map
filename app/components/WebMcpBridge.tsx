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
  onModelContextReady,
  publishAgentDriver,
  requestUserInteraction,
  webMcpUnavailableReason,
  type BindReport,
  type Disposer,
} from '@/app/lib/webmcp';
import { toolSummaries } from '@/app/lib/toolInvocation';
import { agentPresence, type AgentChannel } from '@/app/lib/agentPresence';
import { readJson } from '@/app/lib/readJson';
import { useAskUser, type PendingQuestion } from '@/app/hooks/useAskUser';
import { useExchangeLog } from '@/app/hooks/useExchangeLog';
import type { ToolClient } from '@/app/lib/toolCatalog';
import type { ExchangeEvent } from '@/app/lib/exchange';
import type { AnswerSelection } from '@/app/lib/answerDraft';
import { withSelections } from '@/app/lib/mapAnswers';

export type { PendingQuestion };

/** unavailable — no agent can reach the page at all (no browser agent, not
 *  secure, or inside an iframe). connected — bound and idle. working — a tool
 *  is mid-flight. */
export type BridgeStatus = 'unavailable' | 'connected' | 'working';

export interface BridgeState {
  status: BridgeStatus;
  /** Which door the attached agent came through. `webmcp` is bound to this tab
   *  and can be asked a question; `mcp` is working the map over HTTP and can
   *  only read what the log tells it. Null when nobody is here. */
  channel: AgentChannel | null;
  /** When the log last saw the agent act, at any door. */
  lastAgentAt: Date | null;
  /** Why no agent is attached, when that is the case. */
  reason: string | null;
  /** The map this page is bound to has been deleted. Every registered tool now
   *  answers "No such map", so this outranks every other presence signal. */
  mapMissing: boolean;
  /** Questions an agent is waiting on right now. Empty when nothing is pending. */
  pending: PendingQuestion[];
  /** The tools this page exposes. Read from the catalog rather than from the
   *  published driver: a consumer's effect runs before its parent's, so
   *  reading the driver would race the very binding that creates it. */
  tools: string[];
  /** The tools the BROWSER accepted — what an agent can actually discover.
   *  Distinct from `tools` on purpose: the catalog is what the page offers,
   *  this is what got through, and the gap between them was invisible until
   *  it was given a name. Empty whenever no agent is attached. */
  registered: string[];
  /** Tools the browser refused, with the reason it gave. */
  bindFailures: { name: string; reason: string }[];
  /** Which registration convention the browser offered, if any. */
  convention: 'registerTool' | 'provideContext' | null;
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
   *
   * `parts` is the same answer taken apart, keyed by question id — which
   * options were chosen and what was typed. Optional, and additive: the log
   * keeps `answer` as the string every reader already reads, and gains the
   * structure only for a card that had any to give.
   */
  answer(
    answers: Record<string, string>,
    questions?: PendingQuestion[],
    parts?: Record<string, AnswerSelection>,
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
  const [report, setReport] = useState<BindReport | null>(null);

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
    async (
      answers: Record<string, string>,
      questions?: PendingQuestion[],
      parts?: Record<string, AnswerSelection>,
    ) => {
      const asked = questions ?? pending;
      const resolved = asked.map((q) => ({
        id: q.id,
        text: q.text,
        answer: answers[q.id] ?? '',
      }));
      // The structure travels ALONGSIDE the answer, never instead of it.
      //
      // Every reader downstream — the node's `detail` column, the chat bubbles,
      // the rail, the agent's own `read_map` — takes `answer` as a string, and
      // none of them changed for an answer to become a set. What the two extra
      // fields buy is the one thing the string cannot always give back: whether
      // a comma was a separator or something a person wrote.
      const logged = withSelections(resolved, parts);
      // The answer is written to the log BEFORE the agent's turn is released,
      // so an agent that already gave up still finds it on its next read.
      await contribute('user.answer', { answers: logged });
      // `resolved`, not `logged`: an `ask_user` call resolves with the answer as
      // a STRING, and handing the agent two extra fields it was never promised
      // would change the tool's result shape for a page-side detail it has no
      // use for.
      //
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
      // Brings the page forward where the host supports it, so the person
      // actually sees the question. Delegated rather than reached for directly:
      // `webmcp.ts` is meant to be the only file that knows where the browser
      // keeps its model context, and this was the one place that knew too.
      requestUserInteraction: requestUserInteraction,
    };

    const ctx = { mapId, client };

    // What the page knows before a browser agent has had a chance to appear.
    // Not a verdict: `onModelContextReady` below revises it the moment one does.
    setReason(webMcpUnavailableReason());
    setStatus('unavailable');
    setReport(null);

    // Binding is deferred to whenever the API exists rather than done once at
    // mount. The agent injects `navigator.modelContext`, and in an integrated
    // browser that regularly lands after hydration — a page that checked once
    // would report "no browser agent" for the rest of the session.
    let disposeTools: Disposer = () => {};
    const stopWatching = onModelContextReady(() => {
      const gate = webMcpUnavailableReason();
      setReason(gate);
      // A top-level secure page with an agent: bind, then say what the browser
      // actually took — a registration that failed must not read as connected.
      if (!gate) {
        disposeTools = bindTools({
          ...ctx,
          onReport: (r) => {
            setReport(r);
            setStatus(r.registered.length > 0 ? 'connected' : 'unavailable');
            if (r.registered.length === 0) {
              setReason(
                r.failed[0]
                  ? `registration failed: ${r.failed[0].reason}`
                  : 'the browser accepted no tools',
              );
            }
          },
        });
      }
    });

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

    // Every map change runs this: the watcher stops, the previous map's tools
    // are unregistered, and the next binding starts clean. Re-registering a
    // live name throws InvalidStateError, so leaving one behind would strand
    // the board the person navigated TO with no tools at all.
    return () => {
      settle(null);
      stopWatching();
      disposeTools();
      disposeDriver();
      disposeResource();
    };
  }, [mapId, ask, settle]);

  const tools = useMemo(() => toolSummaries().map((t) => t.name), []);

  // Presence lapses on a clock, and an agent that has stopped writing produces
  // no re-render to notice that with. The tick is what lets the page go quiet
  // on its own instead of claiming an agent is here until something else
  // happens to re-render it.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  // The map has three doors, so presence is read off the evidence every door
  // leaves in the log — not off this tab's binding alone, which is what made an
  // agent working through /api/mcp invisible to the whole page.
  const presence = useMemo(
    () =>
      agentPresence({
        webMcpBound: (report?.registered.length ?? 0) > 0,
        events: log.events,
      }),
    // `tick` is a dependency on purpose: it is the clock the window is measured
    // against, and without it presence would never expire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, log.events, tick],
  );

  // A map that no longer exists outranks every other signal. The tools are
  // still registered and the browser is still bound, so every honest-looking
  // indicator says "attached" — while each of those tools answers "No such
  // map". A stale tab reporting nine working tools is how an agent came to
  // report the app as broken to the person using it.
  const effectiveStatus: BridgeStatus = log.missing
    ? 'unavailable'
    : status === 'working'
      ? 'working'
      : // `working` is this tab's own ask_user in flight, so it outranks the
        // rest. Otherwise an agent at any door reads as connected.
        presence.attached
        ? 'connected'
        : status;

  const effectiveReason = log.missing
    ? 'this map no longer exists — reload to start a new one'
    : reason;

  const value = useMemo<BridgeState>(
    () => ({
      status: effectiveStatus,
      channel: log.missing ? null : presence.channel,
      lastAgentAt: presence.lastAgentAt,
      reason: effectiveReason,
      mapMissing: log.missing,
      pending,
      tools,
      registered: report?.registered ?? [],
      bindFailures: report?.failed ?? [],
      convention: report?.convention ?? null,
      revision: log.revision,
      events: log.events,
      answer,
      contribute,
    }),
    [
      effectiveStatus,
      presence,
      effectiveReason,
      log.missing,
      pending,
      tools,
      report,
      log.revision,
      log.events,
      answer,
      contribute,
    ],
  );

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}

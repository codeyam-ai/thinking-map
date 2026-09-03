// The WebMCP binding — the page's own front door.
//
// This is the ONLY file that names `navigator.modelContext`. The spec is a W3C
// Community Group draft and has already moved once: `provideContext()` was
// removed in the March 2026 revision in favour of `registerTool()` /
// `unregisterTool()`, while the `@mcp-b/global` polyfill still exposes the
// older convention. Isolating the binding here means the next revision is one
// edit rather than a sweep across every call site.
//
// It imports the catalog for the tools' names, descriptions and schemas, and
// nothing else: the implementations reach SQLite, so execution is forwarded to
// `/api/maps/:id/tools`. The agent sees one coherent set of tools; where the
// work happens is not its problem.

import {
  timeoutMsFrom,
  type McpToolResponse,
  type ToolClient,
} from './toolCatalog';
import {
  answeredResponse,
  buildToolDescriptors,
  errorResponse,
  pendingQuestions,
  serializationProblem,
  toolSummaries,
  validateToolInput,
  type JsonSchema,
} from './toolInvocation';

interface RegisterToolDescriptor {
  name: string;
  description: string;
  /** JSON Schema, not a Zod schema. The descriptor crosses an agent boundary,
   *  so anything here that a structured clone cannot copy fails the whole
   *  registration — see `jsonSchemaFor` in toolInvocation.ts. */
  inputSchema: JsonSchema;
  annotations?: Record<string, unknown>;
  execute(args: unknown): Promise<McpToolResponse>;
}

interface RegisterResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  read(): Promise<{ contents: { uri: string; text: string }[] }>;
}

interface ModelContextLike {
  /** Async in the shipped API — it returns a promise, so a failure ARRIVES as a
   *  rejection rather than a throw. Registering without handling that is how a
   *  refusal becomes an unhandled rejection nobody sees. The options argument
   *  carries the AbortSignal that unregisters the tool. */
  registerTool?(
    descriptor: RegisterToolDescriptor,
    options?: { signal?: AbortSignal },
  ): unknown;
  /** The explicit form, kept for hosts that expose it. Chrome documents the
   *  AbortController instead, so both paths run on disposal. */
  unregisterTool?(name: string): unknown;
  /** Brings the page forward so a person actually sees what they are asked. */
  requestUserInteraction?<R>(run: () => Promise<R>): Promise<R>;
  /** The pre-March-2026 convention the polyfill still ships. */
  provideContext?(context: { tools: RegisterToolDescriptor[] }): unknown;
  /** Resources and their change notification are an OPEN PROPOSAL
   *  (webmachinelearning/webmcp issue 151), not shipped in any browser today.
   *  Both are optional for that reason: the page registers the log and tries to
   *  announce its movement, and every one of those calls is a no-op until a
   *  browser grows the method. Nothing here is load-bearing — the log is still
   *  readable through the tools, and the page still polls. */
  registerResource?(descriptor: RegisterResourceDescriptor): unknown;
  unregisterResource?(uri: string): unknown;
  notifyResourceUpdated?(uri: string): unknown;
}

/** The log's resource URI. One per map, so a subscriber is subscribed to a
 *  specific map rather than to "the exchange" in the abstract. */
function exchangeUri(mapId: string): string {
  return `webmcp://thinking-map/${mapId}/exchange`;
}

/**
 * The browser's model context, wherever this browser keeps it.
 *
 * `document.modelContext` is the real one. Chrome's imperative-API guide and
 * ChatGPT's own WebMCP docs both register there, and the page checking only
 * `navigator` is exactly why a browser WITH WebMCP reported "no browser agent"
 * — the object was one property away the whole time.
 *
 * `navigator` is kept as a fallback rather than replaced: earlier drafts and
 * the `@mcp-b/global` polyfill put it there, and a page that reads both attaches
 * to either without caring which revision the host implements.
 */
function modelContext(): ModelContextLike | null {
  if (typeof document !== 'undefined') {
    const onDocument = (
      document as Document & { modelContext?: ModelContextLike }
    ).modelContext;
    if (onDocument) return onDocument;
  }
  if (typeof navigator !== 'undefined') {
    const onNavigator = (
      navigator as Navigator & { modelContext?: ModelContextLike }
    ).modelContext;
    if (onNavigator) return onNavigator;
  }
  return null;
}

/**
 * Ask the host to bring the page forward, where it supports that.
 *
 * Lives here because this file is meant to be the only one that names
 * `modelContext` — the bridge used to reach for `navigator.modelContext`
 * itself, which quietly made it a second place the surface had to be corrected.
 */
export async function requestUserInteraction<T>(
  run: () => Promise<T>,
): Promise<T> {
  const mc = modelContext();
  if (typeof mc?.requestUserInteraction === 'function') {
    return mc.requestUserInteraction(run) as Promise<T>;
  }
  return run();
}

/**
 * Whether a browser agent can actually reach this page.
 *
 * All three conditions are real gates, not defensive noise. WebMCP is
 * top-level-secure-context only, and codeyam renders the app inside a capture
 * iframe — so `window.top === window` is false in every preview and every
 * scenario, by design. That is precisely why the headless driver below exists.
 */
export function isWebMcpAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (window.top !== window) return false;
  return modelContext() !== null;
}

/**
 * Call back as soon as a browser agent is reachable, now or later.
 *
 * The API is injected by the agent, not by the page, and nothing guarantees it
 * lands before React hydrates — in the ChatGPT and Chrome integrated browsers
 * it frequently does not. A one-shot check at mount therefore reports "no
 * browser agent" on a page that acquires one a few hundred milliseconds later
 * and never looks again, which is a race the page loses silently.
 *
 * So: fire immediately when it is already there, otherwise watch. The watch is
 * bounded — an agent that has not appeared within `WATCH_MS` is not coming, and
 * a page left open for hours must not keep an interval alive for one.
 */
const POLL_MS = 250;
const WATCH_MS = 30_000;

export function onModelContextReady(ready: () => void): Disposer {
  if (typeof window === 'undefined') return () => {};
  if (modelContext() !== null) {
    ready();
    return () => {};
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    clearTimeout(deadline);
    // Some hosts announce themselves rather than make the page poll. Listening
    // costs nothing and removes the up-to-250ms lag when they do.
    window.removeEventListener('modelcontextready', onEvent);
    window.removeEventListener('mcp-ready', onEvent);
  };
  const settle = () => {
    if (stopped || modelContext() === null) return;
    stop();
    ready();
  };
  const onEvent = () => settle();

  const timer = setInterval(settle, POLL_MS);
  const deadline = setTimeout(stop, WATCH_MS);
  window.addEventListener('modelcontextready', onEvent);
  window.addEventListener('mcp-ready', onEvent);

  return stop;
}

/** Why the page is not bound, in a form the UI can render honestly. */
export function webMcpUnavailableReason(): string | null {
  if (typeof window === 'undefined') return 'not running in a browser';
  if (!window.isSecureContext) return 'needs HTTPS or localhost';
  if (window.top !== window) return 'running inside an iframe';
  if (modelContext() === null) return 'no browser agent (needs Chrome 146+)';
  return null;
}

/** Where the page forwards a tool call so the shared runtime can execute it. */
async function forward(
  mapId: string,
  name: string,
  input: unknown,
): Promise<McpToolResponse> {
  const res = await fetch(`/api/maps/${mapId}/tools`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, input }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return errorResponse(
      `Could not run ${name} (HTTP ${res.status}). ${detail}`.trim(),
    );
  }
  return (await res.json()) as McpToolResponse;
}

async function postUserEvent(
  mapId: string,
  kind: 'user.answer' | 'user.note' | 'user.node' | 'user.question',
  payload: unknown,
): Promise<void> {
  await fetch(`/api/maps/${mapId}/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, payload }),
  });
}

/**
 * Run one tool on behalf of an agent attached to this page.
 *
 * Input is validated here as well as on the server. That is not redundant: it
 * turns a malformed call into an immediate, readable answer instead of a round
 * trip, and the agent's input is untrusted on both sides of the wire.
 *
 * `ask_user` is the one tool the page does more than forward. The server writes
 * the questions onto the map and hands back a pending result; only the page can
 * perform the middle step of actually asking a person. So the page waits, and
 * on an answer records it and reports success — while an unanswered wait falls
 * through to exactly the pending result the server already produced, which is
 * why giving up costs nothing.
 */
export async function callCatalogTool(
  name: string,
  rawInput: unknown,
  ctx: { mapId: string; client?: ToolClient },
): Promise<McpToolResponse> {
  const checked = validateToolInput(name, rawInput);
  if (!checked.ok) return checked.response;
  const { input } = checked;

  const pending = await forward(ctx.mapId, name, input);
  if (name !== 'ask_user' || !ctx.client) return pending;

  const questions = pendingQuestions(pending);
  if (questions.length === 0) return pending;

  const timeoutMs = timeoutMsFrom(input.timeoutSeconds as number | undefined);
  const ask = () => ctx.client!.askUser(questions, timeoutMs);
  const answers = ctx.client.requestUserInteraction
    ? await ctx.client.requestUserInteraction(ask)
    : await ask();

  // Unanswered: hand back the server's pending result unchanged. The questions
  // stay on the map, and the answer will be in the log for the next read.
  if (!answers) return pending;

  await postUserEvent(ctx.mapId, 'user.answer', { answers });
  return answeredResponse(answers);
}

/** Cancels a binding. Calling it twice is safe. */
export type Disposer = () => void;

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** What a binding actually achieved, as opposed to what it attempted. */
export interface BindReport {
  /** The convention the browser offered, or null when it offered none. */
  convention: 'registerTool' | 'provideContext' | null;
  /** Tools the browser accepted. This is the set an agent can discover. */
  registered: string[];
  /** Tools that did not make it, and why — the thing a silent catch hides. */
  failed: { name: string; reason: string }[];
}

/**
 * Register the catalog with the browser agent for one map.
 *
 * Re-registering a live name throws `InvalidStateError`, so unregister-then-
 * register is the only safe update path — which is what the returned disposer
 * is for, and why the caller must dispose before binding a different map.
 *
 * A per-tool failure is still survivable rather than fatal, but it is no longer
 * SILENT: every one is reported through `ctx.onReport`. A binding that registers
 * nothing at all used to be indistinguishable from a binding that worked, which
 * is exactly how a page came to say "agent attached" while offering no tools.
 */
export function bindTools(ctx: {
  mapId: string;
  client?: ToolClient;
  onReport?: (report: BindReport) => void;
}): Disposer {
  const report = (r: BindReport) => ctx.onReport?.(r);

  const mc = modelContext();
  if (!mc) {
    report({ convention: null, registered: [], failed: [] });
    return () => {};
  }

  const descriptors: RegisterToolDescriptor[] = buildToolDescriptors(
    (name) => (args) => callCatalogTool(name, args, ctx),
  );

  if (typeof mc.registerTool === 'function') {
    // Chrome unregisters by AbortSignal rather than by name, so the binding
    // carries its own controller and disposal aborts it.
    const controller = new AbortController();

    // Every call is made in THIS tick — the awaiting happens afterwards — so a
    // browser that registers synchronously behaves exactly as before, and one
    // that returns promises is still handled.
    const outcomes = descriptors.map((d) => {
      // Checked before the call rather than after the failure: the browser's
      // own DataCloneError names nothing, while this names the tool.
      const problem = serializationProblem(d);
      if (problem) return Promise.resolve({ name: d.name, reason: problem });
      try {
        return Promise.resolve(
          mc.registerTool!(d, { signal: controller.signal }),
        ).then(
          () => ({ name: d.name, reason: null as string | null }),
          // A rejection, not a throw. Handling it here is also what keeps a
          // refused registration from surfacing as an unhandled rejection.
          (error: unknown) => ({ name: d.name, reason: messageFor(error) }),
        );
      } catch (error) {
        // A host that still throws synchronously — typically a name left
        // registered by a binding that failed to dispose. Losing one tool is
        // better than losing the whole binding.
        return Promise.resolve({ name: d.name, reason: messageFor(error) });
      }
    });

    void Promise.all(outcomes).then((results) => {
      // Aborted before the promises settled: the page moved on, and reporting
      // a binding it no longer has would race the next map's report.
      if (controller.signal.aborted) return;
      report({
        convention: 'registerTool',
        registered: results.filter((r) => !r.reason).map((r) => r.name),
        failed: results
          .filter((r) => r.reason)
          .map((r) => ({ name: r.name, reason: r.reason! })),
      });
    });

    return () => {
      // Both paths, deliberately: the signal is what Chrome documents, and
      // `unregisterTool` is what earlier drafts and the polyfill expose. A tool
      // left registered makes the NEXT map's binding fail on a live name.
      controller.abort();
      for (const d of descriptors) {
        try {
          mc.unregisterTool?.(d.name);
        } catch {
          // Already gone — disposal is idempotent by contract.
        }
      }
    };
  }

  // The older polyfill convention: one call replaces the whole set, so the
  // disposer clears it by providing an empty set rather than unregistering.
  if (typeof mc.provideContext === 'function') {
    // One call carries the whole set, so one bad descriptor would take every
    // tool down with it. Dropping it is the only way the rest survive.
    const usable = descriptors.filter((d) => serializationProblem(d) === null);
    const failed = descriptors
      .filter((d) => !usable.includes(d))
      .map((d) => ({ name: d.name, reason: serializationProblem(d) ?? '' }));
    try {
      mc.provideContext({ tools: usable });
      report({
        convention: 'provideContext',
        registered: usable.map((d) => d.name),
        failed,
      });
    } catch (error) {
      report({
        convention: 'provideContext',
        registered: [],
        failed: descriptors.map((d) => ({
          name: d.name,
          reason: error instanceof Error ? error.message : String(error),
        })),
      });
    }
    return () => {
      try {
        mc.provideContext?.({ tools: [] });
      } catch {
        // Nothing to undo.
      }
    };
  }

  // An object called `modelContext` that offers neither convention. Worth
  // reporting rather than treating as absence: the page IS talking to a host,
  // it just cannot register with it, and those need different fixes.
  report({
    convention: null,
    registered: [],
    failed: descriptors.map((d) => ({
      name: d.name,
      reason: 'browser exposes navigator.modelContext with no registerTool or provideContext',
    })),
  });
  return () => {};
}

/**
 * Offer the exchange log as a subscribable resource.
 *
 * Deliberately speculative: resource subscriptions are an open proposal, and no
 * browser implements `registerResource` today, so this returns a no-op disposer
 * on every browser that currently exists. It is written now because the whole
 * point of the proposal's framing — "the page owns reactive state but has no way
 * to publish it" — is exactly this page's problem, and keeping the binding here
 * means the day it ships costs nothing.
 *
 * Same feature-detection shape as `bindTools`: ask whether the method exists,
 * use it if it does, degrade silently if it does not.
 */
export function bindExchangeResource(ctx: {
  mapId: string;
  read: () => Promise<unknown>;
}): Disposer {
  const mc = modelContext();
  if (!mc || typeof mc.registerResource !== 'function') return () => {};

  const uri = exchangeUri(ctx.mapId);
  try {
    mc.registerResource({
      uri,
      name: 'Exchange log',
      description:
        'The append-only record of everything that has happened to this map, ' +
        'from both sides, in revision order.',
      mimeType: 'application/json',
      read: async () => ({
        contents: [{ uri, text: JSON.stringify(await ctx.read()) }],
      }),
    });
  } catch {
    // A registration that fails leaves the page exactly as capable as it was.
    return () => {};
  }

  return () => {
    try {
      mc.unregisterResource?.(uri);
    } catch {
      // Already gone — disposal is idempotent by contract.
    }
  };
}

/**
 * Tell a subscribed agent the log moved.
 *
 * Read from `navigator.modelContext` at CALL time rather than captured once at
 * module load, so a browser that gains the capability mid-session is picked up
 * without a reload — the difference between a capability check and a startup
 * snapshot.
 *
 * A notification is NOT a turn. Even once this ships it tells a *subscribed*
 * client that a resource changed; it cannot make an idle agent start reasoning.
 * The honest ceiling is unchanged: you can wake an agent that is waiting on you,
 * and you cannot start a turn in one that is not attached.
 */
export function notifyExchangeUpdated(mapId: string): void {
  const mc = modelContext();
  if (!mc || typeof mc.notifyResourceUpdated !== 'function') return;
  try {
    mc.notifyResourceUpdated(exchangeUri(mapId));
  } catch {
    // Purely an optimisation that removes polling latency. Nothing depends on
    // it, so a throw here must not reach the caller's write path.
  }
}

/** The headless driver's shape, published on `window` for tests and previews. */
export interface AgentDriver {
  mapId: string;
  listTools(): { name: string; title: string; description: string }[];
  callTool(name: string, input?: unknown): Promise<McpToolResponse>;
}

declare global {
  interface Window {
    __thinkingMapAgent?: AgentDriver;
  }
}

/**
 * Publish a headless driver over the same bound catalog.
 *
 * This is not a debug convenience. WebMCP is top-level-secure-context only and
 * codeyam renders the app inside a capture iframe, so `navigator.modelContext`
 * is genuinely absent in every preview and every scenario. The driver calls the
 * exact catalog entries a real agent would, which is what makes these tools
 * exercisable at all without a browser agent attached.
 */
export function publishAgentDriver(ctx: {
  mapId: string;
  client?: ToolClient;
}): Disposer {
  if (typeof window === 'undefined') return () => {};
  window.__thinkingMapAgent = {
    mapId: ctx.mapId,
    listTools: toolSummaries,
    callTool: (name: string, input?: unknown) =>
      callCatalogTool(name, input, ctx),
  };
  return () => {
    if (window.__thinkingMapAgent?.mapId === ctx.mapId) {
      delete window.__thinkingMapAgent;
    }
  };
}

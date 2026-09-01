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
  toolSummaries,
  validateToolInput,
} from './toolInvocation';

interface RegisterToolDescriptor {
  name: string;
  description: string;
  inputSchema: unknown;
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
  registerTool?(descriptor: RegisterToolDescriptor): unknown;
  unregisterTool?(name: string): unknown;
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

function modelContext(): ModelContextLike | null {
  if (typeof navigator === 'undefined') return null;
  const mc = (navigator as Navigator & { modelContext?: ModelContextLike })
    .modelContext;
  return mc ?? null;
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

/**
 * Register the catalog with the browser agent for one map.
 *
 * Re-registering a live name throws `InvalidStateError`, so unregister-then-
 * register is the only safe update path — which is what the returned disposer
 * is for, and why the caller must dispose before binding a different map.
 */
export function bindTools(ctx: {
  mapId: string;
  client?: ToolClient;
}): Disposer {
  const mc = modelContext();
  if (!mc) return () => {};

  const descriptors: RegisterToolDescriptor[] = buildToolDescriptors(
    (name) => (args) => callCatalogTool(name, args, ctx),
  );

  if (typeof mc.registerTool === 'function') {
    for (const d of descriptors) {
      try {
        mc.registerTool(d);
      } catch {
        // A name left registered by a previous binding that failed to dispose.
        // Losing one tool is better than losing the whole binding.
      }
    }
    return () => {
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
    mc.provideContext({ tools: descriptors });
    return () => {
      try {
        mc.provideContext?.({ tools: [] });
      } catch {
        // Nothing to undo.
      }
    };
  }

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

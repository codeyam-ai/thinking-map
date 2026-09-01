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

interface ModelContextLike {
  registerTool?(descriptor: RegisterToolDescriptor): unknown;
  unregisterTool?(name: string): unknown;
  /** The pre-March-2026 convention the polyfill still ships. */
  provideContext?(context: { tools: RegisterToolDescriptor[] }): unknown;
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
  kind: 'user.answer' | 'user.note' | 'user.node',
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

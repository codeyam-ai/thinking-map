// The decisions a page-side tool call makes, separated from the wire.
//
// `webmcp.ts` has to talk to `navigator.modelContext` and to the tools route,
// and neither can be reasoned about without a browser. Everything it DECIDES —
// whether the agent's input fits the tool, what a validation failure should
// say, which questions came back pending, what an answered call reports — lives
// here instead, where it is ordinary testable code.

import type { z } from 'zod';
import {
  TOOL_CATALOG,
  findTool,
  type McpToolResponse,
  type ToolSpec,
} from './toolCatalog';

/** A fault the agent should see as a fault, rather than a result to reason about. */
export function errorResponse(text: string): McpToolResponse {
  return { content: [{ type: 'text', text }], isError: true };
}

export type Validated =
  | { ok: true; tool: ToolSpec; input: Record<string, unknown> }
  | { ok: false; response: McpToolResponse };

/**
 * Check an agent's input against the tool it named.
 *
 * Agent input is untrusted, and this runs on the page as well as on the server —
 * not redundantly, but because it turns a malformed call into an immediate
 * readable answer instead of a round trip. A failure names the offending fields
 * so the agent can correct itself rather than guess.
 */
export function validateToolInput(name: string, rawInput: unknown): Validated {
  const tool = findTool(name);
  if (!tool) return { ok: false, response: errorResponse(`No tool named ${name}.`) };

  const parsed = (tool.inputSchema as z.ZodTypeAny).safeParse(rawInput ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return {
      ok: false,
      response: errorResponse(`That input does not fit ${name}: ${problems}`),
    };
  }

  return { ok: true, tool, input: parsed.data as Record<string, unknown> };
}

/**
 * The questions a pending `ask_user` is waiting on.
 *
 * The server writes the questions onto the map and hands back this pending
 * shape; only the page can perform the middle step of asking a person. An
 * empty list means there is nobody to ask about, so the caller should return
 * the server's response untouched.
 */
export function pendingQuestions(
  response: McpToolResponse,
): { id: string; text: string }[] {
  if (response.isError) return [];
  const raw = response.structuredContent?.questions;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, text } = entry as { id?: unknown; text?: unknown };
    if (typeof id !== 'string' || typeof text !== 'string') return [];
    return [{ id, text }];
  });
}

/** What the agent is told once the person has answered. */
export function answeredResponse(
  answers: { id: string; text: string; answer: string }[],
): McpToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: [
          'They answered:',
          ...answers.map((a) => `- ${a.text}\n  → ${a.answer}`),
        ].join('\n'),
      },
    ],
    structuredContent: { status: 'answered', answers },
  };
}

/** One tool as the WebMCP draft wants it described. */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
  execute(args: unknown): Promise<McpToolResponse>;
}

/**
 * The descriptors to hand a browser agent, one per catalog tool.
 *
 * Separated from the registration itself so that WHAT the agent is offered can
 * be checked without a `navigator.modelContext` — the registration is a
 * boundary call, but the set being registered is a contract.
 */
export function buildToolDescriptors(
  execute: (name: string) => (args: unknown) => Promise<McpToolResponse>,
): ToolDescriptor[] {
  return TOOL_CATALOG.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
    execute: execute(tool.name),
  }));
}

/** The catalog as a browser agent or a driver lists it. */
export function toolSummaries(): {
  name: string;
  title: string;
  description: string;
}[] {
  return TOOL_CATALOG.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
  }));
}

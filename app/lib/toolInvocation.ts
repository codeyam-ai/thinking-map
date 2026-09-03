// The decisions a page-side tool call makes, separated from the wire.
//
// `webmcp.ts` has to talk to `navigator.modelContext` and to the tools route,
// and neither can be reasoned about without a browser. Everything it DECIDES —
// whether the agent's input fits the tool, what a validation failure should
// say, which questions came back pending, what an answered call reports — lives
// here instead, where it is ordinary testable code.

import { z } from 'zod';
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

// Nothing here builds an image block, and that is the finding rather than an
// omission. The page forwards a tool call to the server and hands back what
// came off the wire, so a picture reaches the agent already MCP-shaped — the
// widened `content` union in `toolCatalog.ts` was the whole change this file
// needed. A builder here would have no caller.

/**
 * What a response SAYS, as one string.
 *
 * `content` became a union the day an agent could be handed a picture, and
 * every caller that only wanted the words would otherwise have to narrow it
 * itself. Blocks are joined rather than the first one taken: a result is text
 * followed by pictures, and taking `content[0]` would quietly hold only the
 * caption once a tool started returning more than one text block.
 */
export function textOf(response: McpToolResponse): string {
  return response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
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

/** A plain JSON Schema object — no class instances, no closures, nothing a
 *  structured clone would refuse. The shape the browser can actually take. */
export type JsonSchema = Record<string, unknown>;

/** One tool as the WebMCP draft wants it described. */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: Record<string, unknown>;
  execute(args: unknown): Promise<McpToolResponse>;
}

// One conversion per tool for the life of the page. The catalog is frozen at
// module scope, so re-deriving on every bind would be pure waste — and a stable
// identity means a re-registration hands the browser the same schema it saw.
const schemaCache = new Map<string, JsonSchema>();

/**
 * The catalog's Zod schema as JSON Schema.
 *
 * This is the whole reason a browser agent can see these tools at all.
 * `registerTool()` sends the descriptor across an agent boundary, so every
 * field has to survive a structured clone. A Zod schema does not: it is a live
 * graph of class instances and closures, and handing one over throws — which
 * the binding swallowed, leaving a page that reported an attached agent and
 * exposed nothing to it.
 *
 * The server doors never hit this because the MCP SDK converts internally. Only
 * the page door passes a schema across by itself, so only the page door has to
 * do the conversion by itself.
 */
export function jsonSchemaFor(tool: ToolSpec): JsonSchema {
  const cached = schemaCache.get(tool.name);
  if (cached) return cached;
  // `io: 'input'` describes what the agent must SEND, which is what a tool's
  // input schema means; the output view would encode defaults as required.
  const schema = z.toJSONSchema(tool.inputSchema, { io: 'input' }) as JsonSchema;
  schemaCache.set(tool.name, schema);
  return schema;
}

/**
 * Why a descriptor cannot cross the agent boundary, or null if it can.
 *
 * `structuredClone` is not a proxy for the check — it IS the check, the same
 * algorithm the browser applies on the way out. Running it here turns an opaque
 * `DataCloneError` thrown from inside the browser into a named tool and a
 * reason the dev diagnostic can print.
 */
export function serializationProblem(
  descriptor: ToolDescriptor,
): string | null {
  try {
    structuredClone({
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
      annotations: descriptor.annotations,
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (!descriptor.description) return 'no description';
  const schema = descriptor.inputSchema;
  if (!schema || typeof schema !== 'object') {
    return 'input schema is not an object';
  }
  if (schema.type !== 'object') {
    return `input schema type is ${String(schema.type)}, not object`;
  }
  return null;
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
    inputSchema: jsonSchemaFor(tool),
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

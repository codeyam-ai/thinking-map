// One catalog, every front door.
//
// Thinking Map now has three ways in: the WebMCP binding in the page, the HTTP
// MCP endpoint, and the stdio server. Defining each tool's name, description
// and schema ONCE and consuming that from every door is what stops a third
// front door from quietly drifting away from the other two.
//
// This module is deliberately ISOMORPHIC: it declares what the tools are, and
// nothing about how they run. The implementations live in `toolRuntime.ts`,
// which reaches the database and therefore cannot exist in a browser bundle —
// importing it from here would drag Prisma (and `fs`) into the page. The split
// is what lets the browser binding describe the very same tools it cannot
// itself execute.

import { z } from 'zod';
import { NODE_KINDS, NODE_STATUSES, PHASES } from './mapKinds';
import type { Origin } from './exchange';

/**
 * What a tool is given when it runs.
 *
 * `mapId` is injected rather than passed by the agent on the page door — a page
 * is already scoped to one map, so making the agent supply an id it cannot see
 * would be a needless failure mode. The server doors inject it from the call's
 * own `mapId` argument instead.
 */
export interface ToolContext {
  mapId: string;
  origin: Origin;
  /** The page's bridge, when one is mounted. Absent on the server doors, which
   *  is why every use of it is guarded rather than assumed. */
  client?: ToolClient;
}

/** The page-side capability the waiting tools need: somewhere to put a question
 *  in front of an actual person. */
export interface ToolClient {
  /** Resolve with the person's answers, or null if they did not answer in time.
   *  Never rejects — a timeout is a normal outcome, not a fault. */
  askUser(
    questions: { id: string; text: string }[],
    timeoutMs: number,
  ): Promise<{ id: string; text: string; answer: string }[] | null>;
  /** Ask the running agent's host to bring the page forward, where supported. */
  requestUserInteraction?<T>(run: () => Promise<T>): Promise<T>;
}

export interface ToolResult {
  text: string;
  structured?: Record<string, unknown>;
}

/**
 * The MCP-shaped response every door marshals its results into.
 *
 * The index signature is what the MCP SDK's own result type requires — it is
 * how `_meta` and future fields pass through — so declaring it here lets this
 * one type satisfy the SDK handler and the browser binding alike.
 */
export interface McpToolResponse {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const nodeShape = z.object({
  ref: z
    .string()
    .describe(
      'A temporary id for this node so later nodes in the same call can name it as their parent.',
    ),
  parentRef: z
    .string()
    .optional()
    .describe(
      'The ref of a node created earlier in this call, or the real id of an existing node. Omit only for a root idea.',
    ),
  kind: z.enum(NODE_KINDS),
  label: z.string().describe('Short text for the pill; aim for under 40 characters.'),
  detail: z.string().optional(),
  status: z.enum(NODE_STATUSES).optional(),
  sourceUrl: z.string().optional(),
  tests: z
    .string()
    .optional()
    .describe(
      'Only for a "slice": the ref or real id of the ONE node this slice would settle — the assumption, risk, or open question that building it would answer. If it settles nothing, leave this off rather than picking the nearest node; an increment that tests nothing is shown as proving nothing, which is the honest answer.',
    ),
  sourceRef: z
    .string()
    .optional()
    .describe(
      "The brief section this claim came from, as the section id read_brief reported (e.g. 's7'). Cite the section a claim actually came from; leave it off rather than guessing. A node you inferred across the whole document, or one the person typed, has no single source — an omitted ref is correct there, and a wrong one is worse than none.",
    ),
  options: z
    .array(z.string())
    .optional()
    .describe(
      'Only meaningful on an "open-question": a few likely answers to offer as one-tap chips. The person can always type their own — a chip fills the box rather than sending it — so these are a head start, not a closed set of choices. Omit them when you genuinely cannot guess; a question with no options is an ordinary question with a text box.',
    ),
});

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  annotations?: { readOnlyHint?: boolean };
}

/**
 * The tools every front door shares.
 *
 * `list_thinking_maps` and `create_thinking_map` are deliberately absent: they
 * are server-door-only, because a page is already on a map and has nothing to
 * do with either.
 */
export const TOOL_CATALOG: readonly ToolSpec[] = [
  {
    name: 'read_map',
    title: 'Read the map',
    description:
      'Read the thinking map. With no sinceRevision, returns the whole map and its current revision. With one, returns only what changed after that revision — which is what a returning agent wants, so it does not re-ingest what it already knows.',
    inputSchema: z.object({
      sinceRevision: z
        .number()
        .int()
        .optional()
        .describe('Return only changes after this revision. Omit for the full map.'),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_brief',
    title: 'Read the client brief',
    description:
      "Read the client's own document, when the map was started from one. With no section, returns the OUTLINE — one line per section with its id, heading and length — which is cheap enough to call on any turn. With a section id, returns that passage in full. Read the outline first and pull only the passages you actually need; walking every section of a long spec into your context is how you run out of room to think. The client did not send this to have it summarised back at them — read it to find what it does NOT say, and ask about that.",
    inputSchema: z.object({
      section: z
        .string()
        .optional()
        .describe(
          'A section id from the outline, e.g. "s3". Omit to get the outline.',
        ),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_nodes',
    title: 'Add nodes to the map',
    description:
      'Add one or more nodes. Parents must appear before their children. Use status "open" for a question nobody has answered yet. Pass a requestId so a retry cannot duplicate the write.',
    inputSchema: z.object({
      nodes: z.array(nodeShape),
      requestId: z
        .string()
        .optional()
        .describe('Idempotency key. Retrying with the same value is a no-op.'),
    }),
  },
  {
    name: 'update_node',
    title: 'Update a node',
    description:
      'Change an existing node — typically when an answer resolves an open question. Pass expectedRevision to be told, rather than silently overwrite, if the person changed the map since you last read it.',
    inputSchema: z.object({
      id: z.string(),
      label: z.string().optional(),
      detail: z.string().optional(),
      kind: z.enum(NODE_KINDS).optional(),
      status: z.enum(NODE_STATUSES).optional(),
      tests: z
        .string()
        .optional()
        .describe(
          'The id of the node this slice would settle. A slice\'s purpose usually sharpens once the whole sequence is laid out, so this is editable after the fact.',
        ),
      expectedRevision: z
        .number()
        .int()
        .optional()
        .describe(
          'The revision you last read. If the map has moved past it, the write is declined and both versions are described back to you.',
        ),
      requestId: z.string().optional(),
    }),
  },
  {
    name: 'set_phase',
    title: 'Move the map to a new phase',
    description:
      'Advance the map through the loop once the conversation has genuinely reached the next phase.',
    inputSchema: z.object({ phase: z.enum(PHASES) }),
  },
  {
    name: 'post_note',
    title: 'Say what you changed and why',
    description:
      'Leave a one-line note on the map explaining what you just did. This replaces the assistant chat bubble: a note attached to the map, not a conversation. Keep it to a sentence.',
    inputSchema: z.object({ text: z.string() }),
  },
  {
    name: 'ask_user',
    title: 'Ask the person a question',
    description:
      'Put one or more questions on the map and wait for the person to answer them in the page. Bounded: if they do not answer in time you get status "pending" and a cursor, the questions stay on screen, and their answer lands in the log for your next read. Nothing is lost by giving up.',
    inputSchema: z.object({
      // A question is either the bare string it always was, or that string with
      // a few suggested answers attached. The union rather than a replacement
      // is what keeps every agent written against the old shape working
      // verbatim — `questions: ["…"]` is still valid input.
      questions: z
        .array(
          z.union([
            z.string(),
            z.object({
              text: z.string(),
              options: z
                .array(z.string())
                .optional()
                .describe(
                  'A few likely answers, offered as one-tap chips. A chip fills the answer box rather than sending it, so the person can still edit or ignore them.',
                ),
            }),
          ]),
        )
        .min(1),
      timeoutSeconds: z.number().int().optional(),
    }),
  },
  {
    name: 'await_user_activity',
    title: 'Wait for the person to do something',
    description:
      'Block until the person contributes to the map, then return what they did. Use this instead of polling read_map in a loop when you have nothing to do but wait. Bounded: on expiry you get timedOut true and the cursor to resume from.',
    inputSchema: z.object({
      sinceRevision: z.number().int(),
      timeoutSeconds: z.number().int().optional(),
    }),
    annotations: { readOnlyHint: true },
  },
];

export function findTool(name: string): ToolSpec | undefined {
  return TOOL_CATALOG.find((t) => t.name === name);
}

/** Default patience for the two waiting tools, and the ceiling on it. A cap
 *  exists so a confused agent cannot pin a connection open indefinitely. */
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const MAX_TIMEOUT_SECONDS = 600;

export function timeoutMsFrom(seconds: number | undefined): number {
  const s = Math.min(seconds ?? DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);
  return Math.max(1, s) * 1000;
}

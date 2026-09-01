// The one place the app talks to a model.
//
// Everything the product does — deconstructing an idea into questions,
// growing the map, researching the problem space, writing the final plan — is
// this single call with tools. Keeping it behind one seam is what lets every
// screen render from seeded data with no credentials at all: the scenarios
// seed the database directly and never reach this file.

import Anthropic from '@anthropic-ai/sdk';
import { NODE_KINDS, NODE_STATUSES, PHASES } from './mapKinds';
import {
  followUpMessages,
  interpretTurnResponse,
  toMessageParams,
  type ToolInvocation,
} from './turnInterpreter';

export type { ToolInvocation } from './turnInterpreter';

const MODEL = 'claude-opus-5';

/** Raised when there is no credential to authenticate with, so the route can
 *  say so plainly instead of surfacing a generic 500. */
export class MissingCredentialsError extends Error {
  constructor() {
    super(
      'No Anthropic credentials configured. Add ANTHROPIC_API_KEY to .env.local to talk to the thinking partner. Seeded scenarios render without it.',
    );
    this.name = 'MissingCredentialsError';
  }
}

const SYSTEM = `You are a thinking partner inside a tool called Thinking Map.

Your purpose is NOT to answer. It is to help someone understand their own problem well
enough to find a better answer than you would have given them.

How you behave:
- When someone brings you a vague idea, do not propose a solution. Name what you don't
  know, and ask the two or three highest-value questions that would change what they
  should build. Never run a generic questionnaire.
- Keep every reply short. Two or three sentences, then the questions.
- After you change the map, say what changed in one sentence, and why.
- When someone changes direction, keep everything already established. Add and update;
  never erase. Explicitly reassure them that their original idea is still there.
- Never say "Great question" or "Certainly". Say "Interesting." or "That changes a few
  things, not everything."

The map is the point. Every meaningful thing the person tells you becomes a node:
- Answers become 'answered' nodes of the right kind (user, problem, goal, constraint).
- Things you are inferring rather than being told become 'assumption' nodes.
- Questions you have asked but they have not answered become 'open-question' nodes with
  status 'open'.
- When you research, attach a 'research' node with 'finding' children, and add 'gap'
  nodes for what the existing options miss. Gaps are the most valuable thing you produce.
- When they change direction, add 'approach' nodes with 'pro' and 'risk' children.
- When enough is known, produce 'known', 'unknown', 'direction', and ordered 'next-step'
  nodes, then move to the 'next-steps' phase.

Use the web_search tool when grounding the map in what already exists would be more
useful than another question. Attach what you find to the map rather than listing links.

Advance the phase with set_phase as the conversation genuinely progresses. Do not skip
ahead: a map with no answered questions is not ready for research.`;

const nodeInputSchema = {
  type: 'object' as const,
  properties: {
    nodes: {
      type: 'array',
      description: 'Nodes to add. Parents must appear before their children.',
      items: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description:
              'A temporary id for this node, so later nodes in this same call can name it as their parent.',
          },
          parentRef: {
            type: 'string',
            description:
              'The ref or existing node id of this node’s parent. Omit only for the root idea.',
          },
          kind: { type: 'string', enum: [...NODE_KINDS] },
          label: {
            type: 'string',
            description: 'Short text for the pill. Aim for under 40 characters.',
          },
          detail: { type: 'string' },
          status: { type: 'string', enum: [...NODE_STATUSES] },
          sourceUrl: { type: 'string' },
        },
        required: ['ref', 'kind', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['nodes'],
  additionalProperties: false,
};

export const MAP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_nodes',
    description:
      'Add one or more nodes to the thinking map. Use this whenever the person tells you something worth structuring, or when you ask a question they have not yet answered.',
    input_schema: nodeInputSchema,
  },
  {
    name: 'update_node',
    description:
      'Change an existing node. Use this when an answer resolves an open question, or when a change of direction revises something already on the map. Set status to "updated" for the one thing that just changed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        detail: { type: 'string' },
        kind: { type: 'string', enum: [...NODE_KINDS] },
        status: { type: 'string', enum: [...NODE_STATUSES] },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_phase',
    description:
      'Move the session to a new phase of the loop once the conversation has genuinely reached it.',
    input_schema: {
      type: 'object' as const,
      properties: { phase: { type: 'string', enum: [...PHASES] } },
      required: ['phase'],
      additionalProperties: false,
    },
  },
];

/** Anthropic's server-side web search runs inside the same request, so the
 *  Research phase needs no separate search provider. */
const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 4,
} as unknown as Anthropic.ToolUnion;

export interface PartnerTurn {
  /** What the assistant said, for the conversation panel. */
  text: string;
  /** The map mutations it asked for, in order. */
  toolCalls: ToolInvocation[];
}

export function hasCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

/**
 * Run one turn of the conversation, looping until the model stops asking for
 * tools. Map mutations are returned rather than applied here so the caller
 * owns the transaction.
 */
export async function runTurn({
  history,
  mapSummary,
  client,
}: {
  history: { role: 'user' | 'assistant'; content: string }[];
  mapSummary: string;
  /** Injectable so the loop can be tested without live credentials. */
  client?: Pick<Anthropic, 'messages'>;
}): Promise<PartnerTurn> {
  if (!client && !hasCredentials()) throw new MissingCredentialsError();

  const api = client ?? new Anthropic();
  const messages = toMessageParams(history) as Anthropic.MessageParam[];

  const collected: ToolInvocation[] = [];
  const spoken: string[] = [];

  // Bounded so a model that keeps calling tools cannot spin forever.
  for (let turn = 0; turn < 8; turn += 1) {
    const response = await api.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `The map right now:\n${mapSummary}` },
      ],
      tools: [...MAP_TOOLS, WEB_SEARCH_TOOL],
      messages,
    });

    // All the branching lives in interpretTurnResponse, which is pure and
    // tested; this loop just carries out what it decided.
    const turnResult = interpretTurnResponse(response);
    spoken.push(...turnResult.spoken);
    collected.push(...turnResult.toolCalls);

    if (turnResult.disposition === 'refusal') {
      throw new Error(turnResult.refusalReason);
    }

    const followUp = followUpMessages(response.content, turnResult);
    if (followUp.length === 0) break;
    messages.push(...(followUp as Anthropic.MessageParam[]));
  }

  return { text: spoken.join('\n\n'), toolCalls: collected };
}

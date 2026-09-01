export interface ToolInvocation {
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

/** What the caller should do next with the conversation. */
export type TurnDisposition =
  | 'stop'
  | 'continue-tools'
  | 'resume-paused'
  | 'refusal';

export interface InterpretedTurn {
  /** Text the assistant spoke this round, trimmed and joined. */
  spoken: string[];
  /** Custom tool calls the model asked for. */
  toolCalls: ToolInvocation[];
  /** The tool_result blocks to send back, one per custom tool call. */
  results: ToolResultBlock[];
  disposition: TurnDisposition;
  /** Set when the disposition is 'refusal'. */
  refusalReason?: string;
}

/** The subset of an Anthropic response this needs. */
interface ResponseLike {
  content: unknown[];
  stop_reason?: string | null;
  stop_details?: { explanation?: string | null } | null;
}

const TOOL_RESULT_ACK = 'Applied to the map.';

/**
 * Decide what one model response means for the agent loop.
 *
 * Pure on purpose. The loop around it is a network call and a push onto an
 * array; the interesting part is the branching — a refusal must not be read as
 * an answer, a paused server tool must be resumed rather than treated as
 * finished, and a round that ran only server-side tools must not spin waiting
 * for custom tool results that will never come.
 */
export function interpretTurnResponse(response: ResponseLike): InterpretedTurn {
  const spoken: string[] = [];
  const toolCalls: ToolInvocation[] = [];
  const results: ToolResultBlock[] = [];

  for (const raw of response.content ?? []) {
    const block = (raw ?? {}) as Record<string, unknown>;
    if (block.type === 'text' && typeof block.text === 'string') {
      const text = block.text.trim();
      if (text) spoken.push(text);
    }
    if (block.type === 'tool_use') {
      toolCalls.push({ name: String(block.name), input: block.input });
      results.push({
        type: 'tool_result',
        tool_use_id: String(block.id),
        content: TOOL_RESULT_ACK,
      });
    }
  }

  // A safety decline is not an answer — surfacing it as one would put the
  // model's refusal text into the map as though it were thinking.
  if (response.stop_reason === 'refusal') {
    return {
      spoken,
      toolCalls,
      results,
      disposition: 'refusal',
      refusalReason:
        response.stop_details?.explanation ??
        'The model declined to answer this one.',
    };
  }

  // A server-side tool (web search) paused the turn; resend to let it finish.
  if (response.stop_reason === 'pause_turn') {
    return { spoken, toolCalls, results, disposition: 'resume-paused' };
  }

  if (response.stop_reason !== 'tool_use') {
    return { spoken, toolCalls, results, disposition: 'stop' };
  }

  // stop_reason was tool_use but only server-side tools ran, so there is
  // nothing for us to answer — continuing would spin.
  if (results.length === 0) {
    return { spoken, toolCalls, results, disposition: 'stop' };
  }

  return { spoken, toolCalls, results, disposition: 'continue-tools' };
}

/** One entry in the Anthropic `messages` array, as far as this module cares. */
export interface MessageParamLike {
  role: 'user' | 'assistant';
  content: unknown;
}

/**
 * Convert stored conversation rows into the API's message array.
 *
 * Anything that is not an assistant turn is a user turn: the database column
 * is a free string, so an unexpected role must land somewhere rather than
 * throw mid-conversation.
 */
export function toMessageParams(
  history: { role: string; content: string }[],
): MessageParamLike[] {
  return history.map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }));
}

/**
 * What to append to the conversation before the next request.
 *
 * An empty array means the loop is finished. A paused turn needs the
 * assistant's partial content echoed back so the server tool can resume; a
 * tool round additionally needs the matching tool_result blocks, which the API
 * requires in a single user message.
 */
export function followUpMessages(
  assistantContent: unknown,
  turn: InterpretedTurn,
): MessageParamLike[] {
  if (turn.disposition === 'resume-paused') {
    return [{ role: 'assistant', content: assistantContent }];
  }
  if (turn.disposition === 'continue-tools') {
    return [
      { role: 'assistant', content: assistantContent },
      { role: 'user', content: turn.results },
    ];
  }
  return [];
}

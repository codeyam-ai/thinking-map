import { describe, expect, it } from 'vitest';
import {
  followUpMessages,
  interpretTurnResponse,
  toMessageParams,
} from './turnInterpreter';

const text = (t: string) => ({ type: 'text', text: t });
const toolUse = (id: string, name: string, input: unknown) => ({
  type: 'tool_use',
  id,
  name,
  input,
});

// This is the branching at the heart of the agent loop. Getting any of these
// wrong either spins the loop, drops the model's work, or presents a refusal
// as though it were an answer.
describe('interpretTurnResponse', () => {
  // The ordinary finish: the partner spoke and wants nothing more.
  it('stops on a plain end_turn and keeps the spoken text', () => {
    const result = interpretTurnResponse({
      content: [text('That changes a few things.')],
      stop_reason: 'end_turn',
    });
    expect(result.disposition).toBe('stop');
    expect(result.spoken).toEqual(['That changes a few things.']);
  });

  // Empty or whitespace-only blocks would render as blank bubbles.
  it('discards empty text blocks', () => {
    const result = interpretTurnResponse({
      content: [text('   '), text('Real.')],
      stop_reason: 'end_turn',
    });
    expect(result.spoken).toEqual(['Real.']);
  });

  // The main path when the model is building the map.
  it('collects tool calls and asks the caller to continue', () => {
    const result = interpretTurnResponse({
      content: [toolUse('tu_1', 'add_nodes', { nodes: [] })],
      stop_reason: 'tool_use',
    });
    expect(result.disposition).toBe('continue-tools');
    expect(result.toolCalls).toEqual([{ name: 'add_nodes', input: { nodes: [] } }]);
  });

  // The API requires one tool_result per tool_use; a missing one fails the
  // next request outright.
  it('emits one tool_result per tool call, keyed by its id', () => {
    const result = interpretTurnResponse({
      content: [
        toolUse('tu_1', 'add_nodes', {}),
        toolUse('tu_2', 'set_phase', { phase: 'research' }),
      ],
      stop_reason: 'tool_use',
    });
    expect(result.results.map((r) => r.tool_use_id)).toEqual(['tu_1', 'tu_2']);
    expect(result.results.every((r) => r.type === 'tool_result')).toBe(true);
  });

  // A safety decline is not an answer; treating it as one would put the
  // refusal text into the map as though it were thinking.
  it('reports a refusal rather than treating it as an answer', () => {
    const result = interpretTurnResponse({
      content: [],
      stop_reason: 'refusal',
      stop_details: { explanation: 'Declined for policy reasons.' },
    });
    expect(result.disposition).toBe('refusal');
    expect(result.refusalReason).toBe('Declined for policy reasons.');
  });

  // stop_details can be absent, and the caller still needs something to show.
  it('falls back to a readable reason when a refusal carries no explanation', () => {
    const result = interpretTurnResponse({ content: [], stop_reason: 'refusal' });
    expect(result.refusalReason).toBe('The model declined to answer this one.');
  });

  // Web search pauses the turn mid-flight; stopping here would silently drop
  // the research the Research phase depends on.
  it('asks the caller to resume a paused turn', () => {
    const result = interpretTurnResponse({
      content: [text('Looking that up.')],
      stop_reason: 'pause_turn',
    });
    expect(result.disposition).toBe('resume-paused');
  });

  // A round where only the server-side web_search ran reports tool_use but
  // leaves us nothing to answer — continuing would spin the loop forever.
  it('stops when tool_use is reported but no custom tool was called', () => {
    const result = interpretTurnResponse({
      content: [text('Found three apps.')],
      stop_reason: 'tool_use',
    });
    expect(result.disposition).toBe('stop');
    expect(result.results).toEqual([]);
  });

  // A response can carry both a sentence and the map changes it describes.
  it('keeps text and tool calls from the same response', () => {
    const result = interpretTurnResponse({
      content: [text('Adding those now.'), toolUse('tu_1', 'add_nodes', {})],
      stop_reason: 'tool_use',
    });
    expect(result.spoken).toEqual(['Adding those now.']);
    expect(result.toolCalls).toHaveLength(1);
  });

  // A malformed or empty response must not throw and lose the turn.
  it('survives an empty or malformed content array', () => {
    expect(interpretTurnResponse({ content: [] }).disposition).toBe('stop');
    expect(
      interpretTurnResponse({ content: [null, undefined, {}] as unknown[] })
        .disposition,
    ).toBe('stop');
  });
});

describe('toMessageParams', () => {
  // The stored role column is a free string; an assistant turn must survive
  // as one or the conversation loses its shape on the next request.
  it('preserves assistant and user turns', () => {
    expect(
      toMessageParams([
        { role: 'user', content: 'An idea' },
        { role: 'assistant', content: 'Three questions' },
      ]),
    ).toEqual([
      { role: 'user', content: 'An idea' },
      { role: 'assistant', content: 'Three questions' },
    ]);
  });

  // Anything unexpected must land somewhere rather than throw mid-conversation
  // and lose the turn the person just typed.
  it('treats an unrecognised role as a user turn', () => {
    expect(toMessageParams([{ role: 'system', content: 'x' }])).toEqual([
      { role: 'user', content: 'x' },
    ]);
  });

  // A brand-new map has no history yet.
  it('returns nothing for an empty history', () => {
    expect(toMessageParams([])).toEqual([]);
  });
});

describe('followUpMessages', () => {
  const base = { spoken: [], toolCalls: [], results: [] };

  // An empty array is how the loop learns it is finished.
  it('appends nothing when the turn is done', () => {
    expect(
      followUpMessages(['content'], { ...base, disposition: 'stop' }),
    ).toEqual([]);
  });

  // A paused server tool needs the assistant's partial content echoed back,
  // and nothing else, or the search cannot resume.
  it('echoes the assistant content back to resume a paused turn', () => {
    const out = followUpMessages('partial', {
      ...base,
      disposition: 'resume-paused',
    });
    expect(out).toEqual([{ role: 'assistant', content: 'partial' }]);
  });

  // The API requires the tool_results in a single user message following the
  // assistant turn that requested them.
  it('appends the assistant turn then all tool results in one user message', () => {
    const results = [
      { type: 'tool_result' as const, tool_use_id: 'tu_1', content: 'ok' },
      { type: 'tool_result' as const, tool_use_id: 'tu_2', content: 'ok' },
    ];
    const out = followUpMessages('blocks', {
      ...base,
      results,
      disposition: 'continue-tools',
    });
    expect(out).toEqual([
      { role: 'assistant', content: 'blocks' },
      { role: 'user', content: results },
    ]);
  });

  // A refusal is thrown by the caller, so nothing should be queued for a
  // request that will never be sent.
  it('appends nothing for a refusal', () => {
    expect(
      followUpMessages('x', { ...base, disposition: 'refusal' }),
    ).toEqual([]);
  });
});

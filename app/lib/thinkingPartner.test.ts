import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { MissingCredentialsError, runTurn } from './thinkingPartner';

const text = (t: string) => ({ type: 'text', text: t });
const toolUse = (id: string, name: string, input: unknown) => ({
  type: 'tool_use',
  id,
  name,
  input,
});

/** A stand-in for the SDK client that replays a scripted set of responses. */
function fakeClient(responses: unknown[]) {
  const calls: { messages: unknown[] }[] = [];
  const create = vi.fn(async (params: { messages: unknown[] }) => {
    // Snapshot the array — runTurn mutates the same one across iterations.
    calls.push({ messages: [...params.messages] });
    return responses[Math.min(calls.length - 1, responses.length - 1)];
  });
  return {
    client: { messages: { create } } as unknown as Pick<Anthropic, 'messages'>,
    calls,
    create,
  };
}

const history = [{ role: 'user' as const, content: 'An idea' }];

// The agent loop itself. The per-response decisions are covered in
// turnInterpreter.test.ts; these pin the looping, the accumulation across
// rounds, and the safety bound.
describe('runTurn', () => {
  // Without credentials the route must be able to say so plainly rather than
  // surface a generic 500 from a failed request.
  it('refuses up front when there are no credentials and no injected client', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    await expect(runTurn({ history, mapSummary: '(empty)' })).rejects.toBeInstanceOf(
      MissingCredentialsError,
    );
    vi.unstubAllEnvs();
  });

  // A plain reply should cost exactly one request.
  it('returns the spoken text after a single round', async () => {
    const { client, create } = fakeClient([
      { content: [text('Interesting.')], stop_reason: 'end_turn' },
    ]);
    const result = await runTurn({ history, mapSummary: '(empty)', client });
    expect(result.text).toBe('Interesting.');
    expect(create).toHaveBeenCalledTimes(1);
  });

  // The core loop: a tool round must be answered and the conversation resumed.
  it('loops after a tool round and collects the calls', async () => {
    const { client, create } = fakeClient([
      {
        content: [toolUse('tu_1', 'add_nodes', { nodes: [] })],
        stop_reason: 'tool_use',
      },
      { content: [text('Added those.')], stop_reason: 'end_turn' },
    ]);
    const result = await runTurn({ history, mapSummary: '(empty)', client });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.toolCalls).toEqual([{ name: 'add_nodes', input: { nodes: [] } }]);
    expect(result.text).toBe('Added those.');
  });

  // Text spoken before a tool call must not be dropped when the loop continues.
  it('accumulates text across rounds', async () => {
    const { client } = fakeClient([
      {
        content: [text('Let me look.'), toolUse('tu_1', 'add_nodes', {})],
        stop_reason: 'tool_use',
      },
      { content: [text('Here is what I found.')], stop_reason: 'end_turn' },
    ]);
    const result = await runTurn({ history, mapSummary: '(empty)', client });
    expect(result.text).toBe('Let me look.\n\nHere is what I found.');
  });

  // The next request must carry the tool results, or the API rejects it.
  it('sends the tool results back on the following request', async () => {
    const { client, calls } = fakeClient([
      { content: [toolUse('tu_1', 'set_phase', {})], stop_reason: 'tool_use' },
      { content: [text('Done.')], stop_reason: 'end_turn' },
    ]);
    await runTurn({ history, mapSummary: '(empty)', client });
    expect(calls[1].messages).toHaveLength(3);
    expect(calls[1].messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Applied to the map.' },
      ],
    });
  });

  // A refusal must reach the caller as an error, not be presented as thinking.
  it('throws with the refusal explanation', async () => {
    const { client } = fakeClient([
      {
        content: [],
        stop_reason: 'refusal',
        stop_details: { explanation: 'Declined for policy reasons.' },
      },
    ]);
    await expect(
      runTurn({ history, mapSummary: '(empty)', client }),
    ).rejects.toThrow('Declined for policy reasons.');
  });

  // A paused server-side search must be resumed rather than treated as the end.
  it('resumes a turn paused by a server-side tool', async () => {
    const { client, create } = fakeClient([
      { content: [text('Searching.')], stop_reason: 'pause_turn' },
      { content: [text('Found three.')], stop_reason: 'end_turn' },
    ]);
    const result = await runTurn({ history, mapSummary: '(empty)', client });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.text).toContain('Found three.');
  });

  // A model that keeps asking for tools must not spin forever and hang the
  // request; the bound is the only thing standing between that and a hung page.
  it('stops after the iteration bound when tool calls never end', async () => {
    const { client, create } = fakeClient([
      { content: [toolUse('tu_1', 'add_nodes', {})], stop_reason: 'tool_use' },
    ]);
    await runTurn({ history, mapSummary: '(empty)', client });
    expect(create).toHaveBeenCalledTimes(8);
  });

  // The map's current state is what lets the model target existing nodes by id.
  it('passes the map summary to the model as system context', async () => {
    const { client, create } = fakeClient([
      { content: [text('ok')], stop_reason: 'end_turn' },
    ]);
    await runTurn({ history, mapSummary: '- [n-1] (Idea, answered) Root', client });
    const params = create.mock.calls[0][0] as unknown as {
      system: { text: string }[];
    };
    expect(params.system[1].text).toContain('[n-1]');
  });
});

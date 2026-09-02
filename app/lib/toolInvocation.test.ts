import { describe, expect, it } from 'vitest';
import {
  answeredResponse,
  buildToolDescriptors,
  errorResponse,
  pendingQuestions,
  toolSummaries,
  validateToolInput,
} from './toolInvocation';

// Everything a page-side tool call decides, with the browser and the network
// taken out of it. Agent input is untrusted on both sides of the wire, and the
// ask_user hand-off is the one place the page does more than forward — so these
// are the parts worth pinning.

describe('validateToolInput', () => {
  // A name the catalog does not know must come back as an answer, not a throw,
  // or one bad call takes down the whole binding.
  it('rejects a tool the catalog does not define', () => {
    const result = validateToolInput('drop_database', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.isError).toBe(true);
      expect(result.response.content[0].text).toContain('No tool named drop_database');
    }
  });

  // The happy path returns the parsed input, so defaults and coercions the
  // schema applies are what actually reach the server.
  it('accepts input that fits the tool and hands back the parsed value', () => {
    const result = validateToolInput('read_map', { sinceRevision: 12 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool.name).toBe('read_map');
      expect(result.input.sinceRevision).toBe(12);
    }
  });

  // A tool whose fields are all optional must accept an omitted payload rather
  // than forcing the agent to send an empty object.
  it('accepts a missing payload for a tool that needs no arguments', () => {
    expect(validateToolInput('read_map', undefined).ok).toBe(true);
  });

  // The message has to name the offending field, or the agent can only guess
  // at what to change.
  it('names the field that did not fit', () => {
    const result = validateToolInput('add_nodes', { nodes: 'not-an-array' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.content[0].text).toContain('nodes');
      expect(result.response.isError).toBe(true);
    }
  });

  // A required field left out is the other common agent mistake.
  it('rejects a call missing a required field', () => {
    const result = validateToolInput('await_user_activity', {});
    expect(result.ok).toBe(false);
  });

  // The controlled vocabulary is what keeps the map drawable: a kind the map
  // cannot render must never reach the database.
  it('rejects a node kind the map cannot draw', () => {
    const result = validateToolInput('add_nodes', {
      nodes: [{ ref: 'a', kind: 'wildcard', label: 'nope' }],
    });
    expect(result.ok).toBe(false);
  });

  // The phase drives the nav; one outside the loop would leave the workspace
  // with no step marked active.
  it('rejects a phase outside the loop', () => {
    expect(validateToolInput('set_phase', { phase: 'brainstorm' }).ok).toBe(false);
    expect(validateToolInput('set_phase', { phase: 'explore' }).ok).toBe(true);
  });
});

describe('pendingQuestions', () => {
  // The normal hand-off: the server wrote the questions and the page now has
  // somebody to ask.
  it('reads the questions out of a pending ask_user result', () => {
    const questions = pendingQuestions({
      content: [{ type: 'text', text: 'asked' }],
      structuredContent: {
        status: 'pending',
        questions: [{ id: 'q-1', text: 'Do you reread your notes?' }],
      },
    });
    expect(questions).toEqual([{ id: 'q-1', text: 'Do you reread your notes?' }]);
  });

  // An errored call has nothing to ask about — putting a prompt on screen off
  // the back of a failure would be worse than showing nothing.
  it('asks nothing when the call failed', () => {
    expect(
      pendingQuestions({
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
        structuredContent: { questions: [{ id: 'q', text: 'q' }] },
      }),
    ).toEqual([]);
  });

  // A tool that is not ask_user, or a result with no questions, must leave the
  // caller returning the server's response untouched.
  it('asks nothing when the result carries no questions', () => {
    expect(pendingQuestions({ content: [{ type: 'text', text: 'ok' }] })).toEqual([]);
    expect(
      pendingQuestions({
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: { questions: 'not-a-list' },
      }),
    ).toEqual([]);
  });

  // A malformed entry is dropped rather than rendered as an undefined prompt.
  it('drops entries that are not a well-formed question', () => {
    expect(
      pendingQuestions({
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: {
          questions: [
            { id: 'good', text: 'real question' },
            { id: 42, text: 'bad id' },
            null,
            { text: 'no id' },
          ],
        },
      }),
    ).toEqual([{ id: 'good', text: 'real question' }]);
  });
});

describe('answeredResponse', () => {
  // The agent needs both the question and the answer, since it may have asked
  // several and cannot match them up from the answers alone.
  it('reports each question with the answer it received', () => {
    const response = answeredResponse([
      { id: 'q-1', text: 'Do you reread your notes?', answer: 'Almost never' },
      { id: 'q-2', text: 'Alone or shared?', answer: 'Alone' },
    ]);
    expect(response.content[0].text).toContain('Do you reread your notes?');
    expect(response.content[0].text).toContain('Almost never');
    expect(response.content[0].text).toContain('Alone or shared?');
  });

  // An answered call is a success, and its status is what an agent branches on.
  it('marks the result answered and is not an error', () => {
    const response = answeredResponse([{ id: 'q', text: 'q', answer: 'a' }]);
    expect(response.structuredContent?.status).toBe('answered');
    expect(response.isError).toBeUndefined();
  });
});

describe('toolSummaries', () => {
  // What a driver or a browser agent lists. It must match the catalog exactly,
  // since a tool missing here is a tool the agent never knows it can call.
  it('summarises every catalog tool with a name, title and description', () => {
    const summaries = toolSummaries();
    expect(summaries.map((t) => t.name)).toEqual([
      'read_map',
      'create_themes',
      'read_brief',
      'add_nodes',
      'update_node',
      'set_phase',
      'post_note',
      'ask_user',
      'await_user_activity',
    ]);
    for (const summary of summaries) {
      expect(summary.title.length).toBeGreaterThan(0);
      expect(summary.description.length).toBeGreaterThan(0);
    }
  });
});

describe('buildToolDescriptors', () => {
  const noop = () => async () => ({ content: [{ type: 'text' as const, text: '' }] });

  // What a browser agent gets registered. A tool missing from this set is a
  // capability the agent silently does not have.
  it('describes every catalog tool', () => {
    expect(buildToolDescriptors(noop).map((d) => d.name)).toEqual(
      toolSummaries().map((t) => t.name),
    );
  });

  // The description and schema are how the agent decides whether and how to
  // call a tool, so they must come from the catalog rather than be restated.
  it('carries each tool’s description and schema through', () => {
    const readMap = buildToolDescriptors(noop).find((d) => d.name === 'read_map');
    expect(readMap?.description).toBe(
      toolSummaries().find((t) => t.name === 'read_map')?.description,
    );
    expect(readMap?.inputSchema).toBeDefined();
  });

  // Only the two read-only tools should carry annotations; attaching them
  // everywhere would tell an agent a write is safe to retry speculatively.
  it('attaches annotations only to the tools that declare them', () => {
    const byName = new Map(buildToolDescriptors(noop).map((d) => [d.name, d]));
    expect(byName.get('read_map')?.annotations).toEqual({ readOnlyHint: true });
    expect(byName.get('add_nodes')?.annotations).toBeUndefined();
  });

  // Each descriptor must be wired to its OWN tool — a shared or misbound
  // executor would silently run the wrong tool for every call.
  it('binds each descriptor to its own tool name', async () => {
    const calls: string[] = [];
    const descriptors = buildToolDescriptors((name) => async () => {
      calls.push(name);
      return { content: [{ type: 'text' as const, text: name }] };
    });
    await descriptors.find((d) => d.name === 'post_note')!.execute({});
    await descriptors.find((d) => d.name === 'set_phase')!.execute({});
    expect(calls).toEqual(['post_note', 'set_phase']);
  });
});

describe('errorResponse', () => {
  // Reserved for genuine faults: a conflict or a timeout is a normal result,
  // and flagging those as errors would invite the blind retry the conflict
  // path exists to prevent.
  it('marks the response as an error carrying the message', () => {
    const response = errorResponse('something broke');
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe('something broke');
  });
});

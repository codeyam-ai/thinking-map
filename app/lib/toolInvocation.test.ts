import { describe, expect, it } from 'vitest';
import {
  answeredResponse,
  buildToolDescriptors,
  errorResponse,
  jsonSchemaFor,
  pendingQuestions,
  serializationProblem,
  textOf,
  toolSummaries,
  validateToolInput,
} from './toolInvocation';
import { TOOL_CATALOG, findTool } from './toolCatalog';

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
      expect(textOf(result.response)).toContain('No tool named drop_database');
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
      expect(textOf(result.response)).toContain('nodes');
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
    expect(textOf(response)).toContain('Do you reread your notes?');
    expect(textOf(response)).toContain('Almost never');
    expect(textOf(response)).toContain('Alone or shared?');
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
      'read_attachment',
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

  // The bug this pins: descriptors used to carry the catalog's live Zod schema
  // straight through. `registerTool` copies the descriptor across an agent
  // boundary, so a Zod schema throws DataCloneError there — and the binding's
  // catch swallowed it, leaving a page that claimed an attached agent and
  // registered nothing. `toBeDefined()` above passes for a Zod schema too,
  // which is precisely why it did not catch this.
  it('describes every tool with a schema that survives a structured clone', () => {
    for (const descriptor of buildToolDescriptors(noop)) {
      expect(() => structuredClone(descriptor.inputSchema)).not.toThrow();
    }
  });

  // Not merely cloneable — actually JSON Schema. A cloneable object of the
  // wrong shape would register and then be uncallable, which is worse than a
  // registration that fails loudly.
  it('gives read_map a JSON Schema an agent can fill in', () => {
    const readMap = buildToolDescriptors(noop).find(
      (d) => d.name === 'read_map',
    );
    expect(readMap?.inputSchema).toMatchObject({
      type: 'object',
      properties: { sinceRevision: { type: 'integer' } },
    });
  });

  // The check the binding runs before handing a descriptor to the browser, so
  // a bad one is named here rather than thrown anonymously from inside Chrome.
  it('reports no serialization problem for any catalog tool', () => {
    for (const descriptor of buildToolDescriptors(noop)) {
      expect([descriptor.name, serializationProblem(descriptor)]).toEqual([
        descriptor.name,
        null,
      ]);
    }
  });

  // And catches the regression if the Zod schema is ever wired back in.
  it('names the offending field when a schema cannot be cloned', () => {
    const bad = {
      ...buildToolDescriptors(noop)[0],
      inputSchema: { parse: () => {} } as unknown as Record<string, unknown>,
    };
    expect(serializationProblem(bad)).not.toBeNull();
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

// The conversion that is the whole reason a browser agent can see these tools
// at all. A Zod schema is a live graph of class instances and closures, and
// handing one across the agent boundary throws — which the binding used to
// swallow, leaving a page that claimed an attached agent and exposed nothing.
describe('jsonSchemaFor', () => {
  // Plain JSON Schema, not a Zod object wearing one. This is the property the
  // browser actually depends on.
  it('produces a plain object schema for every catalog tool', () => {
    for (const tool of TOOL_CATALOG) {
      const schema = jsonSchemaFor(tool);
      expect([tool.name, schema.type]).toEqual([tool.name, 'object']);
      expect(typeof schema.properties).toBe('object');
    }
  });

  // The property the descriptors are built on: whatever comes back must survive
  // the same algorithm the browser applies on the way out.
  it('produces a schema that survives a structured clone', () => {
    for (const tool of TOOL_CATALOG) {
      expect(() => structuredClone(jsonSchemaFor(tool))).not.toThrow();
    }
  });

  // `io: 'input'` describes what the agent must SEND, which is what a tool's
  // input schema means. The output view would encode defaults as required and
  // demand fields the agent is not supposed to supply.
  it('describes the input side, so defaulted fields stay optional', () => {
    const readMap = jsonSchemaFor(findTool('read_map')!);
    expect(readMap.required ?? []).not.toContain('sinceRevision');
  });

  // Memoized: the catalog is frozen, so re-deriving on every bind is waste, and
  // a stable identity means a re-registration hands the browser the same object
  // rather than a look-alike.
  it('returns the same object on a second call for one tool', () => {
    const tool = findTool('read_map')!;
    expect(jsonSchemaFor(tool)).toBe(jsonSchemaFor(tool));
  });

  // Memoization keyed per tool, not one schema shared by all of them — the bug
  // a single cached value would introduce is every tool advertising read_map's
  // arguments.
  it('gives different tools their own schemas', () => {
    expect(jsonSchemaFor(findTool('read_map')!)).not.toBe(
      jsonSchemaFor(findTool('add_nodes')!),
    );
  });
});

// `structuredClone` is not a proxy for this check — it IS the check, the same
// algorithm the browser runs. What these pin is that it turns an opaque
// DataCloneError thrown from inside Chrome into something printable.
describe('serializationProblem', () => {
  const execute = () => async () => ({
    content: [{ type: 'text' as const, text: '' }],
  });
  const descriptor = () => buildToolDescriptors(execute)[0];

  // The ordinary case: a well-formed descriptor has nothing to report, and
  // reporting a problem here would make every binding look broken.
  it('reports null for a well-formed descriptor', () => {
    expect(serializationProblem(descriptor())).toBeNull();
  });

  // The original bug, caught by name. A function anywhere in the schema is
  // exactly what a Zod object smuggles across.
  it('reports the clone failure when the schema carries a function', () => {
    const problem = serializationProblem({
      ...descriptor(),
      inputSchema: { parse: () => {} } as unknown as Record<string, unknown>,
    });
    expect(problem).not.toBeNull();
    expect(problem).toMatch(/clone/i);
  });

  // A descriptor the browser would accept and an agent could not use. It clones
  // fine, so only an explicit check catches it.
  it('reports a missing description, which clones fine but is useless', () => {
    expect(serializationProblem({ ...descriptor(), description: '' })).toBe(
      'no description',
    );
  });

  // WebMCP input schemas are object schemas. A bare string schema would be
  // registered and then reject every call the agent made.
  it('reports an input schema that is not an object schema', () => {
    expect(
      serializationProblem({ ...descriptor(), inputSchema: { type: 'string' } }),
    ).toMatch(/not object/);
  });

  // And the degenerate version of the same, where there is no schema to inspect
  // rather than a wrong one.
  it('reports an input schema that is not an object at all', () => {
    expect(
      serializationProblem({
        ...descriptor(),
        inputSchema: null as unknown as Record<string, unknown>,
      }),
    ).toBe('input schema is not an object');
  });
});

describe('errorResponse', () => {
  // Reserved for genuine faults: a conflict or a timeout is a normal result,
  // and flagging those as errors would invite the blind retry the conflict
  // path exists to prevent.
  it('marks the response as an error carrying the message', () => {
    const response = errorResponse('something broke');
    expect(response.isError).toBe(true);
    expect(textOf(response)).toBe('something broke');
  });
});

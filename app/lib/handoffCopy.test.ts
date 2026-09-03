import { describe, expect, it } from 'vitest';
import { attachedStartCopy, handoffCopy } from './handoffCopy';

// The same honest-copy rule askPresence pins, one surface over: a map nobody is
// attached to must say so, and must not imply work is underway. The failure
// mode is a person watching an empty map believing something is coming.

const MAP_ID = 'cmtixt5tg000wymek3vbmllaj';

describe('handoffCopy', () => {
  // Without the id the prompt is useless — an agent handed it has no way to
  // know which of the person's maps they meant.
  it('names the map id in the start prompt', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.startPrompt).toContain(MAP_ID);
  });

  // An ordinary map started from a sentence: the map is the thing to read.
  it('points at read_map for a map started from a sentence', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.startPrompt).toContain('read_map');
    expect(copy.startPrompt).not.toContain('read_brief');
  });

  // A brief-only map has little or nothing in the seed idea, so read_map would
  // show the agent the emptier of the two things it could read.
  it('points at read_brief when the map was started from a brief', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: true });
    expect(copy.startPrompt).toContain('read_brief');
    expect(copy.startPrompt).not.toContain('read_map');
  });

  // The person's own words carry the context an agent needs, so a sentence-map
  // prompt should hand them over rather than making the agent go and look.
  it('quotes the seed idea in the prompt when there is one', () => {
    const copy = handoffCopy({
      mapId: MAP_ID,
      seedIdea: 'A weekend app for splitting chores fairly',
      hasBrief: false,
    });
    expect(copy.startPrompt).toContain('A weekend app for splitting chores fairly');
  });

  // A brief-only map has no sentence. Interpolating an empty one would leave
  // stray quote marks around nothing, which reads as lost text.
  it('leaves no empty quotes in the prompt when there is no seed idea', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: '   ', hasBrief: false });
    expect(copy.startPrompt).not.toMatch(/""|“”/);
  });

  // The load-bearing claim of the whole panel. Nothing is attached, so nothing
  // may be described as in progress or on its way.
  it('never claims work is underway or an agent is coming', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    const all = `${copy.eyebrow} ${copy.explanation}`;
    expect(all).not.toMatch(/working on it now|in progress|on its way|will start|shortly/i);
  });

  // Saying the idea is saved is the reassurance that replaces the false one —
  // the person's first worry on an empty map is that their input was lost.
  it('says the idea is saved', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.explanation).toMatch(/saved/i);
  });

  // The panel is only useful if it names a way out, and the tool is what makes
  // the next idea automatic rather than another copy-paste. It moved from the
  // flat `attachHint` into the `agent` tab when the doors became tabs — the
  // fact still has to be SOMEWHERE a reader will meet it, which is what this
  // asserts across the whole copy rather than at one field.
  it('names await_new_map as the way to stop copying prompts by hand', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    const prose = [copy.attachHint, ...copy.attachTabs.map((t) => t.body)].join(' ');
    expect(prose).toContain('await_new_map');
  });

  // The sentence the panel never said. Someone who has just pressed return
  // needs to be told the prompt goes into an agent's chat window — knowing
  // that is not obvious to anyone who does not already know the answer, and it
  // is the one instruction that turns a quoted block into a next step.
  it('tells the person to paste the prompt into an agent chat window', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    const steps = copy.steps.join(' ');
    expect(steps).toMatch(/paste/i);
    expect(steps).toMatch(/agent/i);
    expect(steps).toMatch(/chat/i);
  });

  // Copying is the first move and pasting the second, so the steps have to be
  // in that order. A set of instructions that reads paste-then-copy is worse
  // than no instructions.
  it('states copying before pasting', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.steps).toHaveLength(2);
    expect(copy.steps[0]).toMatch(/copy/i);
    expect(copy.steps[1]).toMatch(/paste/i);
  });

  // The headline is the panel's first line at heading weight. It has to name
  // the action — a label that only restates the eyebrow would put the panel
  // back to explaining itself before it says what to do.
  it('leads with an instruction naming the agent handoff', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.instruction).toMatch(/agent/i);
    expect(copy.instruction).not.toBe(copy.eyebrow);
  });

  // Both cases render the same instruction block, so a brief-only map must not
  // arrive with the steps missing.
  it('gives the same instruction and steps for a brief-only map', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: true });
    expect(copy.instruction.length).toBeGreaterThan(0);
    expect(copy.steps).toHaveLength(2);
  });

  // An agent reading this page needs a command it can RUN. The prose hint names
  // the door; this is the door, and it has to name the origin the page is
  // actually being served from or it points at the wrong machine.
  it('builds an MCP command naming the given origin', () => {
    const copy = handoffCopy({
      mapId: MAP_ID,
      hasBrief: false,
      origin: 'https://maps.example.com',
    });
    expect(copy.mcpCommand).toContain('https://maps.example.com/api/mcp');
  });

  // The server render has no origin yet. `npm run mcp` is correct only for
  // someone in this checkout, but it is the one of the two that cannot be
  // WRONG — a guessed origin would send an agent somewhere that is not this app.
  it('falls back to npm run mcp when no origin is known', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false });
    expect(copy.mcpCommand).toBe('npm run mcp');
  });

  // The three routes, in the order a reader meets them. Pinned as a list
  // because the panel's whole shape depends on there being exactly three
  // alternatives — a fourth appended without thought, or one quietly dropped,
  // changes what the tab strip is claiming about the ways in.
  it('offers exactly the browser, any-agent and Claude Code routes', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false });
    expect(copy.attachTabs.map((t) => t.id)).toEqual(['browser', 'agent', 'claude']);
  });

  // The endpoint an agent that is NOT Claude Code needs. This is the fact the
  // panel previously never stated: a reader holding ChatGPT desktop or Cursor
  // cannot run `claude mcp add`, and the raw address is their half of it.
  it('hands any agent the bare endpoint for the given origin', () => {
    const copy = handoffCopy({
      mapId: MAP_ID,
      hasBrief: false,
      origin: 'https://maps.example.com',
    });
    const agent = copy.attachTabs.find((t) => t.id === 'agent');
    expect(agent?.copy?.text).toBe('https://maps.example.com/api/mcp');
  });

  // On the server render the browser's own address is not knowable, so the
  // endpoint degrades to the relative path — still true, still the right
  // address, and it simply assumes the reader knows what host they are on.
  it('degrades the endpoint to a relative path with no origin', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false });
    const agent = copy.attachTabs.find((t) => t.id === 'agent');
    expect(agent?.copy?.text).toBe('/api/mcp');
  });

  // The claim the browser tab makes about itself. A tab whose entire point is
  // "this route needs nothing pasted anywhere" would contradict itself the
  // moment it carried something to copy, and an absent field is what a renderer
  // reads to draw no box at all.
  it('gives the browser route nothing to copy', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false, origin: 'https://x.example' });
    const browser = copy.attachTabs.find((t) => t.id === 'browser');
    expect(browser?.copy).toBeUndefined();
    // And it must not overpromise: WebMCP is the requirement, not a nicety.
    expect(browser?.body).toMatch(/WebMCP/);
  });

  // The Claude Code tab is a SHORTCUT for the endpoint beside it, so the two
  // must point at the same place. Spelled as a containment check because one
  // is a bare address and the other wraps it in a command.
  it('points the Claude Code shortcut at the same endpoint as the any-agent tab', () => {
    const copy = handoffCopy({
      mapId: MAP_ID,
      hasBrief: false,
      origin: 'https://maps.example.com',
    });
    const url = copy.attachTabs.find((t) => t.id === 'agent')?.copy?.text ?? '';
    const command = copy.attachTabs.find((t) => t.id === 'claude')?.copy?.text ?? '';
    expect(url).toBeTruthy();
    expect(command).toContain(url);
    // And the flat field the reattach strip reads is that same command, so the
    // two surfaces cannot drift apart.
    expect(copy.mcpCommand).toBe(command);
  });

  // The reason the `worked` flag exists. "No one is on this yet" is simply
  // false on a map carrying an agent's work, and a person who reads a false
  // sentence about their own map stops trusting the true ones beside it.
  it('does not claim nobody is on a map an agent has already worked', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false, worked: true });
    expect(copy.eyebrow).not.toMatch(/No one is on this yet/i);
    expect(copy.instruction).not.toMatch(/No one is on this yet/i);
  });

  // The full band's wording is unchanged for a map nothing has touched — the
  // demoted variant must not leak into the first-meeting case.
  it('keeps the original wording for an untouched map', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false });
    expect(copy.eyebrow).toBe('No one is on this yet');
    expect(copy.instruction).toBe('Hand this to your agent');
  });

  // The prompt is the useful half in BOTH states, so demoting the band must not
  // have quietly dropped the id an agent needs to find the map.
  it('still names the map in the worked variant’s prompt', () => {
    const copy = handoffCopy({ mapId: MAP_ID, hasBrief: false, worked: true });
    expect(copy.startPrompt).toContain(MAP_ID);
  });

  // A returning agent needs a cursor that includes the person's unread work,
  // otherwise it starts again from an earlier state and misses their answers.
  it('puts the known revision in a worked map resume prompt', () => {
    const copy = handoffCopy({
      mapId: MAP_ID,
      hasBrief: false,
      worked: true,
      resumeRevision: 29,
    });
    expect(copy.startPrompt).toContain('Resume from revision 29');
    expect(copy.startPrompt).toContain('answers may already be waiting');
  });

  // Both entry points start an agent turn, so both must explicitly tell it to
  // wait after writing questions rather than treating the first turn as done.
  it('tells the agent to keep waiting after it writes questions', () => {
    for (const hasBrief of [true, false]) {
      expect(handoffCopy({ mapId: MAP_ID, hasBrief }).startPrompt).toContain(
        'await_user_activity',
      );
      expect(attachedStartCopy({ hasBrief }).prompt).toContain(
        'await_user_activity',
      );
    }
  });

  // Every field renders directly; an empty one would be a blank row in the card.
  // `steps` is an array, so check the strings inside it rather than only its
  // length — two empty steps would pass a length check and render two blank
  // list items.
  it('returns non-empty copy for every field in both cases', () => {
    for (const hasBrief of [true, false]) {
      const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief });
      for (const value of Object.values(copy)) {
        expect(value.length).toBeGreaterThan(0);
      }
      for (const step of copy.steps) {
        expect(step.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// The copy for the OTHER kind of stuck map: an agent is attached and nothing is
// happening. Every string here exists because a real agent got the earlier
// wording and did the wrong thing with it, so these pin the corrections rather
// than the phrasing for its own sake.
describe('attachedStartCopy', () => {
  // The prompt has to send the thinking to the MAP. "Deconstruct the idea" is
  // something a model satisfies beautifully in its own chat window, and the
  // first real agent given that prompt did exactly that — tidy paragraphs back
  // in the chat, and a board still showing nothing.
  it('names the write tools, not just the read', () => {
    const copy = attachedStartCopy({ hasBrief: false });
    expect(copy.prompt).toContain('create_themes');
    expect(copy.prompt).toContain('add_nodes');
  });

  // The same instruction said in plain words, because an agent that follows
  // tool names but still narrates its answer has not put anything on the map.
  it('tells the agent not to answer in chat', () => {
    for (const hasBrief of [true, false]) {
      expect(attachedStartCopy({ hasBrief }).prompt).toMatch(
        /the map is the output/i,
      );
    }
  });

  // A map that arrived with a document should be read from the document. The
  // read tool is the one thing that differs between the two entry points.
  it('reads the brief when there is one and the map when there is not', () => {
    expect(attachedStartCopy({ hasBrief: true }).prompt).toContain(
      'read_brief',
    );
    expect(attachedStartCopy({ hasBrief: false }).prompt).toContain('read_map');
  });

  // Deliberately shorter than `handoffCopy`'s prompt and carrying no id: the
  // tools are already bound to THIS map, so an id would be a fact the agent has
  // to ignore rather than one it needs.
  it('carries no map id, unlike the unattached hand-off prompt', () => {
    const attached = attachedStartCopy({ hasBrief: false });
    const unattached = handoffCopy({ mapId: MAP_ID, hasBrief: false });
    expect(attached.prompt).not.toContain(MAP_ID);
    expect(unattached.startPrompt).toContain(MAP_ID);
  });

  // The one sentence that stops an attached-but-idle map reading as a broken
  // app. Without it the person sees "Agent attached" and nothing happening, and
  // has no way to learn that a page cannot start an agent's turn.
  it('explains why an attached agent is still not working', () => {
    const copy = attachedStartCopy({ hasBrief: false });
    expect(copy.note).toMatch(/cannot start an agent/i);
    expect(copy.note.trim().length).toBeGreaterThan(0);
  });

  // Every slot the component renders must be filled in both branches — an empty
  // eyebrow or instruction would render as a blank row above the prompt.
  it('fills every slot for both entry points', () => {
    for (const hasBrief of [true, false]) {
      const copy = attachedStartCopy({ hasBrief });
      for (const value of [
        copy.eyebrow,
        copy.instruction,
        copy.note,
        copy.prompt,
      ]) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

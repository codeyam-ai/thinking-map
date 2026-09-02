import { describe, expect, it } from 'vitest';
import { handoffCopy } from './handoffCopy';

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
  // the next idea automatic rather than another copy-paste.
  it('names await_new_map as the way to stop copying prompts by hand', () => {
    const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief: false });
    expect(copy.attachHint).toContain('await_new_map');
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

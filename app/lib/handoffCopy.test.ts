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

  // Every field renders directly; an empty one would be a blank row in the card.
  it('returns non-empty copy for every field in both cases', () => {
    for (const hasBrief of [true, false]) {
      const copy = handoffCopy({ mapId: MAP_ID, seedIdea: 'A chore app', hasBrief });
      for (const value of Object.values(copy)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});

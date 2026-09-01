import { describe, expect, it } from 'vitest';
import { formatMapDetail, formatMapList, formatNewMaps } from './mcpFormat';

const row = (id: string, title: string, phase: string, nodes = 0, messages = 0) => ({
  id,
  title,
  phase,
  _count: { nodes, messages },
});

// What an MCP client actually reads. The ids matter more than the prose: they
// are what the client passes back to every other tool.
describe('formatMapList', () => {
  // A client asking for maps on a fresh install needs a sentence, not a blank
  // response it might read as a failure.
  it('says so plainly when there are no maps', () => {
    expect(formatMapList([])).toBe('No thinking maps yet.');
  });

  // Without the id the client cannot open or modify the map it just listed.
  it('leads each row with the id in brackets', () => {
    expect(formatMapList([row('m1', 'An idea', 'explore')])).toContain('[m1]');
  });

  // Phase and counts are how a client picks which map is worth opening.
  it('reports the phase and the node and message counts', () => {
    const out = formatMapList([row('m1', 'An idea', 'research', 7, 4)]);
    expect(out).toContain('phase research');
    expect(out).toContain('7 nodes');
    expect(out).toContain('4 messages');
  });

  // One map per line keeps the response parseable by a client or a person.
  it('puts each map on its own line', () => {
    const out = formatMapList([row('m1', 'A', 'idea'), row('m2', 'B', 'map')]);
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('formatMapDetail', () => {
  const detail = {
    title: 'Educational game',
    phase: 'research',
    seedIdea: 'I want to build an educational game for kids.',
    messages: [{ role: 'user', content: 'An idea' }],
    nodes: [
      {
        id: 'n1',
        parentId: null,
        kind: 'idea',
        label: 'Educational game',
        status: 'answered',
      },
    ],
  };

  // The seed idea is preserved verbatim through the whole product; the MCP
  // view must not be where it gets paraphrased away.
  it('includes the title, phase and verbatim seed idea', () => {
    const out = formatMapDetail(detail);
    expect(out).toContain('# Educational game');
    expect(out).toContain('phase: research');
    expect(out).toContain('I want to build an educational game for kids.');
  });

  // A client needs both views to reason about the map the way the UI does.
  it('renders the conversation and the node tree under their own headings', () => {
    const out = formatMapDetail(detail);
    expect(out).toContain('## Conversation');
    expect(out).toContain('user: An idea');
    expect(out).toContain('## Map');
    expect(out).toContain('[n1]');
  });

  // A map created through MCP has no conversation yet; an empty section would
  // read as a truncated response.
  it('marks an empty conversation explicitly', () => {
    const out = formatMapDetail({ ...detail, messages: [] });
    expect(out).toContain('(none)');
  });

  // A map whose nodes have all been removed still has to render.
  it('renders a map with no nodes', () => {
    const out = formatMapDetail({ ...detail, nodes: [] });
    expect(out).toContain('(empty — nothing on the map yet)');
  });
});

// What an agent parked on await_new_map actually reads. It arrives with no
// context about the map at all, so every row has to carry the id, the idea and
// the next call — and an expiry has to read as normal rather than as failure.
describe('formatNewMaps', () => {
  const CURSOR = '2026-09-01T17:23:26.907Z';
  const newMap = (over = {}) => ({
    id: 'map-one',
    title: 'A chore app',
    seedIdea: 'A weekend app for splitting chores fairly',
    hasBrief: false,
    ...over,
  });

  // The id is what every follow-up tool call takes; a row without it is a dead
  // end, exactly as in formatMapList.
  it('leads each row with the map id', () => {
    expect(formatNewMaps([newMap()], CURSOR)).toContain('map-one');
  });

  // The agent has to be told what to do next, not left to infer it.
  it('spells out read_map as the next call for a sentence-started map', () => {
    const out = formatNewMaps([newMap()], CURSOR);
    expect(out).toContain('read_map with mapId "map-one"');
  });

  // A brief-started map's seed idea is empty or near-empty, so the brief is the
  // thing worth reading first.
  it('spells out read_brief as the next call for a brief-started map', () => {
    const out = formatNewMaps([newMap({ hasBrief: true, seedIdea: '' })], CURSOR);
    expect(out).toContain('read_brief with mapId "map-one"');
    expect(out).not.toContain('read_map');
  });

  // A blank line where the idea should be reads as missing data rather than as
  // a map that genuinely started from a document.
  it('says so explicitly when a map has no seed idea', () => {
    const out = formatNewMaps([newMap({ hasBrief: true, seedIdea: '   ' })], CURSOR);
    expect(out).toContain('started from a brief');
  });

  // One wait can hand back several maps, and the count must agree with itself.
  it('renders every map when several arrive at once', () => {
    const out = formatNewMaps(
      [newMap(), newMap({ id: 'map-two', title: 'Another' })],
      CURSOR,
    );
    expect(out).toContain('2 new maps');
    expect(out).toContain('map-one');
    expect(out).toContain('map-two');
  });

  // '1 new maps' is exactly the kind of thing that survives review and then
  // reads as broken.
  it('keeps the count singular for a single map', () => {
    expect(formatNewMaps([newMap()], CURSOR)).toContain('1 new map:');
  });

  // Without the cursor the agent cannot re-park exactly, and would either miss
  // a map or re-read one it already handled.
  it('hands back the cursor to resume from', () => {
    expect(formatNewMaps([newMap()], CURSOR)).toContain(CURSOR);
  });

  // The expiry case. An agent looping on this sees it constantly, so it must
  // read as an ordinary answer and still carry the cursor.
  it('reports an empty result as normal rather than as a failure', () => {
    const out = formatNewMaps([], CURSOR);
    expect(out).toContain('No new maps yet');
    expect(out).toContain(CURSOR);
    expect(out).not.toMatch(/error|failed|unable/i);
  });
});

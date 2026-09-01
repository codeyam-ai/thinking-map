import { describe, expect, it } from 'vitest';
import { formatMapDetail, formatMapList } from './mcpFormat';

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

import { describe, expect, it } from 'vitest';
import {
  formatAttachmentLines,
  formatInsightStanding,
  formatMapDetail,
  formatMapList,
  formatNewMaps,
  standingAskSentence,
} from './mcpFormat';
import {
  INSIGHT_STREAM_KINDS,
  TARGET_LIVE_INSIGHTS,
  type InsightStream,
} from './insightStream';

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
        detail: null,
        themeId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
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

// The standing ask is the whole mechanism behind "the partner keeps supplying
// insights". The page cannot summon an agent, so the only place the ask can
// live is inside what the agent already reads on every turn — which makes this
// prose load-bearing rather than decorative.
describe('formatInsightStanding', () => {
  const stream = (over: Partial<InsightStream> = {}): InsightStream => ({
    insights: [],
    live: 0,
    stale: 0,
    answersSinceNewest: 0,
    ...over,
  });
  const anInsight = { id: 'i1' } as InsightStream['insights'][number];

  // A number the agent can compare itself against is actionable in a way that
  // "consider adding insights" is not. That is the design decision, and losing
  // the figures would quietly turn the mechanism back into a mood.
  it('states the budget as figures the agent can measure itself against', () => {
    const out = formatInsightStanding(
      stream({ insights: [anInsight], live: 1, stale: 2 }),
    );
    expect(out).toContain('## Insights');
    expect(out).toContain('live: 1');
    expect(out).toContain('stale: 2');
    expect(out).toContain(`target: ${TARGET_LIVE_INSIGHTS}`);
  });

  // How far behind the board is. The whole point of measuring it from the
  // newest insight is that the agent is told a gap rather than left to feel one.
  it('names how many answers have landed since the newest insight', () => {
    expect(
      formatInsightStanding(stream({ insights: [anInsight], answersSinceNewest: 4 })),
    ).toContain('4 answers have landed');
    expect(
      formatInsightStanding(stream({ insights: [anInsight], answersSinceNewest: 1 })),
    ).toContain('1 answer has landed');
    expect(
      formatInsightStanding(stream({ insights: [anInsight], answersSinceNewest: 0 })),
    ).toContain('Nothing has been answered');
  });

  // Day one, and the state every fresh map produces. A map that has done
  // nothing wrong must not be told it is short — it should be told what an
  // insight IS, which is the more useful thing on turn one.
  it('reads as an invitation rather than a shortfall when there are none', () => {
    const out = formatInsightStanding(stream());
    expect(out).toContain('none yet');
    expect(out).toContain('no themeRef');
    expect(out).not.toContain('live: 0');
  });
});

describe('standingAskSentence', () => {
  // Built from the same constants the code counts with, so a kind added to the
  // stream cannot end up described to the agent by a list that no longer
  // matches the one being measured.
  it('names every kind the stream actually counts', () => {
    const out = standingAskSentence();
    for (const kind of INSIGHT_STREAM_KINDS) expect(out).toContain(kind);
    expect(out).toContain(String(TARGET_LIVE_INSIGHTS));
  });

  // The two instructions that make an insight worth more than an assertion:
  // say where it came from, and make it small enough to act on.
  it('asks for provenance and for something small enough to run', () => {
    const out = standingAskSentence();
    expect(out).toContain('fromRefs');
    expect(out).toContain('small enough to actually run');
  });
});

// What a full map read says about the things brought along with the idea.
//
// The rule being defended is the same one the brief already follows and states:
// read_map carries metadata, never contents. An image is the strongest case for
// it — inlining one would put a megabyte of base64 into a call the agent makes
// every turn — so these assert that the lines describe and point, and never
// carry the file.
describe('formatAttachmentLines', () => {
  const picture = {
    id: 'att-whiteboard',
    name: 'whiteboard-photo.png',
    mediaType: 'image/png',
    byteSize: 1563,
  };

  // Most maps have nothing attached. A bare "Brought along" heading over an
  // empty list would read as something that failed to load, so there is no
  // section at all rather than an empty one.
  it('renders no section at all when nothing is attached', () => {
    expect(formatAttachmentLines([])).toEqual([]);
  });

  // The id is the whole point of the line: without it the agent can see that a
  // picture exists and has no way to open it — a dead end.
  it('names the tool and the id that opens each attachment', () => {
    const lines = formatAttachmentLines([picture]).join('\n');
    expect(lines).toContain('whiteboard-photo.png');
    expect(lines).toContain('read_attachment');
    expect(lines).toContain('att-whiteboard');
  });

  // Saying WHICH kind it is lets the agent decide whether the call is worth
  // making before it spends the context on one.
  it('says what kind of thing each attachment is', () => {
    const image = formatAttachmentLines([picture]).join('\n');
    expect(image).toContain('a picture you can look at');

    const pdf = formatAttachmentLines([
      { ...picture, name: 'scope.pdf', mediaType: 'application/pdf' },
    ]).join('\n');
    expect(pdf).toContain('a PDF');

    const text = formatAttachmentLines([
      { ...picture, name: 'notes.txt', mediaType: 'text/plain' },
    ]).join('\n');
    expect(text).toContain('a text document');
  });

  // A legacy row has nothing to open, so it must NOT offer an id — sending the
  // agent to read_attachment only to be told there is nothing there spends a
  // call to learn what this line already knew.
  it('withholds the id from a row with no file behind it', () => {
    const lines = formatAttachmentLines([
      { ...picture, name: 'shift-handover-notes.pdf', byteSize: 0 },
    ]).join('\n');
    expect(lines).toContain('nothing to look at');
    expect(lines).not.toContain('read_attachment');
  });

  // The load-bearing claim: this is metadata. If a size can be stated without
  // the bytes, the bytes were never fetched — which is what keeps read_map
  // cheap however large the attachments are.
  it('states a size without carrying any file content', () => {
    const lines = formatAttachmentLines([picture]).join('\n');
    expect(lines).toContain('2KB');
    expect(lines.length).toBeLessThan(200);
  });
});

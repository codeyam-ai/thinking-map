import { summarizeMap } from './mapStore';
import {
  INSIGHT_STREAM_KINDS,
  TARGET_LIVE_INSIGHTS,
  insightStream,
  type InsightNode,
  type InsightStream,
} from './insightStream';

export interface MapListRow {
  id: string;
  title: string;
  phase: string;
  _count: { nodes: number; messages: number };
}

export interface MapDetail {
  title: string;
  phase: string;
  seedIdea: string;
  messages: { role: string; content: string }[];
  /** Widened, not re-queried: `getMap` already selects whole node rows, so the
   *  extra fields the standing ask needs were always there and this type was
   *  simply narrower than the data. */
  nodes: (InsightNode & {
    parentId: string | null;
    status: string;
  })[];
  /** Metadata only, never the text. `read_map` is called constantly; the brief
   *  is read deliberately, through its own tool. */
  brief?: { sourceName: string; charCount: number } | null;
}

/**
 * Render the map list for an MCP client.
 *
 * Ids lead every row because they are what the client passes back to
 * get_thinking_map and every mutating tool — a pretty list without them would
 * be a dead end.
 */
export function formatMapList(maps: MapListRow[]): string {
  if (maps.length === 0) return 'No thinking maps yet.';
  return maps
    .map(
      (m) =>
        `[${m.id}] ${m.title} — phase ${m.phase}, ${m._count.nodes} nodes, ${m._count.messages} messages`,
    )
    .join('\n');
}

/** One newly-created map, as `await_new_map` reports it. Structural only — the
 *  waiter's own `NewMapSummary` carries a `Date`, which this never needs. */
export interface NewMapRow {
  id: string;
  title: string;
  seedIdea: string;
  hasBrief: boolean;
}

/**
 * Render what `await_new_map` handed back.
 *
 * Every row spells out the NEXT call rather than leaving the agent to infer it,
 * because the whole point of parking is that the agent arrives with no context
 * about the map at all. `hasBrief` decides between `read_brief` and `read_map`:
 * a map started from a document has an empty or near-empty seed idea, so
 * sending the agent to `read_map` first would show it the emptier of the two.
 *
 * A timeout is rendered by its own branch rather than as an empty list — "no
 * new maps yet" plus the cursor to resume from is a normal, useful answer, and
 * an agent looping on this must never read it as a failure.
 */
export function formatNewMaps(rows: NewMapRow[], cursor: string): string {
  if (rows.length === 0) {
    return `No new maps yet. Call await_new_map again with since "${cursor}" to keep waiting.`;
  }

  const lines = rows.map((row) => {
    const next = row.hasBrief
      ? `read_brief with mapId "${row.id}"`
      : `read_map with mapId "${row.id}"`;
    // A brief-only map has no sentence to show. Saying so beats a blank line
    // that reads as missing data.
    const idea = row.seedIdea.trim() || '(started from a brief, no sentence)';
    return `• ${row.id} — "${row.title}"\n  Idea: ${idea}\n  Next: ${next}`;
  });

  return `${rows.length} new map${rows.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n\nResume with since "${cursor}".`;
}

/**
 * The instruction half of the standing ask — what the agent is being asked to
 * do, as opposed to what the board currently holds.
 *
 * Separate from the counts because the two change for different reasons and at
 * different rates: the numbers move every turn, this sentence moves when the
 * product decides what an insight is for. It is built from
 * `INSIGHT_STREAM_KINDS` and `TARGET_LIVE_INSIGHTS` rather than typed out, so
 * a kind added to the stream cannot end up described to the agent by a list
 * that no longer matches the one the code counts.
 */
export function standingAskSentence(): string {
  const kinds = [...INSIGHT_STREAM_KINDS].join(', ');
  return (
    `Standing ask: keep at least ${TARGET_LIVE_INSIGHTS} live insights on the board — themeless ` +
    `nodes of kind ${kinds}. Each should name what it came out of (fromRefs), and ` +
    `where you can, an experiment small enough to actually run.`
  );
}

/**
 * The standing ask: what the board is carrying, and what is owed.
 *
 * This is the whole mechanism behind "the partner keeps supplying insights".
 * The page cannot summon an agent — that is the product's founding constraint —
 * so the only place the ask can live is inside what the agent already reads on
 * every turn. It states a BUDGET rather than a mood, because a number an agent
 * can compare itself against is actionable in a way that "consider adding
 * insights" is not.
 *
 * The empty case reads as an invitation rather than as a fault. A map on its
 * first turn has no insights and has done nothing wrong; telling it what an
 * insight is and what the target is, is more use than reporting a shortfall.
 */
export function formatInsightStanding(stream: InsightStream): string {
  const ask = standingAskSentence();

  if (stream.insights.length === 0) {
    return [
      '## Insights',
      `none yet · target: ${TARGET_LIVE_INSIGHTS}`,
      'An insight is a claim about the whole idea rather than a card inside one',
      'theme — so it is written with no themeRef.',
      ask,
    ].join('\n');
  }

  const since =
    stream.answersSinceNewest === 0
      ? 'Nothing has been answered since the newest insight.'
      : `${stream.answersSinceNewest} answer${stream.answersSinceNewest === 1 ? ' has' : 's have'} landed since the newest insight.`;

  return [
    '## Insights',
    `live: ${stream.live} · stale: ${stream.stale} · target: ${TARGET_LIVE_INSIGHTS}`,
    since,
    ask,
  ].join('\n');
}

/**
 * Render one map in full for an MCP client: the seed idea kept verbatim, the
 * conversation, and the node tree. The two views are shown together because
 * they are two renderings of the same thinking.
 */
export function formatMapDetail(map: MapDetail): string {
  const conversation = map.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  // One line, not the document. A brief can be forty thousand characters and
  // this rendering is read on every full read_map — so the map says the brief
  // is THERE and names the tool that opens it, and stops.
  const brief = map.brief
    ? [
        `brief: ${map.brief.sourceName} — ${map.brief.charCount} characters. Read it with read_brief (outline first).`,
      ]
    : [];

  return [
    `# ${map.title}`,
    `phase: ${map.phase}`,
    `seed idea: ${map.seedIdea || '(none — this map started from the brief)'}`,
    ...brief,
    '',
    '## Conversation',
    conversation || '(none)',
    '',
    '## Map',
    summarizeMap(map.nodes),
    '',
    formatInsightStanding(insightStream(map.nodes)),
  ].join('\n');
}

import { summarizeMap } from './mapStore';
// The number the agent is TOLD to pass has to be the number the runtime would
// have used anyway. Typing it here as a literal is how it came to say 300 while
// the constant meant something else entirely.
import { DEFAULT_TIMEOUT_SECONDS } from './toolCatalog';
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
  /** The same rule, and an even stronger case for it: inlining an image here
   *  would put a megabyte of base64 into every turn. The list says what is
   *  there and hands over the ids; `read_attachment` is what opens one. */
  attachments?: {
    id: string;
    name: string;
    mediaType: string;
    byteSize: number;
  }[];
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

/** What an attachment IS, in the one word that decides whether an agent should
 *  spend a call opening it. The media type itself is in the structured result
 *  for anything that needs the exact string. */
function describeKind(mediaType: string): string {
  if (mediaType.startsWith('image/')) return 'a picture you can look at';
  if (mediaType === 'application/pdf') return 'a PDF';
  return 'a text document';
}

/**
 * The "Brought along" section of a full map read: one line per attachment,
 * never the attachment itself.
 *
 * The brief's rule above, applied where it matters most. `read_map` is called
 * constantly, and a picture inlined here would put a megabyte of base64 into
 * every turn — which is exactly why `read_attachment` is a separate tool rather
 * than a field on this one.
 *
 * Every line carries the id, because a list an agent cannot act on is a dead
 * end in the same way `formatMapList` avoids. A row with no bytes says so
 * instead of offering an id that would only lead to "there is nothing to look
 * at" — the answer belongs where the agent is deciding, not one call later.
 *
 * Returns an empty list, not an empty heading, for a map with nothing attached:
 * most maps, and a bare heading would read as something failing to load.
 */
export function formatAttachmentLines(
  attachments: {
    id: string;
    name: string;
    mediaType: string;
    byteSize: number;
  }[],
): string[] {
  if (attachments.length === 0) return [];

  return [
    '',
    '## Brought along',
    ...attachments.map((a) => {
      const openable =
        a.byteSize > 0
          ? `${describeKind(a.mediaType)}, ${Math.max(1, Math.round(a.byteSize / 1024))}KB — read_attachment with id "${a.id}"`
          : 'recorded before this board could hold files — there is nothing to look at';
      return `• ${a.name} — ${openable}`;
    }),
  ];
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
 * The same steering channel as the standing insight ask, applied to questions
 * that need a person's answer. A page cannot wake an agent, so a write that
 * leaves questions open must explicitly send the agent into the wait loop.
 *
 * Two clauses here are load-bearing and were each added after watching the loop
 * fail in a real session:
 *
 * The chat line, because THIS TEXT IS NOT ADDRESSED TO THE PERSON. It is a tool
 * reply, read only by the agent, and an agent that writes questions and parks
 * silently leaves someone looking at a map with no idea that anything is owed
 * from them or where to put it. The agent's chat window is the only channel
 * that reaches them, so the reply has to spend a sentence sending it there.
 *
 * The short timeout, because the agent's host aborts a long tool call — see
 * `DEFAULT_TIMEOUT_SECONDS`. Naming 300 here, as this used to, was enough to
 * break the loop on its own: the wait was killed in transit, and the agent
 * reported a timeout rather than looping. The instruction has to make a bounded
 * return sound like the normal thing it is, or an agent reads `timedOut` as a
 * failure and stops.
 */
export function formatStandingWait(
  nodes: readonly { kind: string; status: string }[],
  revision: number,
): string {
  const open = nodes.filter(
    (node) => node.kind === 'open-question' && node.status !== 'answered',
  ).length;
  if (open === 0) return '';

  return [
    `## Waiting for answers`,
    `${open} question${open === 1 ? '' : 's'} on this map ${open === 1 ? 'is' : 'are'} still open.`,
    'First, in your chat: say in a sentence or two what you just put on the map, and ask them to answer the open questions on the map itself rather than in chat. They cannot see this reply — your chat window is the only place you can reach them.',
    `Then call await_user_activity with sinceRevision: ${revision} and timeoutSeconds: ${DEFAULT_TIMEOUT_SECONDS}.`,
    'Keep every wait that short and repeat it: your host cuts off a long tool call before an answer can reach you, so timedOut true is the normal return rather than a failure. Call it again immediately with the cursor it hands back. It returns as soon as one answer lands; handle that answer, say in chat what it changed, then wait again while questions remain open rather than ending your turn.',
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

  const attachments = formatAttachmentLines(map.attachments ?? []);

  return [
    `# ${map.title}`,
    `phase: ${map.phase}`,
    `seed idea: ${map.seedIdea || '(none — this map started from the brief)'}`,
    ...brief,
    ...attachments,
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

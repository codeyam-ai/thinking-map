// What counts as a live insight, and how far behind the board is.
//
// The product's founding constraint is that the page cannot summon an agent. So
// "the partner keeps supplying insights" cannot be a scheduler — it can only be
// a standing ask in what the agent already reads on every turn. That ask has to
// state a NUMBER the agent can compare itself against, and this module is where
// that number is computed.
//
// The rule it holds is one line long and easy to get wrong in two different
// places: an insight is a THEMELESS node of an insight kind. A `finding` the
// agent hung inside a theme is a card in that row and stays one; a themeless
// one is a claim about the whole idea. That rule was already here informally —
// `CORE_INSIGHT_KINDS` plus `!n.themeId` in `GalaxyBoard` — and promoting it to
// a module is what stops the board and the agent's read disagreeing about what
// is on the board, which would be the same node drawn twice or counted never.
//
// Pure and dependency-free, in the manner of `mapRounds.ts` and
// `boardConnectors.ts`: the rules are the interesting part, so they are pinned
// by tests rather than inferred from a screenshot. Deliberately no Prisma
// import — this is read by the server door rendering `read_map` AND by the
// browser, and a module either side can hold is what keeps the two honest.

import type { Tradeoffs } from './tradeoffs';

/**
 * The kinds that are a claim about the whole idea rather than a piece of it.
 *
 * Wider than `GalaxyBoard`'s `CORE_INSIGHT_KINDS` on purpose. That set answers
 * "which single node is the convergence point", where being narrow is the
 * point; this answers "what has the partner actually offered", where a `risk`
 * or a `gap` the person never asked for is exactly as much an offering as a
 * `direction` is.
 */
export const INSIGHT_STREAM_KINDS: ReadonlySet<string> = new Set([
  'assumption',
  'finding',
  'gap',
  'risk',
  'direction',
  'approach',
  'suggestion',
  'experiment',
]);

/**
 * How many live insights the board should be carrying.
 *
 * Exported from here rather than written into the prose that reports it, so the
 * standing ask and any surface that wants to say "one short" cannot drift to
 * two different targets. Three is a judgement, not a measurement: it is enough
 * that the far end of the board is never empty, and few enough that the agent
 * is not filling it with restatements.
 */
export const TARGET_LIVE_INSIGHTS = 3;

/** The fields of a node this module needs. Structural rather than the Prisma
 *  row, so the browser can pass what it has and the server can pass what
 *  `getMap` returned without either converting. */
export interface InsightNode {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  themeId: string | null;
  status?: string | null;
  /** The JSON array of node ids the column stores, already parsed, or the raw
   *  string as it comes off the row. Both are accepted because the server has
   *  the string and the client usually has the array. */
  fromNodeIds?: string[] | string | null;
  /** What this would take and what taking it would cost, on the kinds that are
   *  things you could DO — an experiment, a suggestion, an approach.
   *
   *  The parsed object OR the raw JSON string the column holds, accepted both
   *  ways for exactly the reason `fromNodeIds` above is: the server has the
   *  string straight off the row and the client usually has the object. The
   *  one place that reads it — `BoardTradeoffs` — is total over both. */
  tradeoffs?: Tradeoffs | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Insight extends InsightNode {
  /** Answers that landed after this was written. Zero means nothing has
   *  happened since; anything else means the insight predates what the person
   *  has said, which is what "stale" is. */
  answersSince: number;
  stale: boolean;
  /** The questions this came out of, resolved. Dangling ids are dropped — the
   *  node may since have been deleted, exactly as a dangling `testsNodeId`
   *  is tolerated rather than rendered as a blank. */
  from: { id: string; label: string }[];
}

export interface InsightStream {
  /** Newest first, which is the order the ask reports and the board reads. */
  insights: Insight[];
  live: number;
  stale: number;
  /** Answers landed since the NEWEST insight — the number the standing ask
   *  reports. Zero on a map with no insights at all, because "nothing has
   *  happened since the newest insight" is the honest reading of a map that
   *  has no newest insight to be behind. */
  answersSinceNewest: number;
}

/** Milliseconds, for a value that may arrive as a Date or as the ISO string a
 *  JSON round-trip leaves behind. An unparseable value sorts as epoch rather
 *  than as NaN, which would make every comparison against it false and
 *  silently drop the node out of every count. */
function millis(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * The ids an insight cites, however they arrived.
 *
 * Malformed input yields `[]` rather than throwing: this is read on every
 * `read_map`, and one bad row written by an older agent must not be able to
 * take down the map's entire rendering.
 */
function citedIds(raw: InsightNode['fromNodeIds']): string[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
}

/**
 * When each of the person's answers landed.
 *
 * `updatedAt` rather than `createdAt`, and that is the whole rule: a question
 * is CREATED open and UPDATED when it is answered, so its creation time says
 * when it was ASKED. Reading `createdAt` here would date every answer to the
 * moment the agent posed the question, which on a map where a batch of
 * questions is asked at once and answered over an hour makes every insight look
 * current no matter how far the thinking has moved past it.
 */
export function answeredAt(nodes: InsightNode[]): number[] {
  return nodes
    .filter(
      (node) => node.kind === 'open-question' && node.status === 'answered',
    )
    .map((node) => millis(node.updatedAt));
}

/**
 * The cited nodes an insight can actually point at.
 *
 * Dangling ids are DROPPED rather than throwing or rendering as a blank, which
 * is the same tolerance `testsNodeId` is documented to have: the node an
 * insight named may since have been deleted, and an insight that stops reading
 * because one of its sources is gone would be a worse outcome than one that
 * cites fewer sources than it once did.
 */
export function resolveCitations(
  ids: string[],
  byId: Map<string, InsightNode>,
): { id: string; label: string }[] {
  return ids
    .map((id) => byId.get(id))
    .filter((cited): cited is InsightNode => cited !== undefined)
    .map((cited) => ({ id: cited.id, label: cited.label }));
}

/**
 * The board's insights, and how far behind the thinking they are.
 *
 * Staleness is read off timestamps rather than off the exchange log, and that
 * is the decision that lets this module be pure. `MapNode.updatedAt` moves when
 * an answer lands, so the whole picture is computable from the nodes alone —
 * which is what lets one function serve both the server-side `read_map` and the
 * client-side board without either of them holding the log. Deriving it from
 * `MapEvent` revisions was the alternative and would have forced a second query
 * into `read_map`'s delta branch on every single turn.
 *
 * Nothing is hidden by being stale. An insight the thinking has moved past is
 * still worth reading, and dropping it would silently shrink the board.
 */
export function insightStream(nodes: InsightNode[]): InsightStream {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const answers = answeredAt(nodes);

  const insights: Insight[] = nodes
    // `!node.themeId` rather than `=== null`, matching the rule as `GalaxyBoard`
    // already states it: a node that arrived over JSON carries `undefined` where
    // the row carried null, and an insight that silently stopped counting for
    // that reason would be the exact drift this module exists to prevent.
    .filter((node) => INSIGHT_STREAM_KINDS.has(node.kind) && !node.themeId)
    .map((node) => {
      const writtenAt = millis(node.createdAt);
      const answersSince = answers.filter((at) => at > writtenAt).length;
      return {
        ...node,
        answersSince,
        stale: answersSince > 0,
        from: resolveCitations(citedIds(node.fromNodeIds), byId),
      };
    })
    // Newest first, ties left in the order they arrived. `getMap` already
    // orders `createdAt asc, order asc` and `Array.sort` is stable, so a batch
    // of insights written in one transaction — which share a timestamp to the
    // millisecond — stays in the order the agent wrote them rather than being
    // shuffled by a tiebreak nobody chose.
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));

  const stale = insights.filter((insight) => insight.stale).length;

  return {
    insights,
    live: insights.length - stale,
    stale,
    answersSinceNewest: insights[0]?.answersSince ?? 0,
  };
}

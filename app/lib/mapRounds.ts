// Which nodes arrived together.
//
// The map is drawn as a column of rows growing downward, and a row is one
// ROUND of thinking — the batch of nodes one write put on the map — not one
// level of the tree.
//
// The distinction is the whole reason this module exists. Grouping by `depth`
// looks equivalent and is not: the ordinary case is an agent asking a second
// batch of questions as further children of the root, and both batches land at
// depth 1. By depth they collapse into a single row and the map stops recording
// that the conversation had two turns.
//
// So the grouping is read off the exchange log instead. `app/lib/exchange.ts`
// is the only place revisions are minted and it bumps once per event inside one
// transaction, so the events of a single write share a contiguous run of
// revisions and one origin. That run is a round.
//
// Pure and dependency-free, in the manner of `collapse.ts` before it: the rules
// here are the interesting part and they are pinned by tests rather than
// inferred from a screenshot.

import type { ExchangeEvent } from './exchange';
import { PHASE_LABELS, normalizePhase } from './mapKinds';
import type { FlatNode } from './mapLayout';

export interface Round {
  /** 1-based, and shown to the person as the card's `2/4` marker — so it
   *  counts rounds the way they read them, not array positions. */
  index: number;
  nodes: FlatNode[];
  /** The phase this round opened, when it opened one. Lets the row name itself
   *  after the phase rather than its number at the moment the thinking moved
   *  on. Null for every other round, which is most of them. */
  phase: string | null;
}

/** The event kinds that put a node on the map. `user.node` is the person's own
 *  contribution and belongs in a round exactly as an agent's does — the map is
 *  co-authored, so both sides' writes are rounds. */
const ADD_KINDS = new Set(['node.added', 'user.node']);

function payloadId(event: ExchangeEvent): string | null {
  const id = (event.payload as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function payloadPhase(event: ExchangeEvent): string | null {
  const phase = (event.payload as { phase?: unknown } | null)?.phase;
  return typeof phase === 'string' && phase.length > 0 ? phase : null;
}

/**
 * How deep a node sits in the tree, following `parentId` upward.
 *
 * Only used by the fallback below. A cycle or a parent that is not in the set
 * stops the walk rather than hanging — a half-written map should still group.
 */
function depthOf(node: FlatNode, byId: Map<string, FlatNode>): number {
  let depth = 0;
  let seen = new Set<string>([node.id]);
  let current = node;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
    depth += 1;
  }
  return depth;
}

interface Run {
  ids: string[];
  /** The revision span this run covers, so a `phase.set` can be attributed to
   *  the round it closed. */
  from: number;
  to: number;
}

/**
 * Cut the log's node-adds into runs: a new run whenever the side that wrote
 * changes, or the revisions stop being contiguous.
 *
 * A non-add event between two adds breaks contiguity, which is exactly right —
 * `ask_user` writes its questions and then a `question.asked`, so a second
 * `add_nodes` after it is genuinely a later turn.
 */
function runsFromLog(events: ExchangeEvent[]): Run[] {
  const ordered = [...events].sort((a, b) => a.revision - b.revision);
  const runs: Run[] = [];
  let previous: { origin: string; revision: number } | null = null;

  for (const event of ordered) {
    if (!ADD_KINDS.has(event.kind)) continue;
    const id = payloadId(event);
    if (!id) continue;

    const contiguous =
      previous !== null &&
      previous.origin === event.origin &&
      previous.revision + 1 === event.revision;

    if (contiguous) runs[runs.length - 1]!.ids.push(id);
    else runs.push({ ids: [id], from: event.revision, to: event.revision });

    runs[runs.length - 1]!.to = event.revision;
    previous = { origin: event.origin, revision: event.revision };
  }

  return runs;
}

/**
 * Group a map's nodes into the rounds that produced them.
 *
 * Nodes the log does not account for — a seeded scenario, a map written before
 * any of this shipped — are not dropped. They fall back to grouping by depth
 * and are appended after the rounds the log did explain, so an old map still
 * renders as rows rather than as nothing.
 *
 * The root idea is always its own first round: it is the map's subject, and a
 * row that mixed it in with the first batch of questions would read as though
 * somebody had asked it.
 */
export function groupIntoRounds(
  nodes: FlatNode[],
  events: ExchangeEvent[],
): Round[] {
  if (nodes.length === 0) return [];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = nodes.find((node) => node.parentId === null) ?? null;
  const placed = new Set<string>();

  const groups: { nodes: FlatNode[]; phase: string | null }[] = [];

  // The root first, always and alone.
  if (root) {
    groups.push({ nodes: [root], phase: null });
    placed.add(root.id);
  }

  const phaseEvents = events
    .filter((event) => event.kind === 'phase.set')
    .map((event) => ({ revision: event.revision, phase: payloadPhase(event) }));

  for (const run of runsFromLog(events)) {
    const runNodes = run.ids
      .filter((id) => !placed.has(id))
      .map((id) => byId.get(id))
      .filter((node): node is FlatNode => node !== undefined);
    if (runNodes.length === 0) continue;
    for (const node of runNodes) placed.add(node.id);

    // A phase set immediately after this run is what this round moved the
    // thinking to. `to + 1` rather than any later revision: a phase set further
    // downstream belongs to whatever round actually preceded it.
    const phase =
      phaseEvents.find((event) => event.revision === run.to + 1)?.phase ?? null;

    groups.push({ nodes: runNodes, phase });
  }

  // Whatever the log never mentioned, by depth — the honest fallback for a map
  // whose history was never recorded.
  const orphans = nodes.filter((node) => !placed.has(node.id));
  if (orphans.length > 0) {
    const byDepth = new Map<number, FlatNode[]>();
    for (const node of orphans) {
      const depth = depthOf(node, byId);
      const bucket = byDepth.get(depth);
      if (bucket) bucket.push(node);
      else byDepth.set(depth, [node]);
    }
    for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
      groups.push({ nodes: byDepth.get(depth)!, phase: null });
    }
  }

  return groups.map((group, i) => ({
    index: i + 1,
    // Sibling order is still the map's own, so a row reads left to right the
    // way the agent meant it to.
    nodes: [...group.nodes].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    ),
    phase: group.phase,
  }));
}

/**
/** The kinds that make a round a research round — what was gone and looked up,
 *  what was found, and the holes in it. A gap belongs here even though it wears
 *  the question colour: it is a fact about what already exists, namely that
 *  part of it is missing. */
const RESEARCH_KINDS = new Set(['research', 'finding', 'gap']);

/**
 * Whether this round is a round of research — the one round that gets its own
 * territory rather than just its own colour.
 *
 * "Most of it" rather than "all of it": a research round that picked up one
 * stray question along the way is still a research round, and demanding purity
 * would mean the band almost never appears on a real map. Strictly more than
 * half, so an even split does NOT band — a round that is half research and half
 * something else has no majority to name it after.
 *
 * The root round is never a band whatever it contains: it is the map's subject,
 * and enclosing it as "what already exists" would misdescribe the one node the
 * whole map hangs from.
 */
export function isResearchRound(round: Round): boolean {
  if (round.index === 1) return false;
  const found = round.nodes.filter((node) =>
    RESEARCH_KINDS.has(node.kind),
  ).length;
  return found * 2 > round.nodes.length;
}

/**
 * The line above a row, naming what the round was.
 *
 * The row has to say what it is without a legend, the same way every node
 * carries an eyebrow. A round that is all questions says so, because "three
 * questions" is what the person is being asked to deal with; a mixed round
 * counts nodes instead, because naming the majority kind would misdescribe it.
 *
 * A research round is the exception that says what it IS rather than how many
 * of anything it holds: "what already exists" is the thing a person scanning
 * the column is looking for, and a node count is not.
 */
export function roundEyebrow(round: Round, total: number): string {
  if (round.index === 1 && round.nodes.length === 1) return 'The idea';
  if (isResearchRound(round)) return 'What already exists';

  const questions = round.nodes.filter(
    (node) => node.kind === 'open-question',
  ).length;
  const count = round.nodes.length;
  const what =
    questions === count
      ? `${count} question${count === 1 ? '' : 's'}`
      : `${count} node${count === 1 ? '' : 's'}`;

  // Through the resolver and the labels: the round's phase is whatever the log
  // recorded, which on an older map is `deconstruct`, and a row that names
  // itself after a phase the nav no longer shows is a row naming a step the
  // person cannot find. Unrecognised phases still print themselves rather than
  // vanishing.
  const resolved = round.phase ? normalizePhase(round.phase) : null;
  const phaseName = resolved
    ? PHASE_LABELS[resolved].replace(/^\d+\s+/, '')
    : round.phase?.replace(/-/g, ' ');

  const name = phaseName ?? `Round ${round.index} of ${total}`;

  return `${name} · ${what}`;
}

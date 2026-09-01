// Which card prompted which.
//
// The retired tree drew every parent-child edge, because the tree WAS the
// layout and an edge was the only thing saying where a node came from. The
// layout is rows now, so a full edge graph would be a thicket crossing the
// column and saying nothing the rows do not already say.
//
// So this is deliberately narrower than the graph: one thread per card, from
// the card in the PREVIOUS round that prompted it. A card whose parent is
// further back than one round draws nothing — the thread is about the beat of
// the conversation ("this came out of that"), and a line spanning four rounds
// is a claim about ancestry that the rows already record and that no reader
// could follow across the intervening cards anyway.
//
// Pure and dependency-free, like `mapRounds` before it: the rules are the
// interesting part, so they are pinned by tests rather than read off a
// screenshot.

import type { Round } from './mapRounds';

export interface CardThread {
  /** The card the thread lands on. */
  childId: string;
  /** The card in the immediately preceding round it rises from. */
  parentId: string;
  /** The child's kind, so the drawing layer can colour the thread by the
   *  child's family without looking the node up again. The child's and not the
   *  parent's: the thread belongs to the card it arrives at, which is the one
   *  whose colour the eye is already tracking. */
  childKind: string;
  /** Every id in the child's round. The drawing layer needs it to tell which
   *  cards are on the row's FIRST line once the row has wrapped — a fact that
   *  exists only in the laid-out DOM, so this is the hook that lets it be
   *  worked out without reaching back for the rounds. */
  roundIds: string[];
}

/**
 * The threads to draw for a column of rounds.
 *
 * Returns one entry per card that has a parent in the round directly above it,
 * in row order. Everything else — the root, a card whose parent is two rounds
 * back, an orphan whose parent is not on the map at all — is simply absent,
 * because the honest drawing for "nothing prompted this here" is no line.
 */
export function cardThreads(rounds: Round[]): CardThread[] {
  const threads: CardThread[] = [];

  for (let i = 1; i < rounds.length; i += 1) {
    const previous = new Set(rounds[i - 1]!.nodes.map((node) => node.id));
    const roundIds = rounds[i]!.nodes.map((node) => node.id);

    for (const node of rounds[i]!.nodes) {
      if (!node.parentId) continue;
      if (!previous.has(node.parentId)) continue;
      threads.push({
        childId: node.id,
        parentId: node.parentId,
        childKind: node.kind,
        roundIds,
      });
    }
  }

  return threads;
}

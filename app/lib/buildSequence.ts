import { groupSummaryNodes, type SummaryNode } from './summaryGroups';

/** One increment in the build sequence, with the link already resolved. */
export interface SequencedSlice {
  slice: SummaryNode;
  /** The node this slice would settle, if it named one that still exists. */
  proves: { id: string; kind: string; label: string } | null;
  /**
   * True when this slice settles nothing — it named no node at all, or it named
   * one that has since been deleted. Either way the client should see it, so
   * this drives a mark on screen rather than a filter.
   */
  provesNothing: boolean;
  /**
   * Set only when the slice DID name a node and that node is gone. Distinct
   * from naming nothing: a dangling link is a slice whose reason was deleted
   * out from under it, which is worth reporting differently from one that never
   * had a reason.
   */
  danglingId: string | null;
}

/**
 * Resolve a finished map's slices into the order they should be built in.
 *
 * The whole opinion of the feature lives in `provesNothing`. An increment that
 * tests no assumption is not a validating slice — it is just work scheduled
 * early — and a sequence that quietly renders those alongside the real ones is
 * a Gantt chart with rounded corners. So the flag is computed here, once, and
 * the UI's only job is to make it visible.
 *
 * Pure: nodes in, an ordered list out. No database and no React, the same split
 * `groupSummaryNodes` and `layoutMap` already use, which is what lets every
 * interesting case — dangling links, unlinked slices, an empty map — be a test
 * rather than a screenshot.
 */
export function buildSequence(nodes: SummaryNode[]): SequencedSlice[] {
  // Every node is a candidate target, not just the assumptions: a slice can
  // settle a risk or an open question just as legitimately.
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Selection and ordering stay in groupSummaryNodes — one place decides which
  // nodes belong to a region, and it already sorts by `order` rather than
  // insertion, which the sequence needs for the same reason the numbered next
  // steps do: "build this first" has to survive a node being added later.
  return groupSummaryNodes(nodes)
    .slices.map((slice) => {
      const target = slice.testsNodeId ? byId.get(slice.testsNodeId) : undefined;
      const dangling = Boolean(slice.testsNodeId) && !target;

      return {
        slice,
        proves: target
          ? { id: target.id, kind: target.kind, label: target.label }
          : null,
        provesNothing: !target,
        danglingId: dangling ? (slice.testsNodeId ?? null) : null,
      };
    });
}

export interface SummaryNode {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  order: number;
  /**
   * On a slice, the node it would settle. Resolving it against the rest of the
   * map is `buildSequence`'s job, not this module's — selection here, meaning
   * there.
   */
  testsNodeId?: string | null;
}

export interface SummaryGroups {
  known: SummaryNode[];
  unknown: SummaryNode[];
  directions: SummaryNode[];
  steps: SummaryNode[];
  /**
   * The build sequence. Kept beside `steps` rather than replacing it: a next
   * step can be "interview three teachers", which is not something you build,
   * so collapsing the two would lose the research half of the plan.
   */
  slices: SummaryNode[];
}

/**
 * Sort a finished map's nodes into the regions of the summary screen.
 *
 * A completed map still holds every working node — the idea, the research, the
 * gaps — so this selects only the kinds that belong on the final screen.
 * Each bucket is ordered by `order` because the next steps are numbered on
 * screen: insertion order would mislabel the plan.
 */
export function groupSummaryNodes(nodes: SummaryNode[]): SummaryGroups {
  const pick = (kind: string) =>
    nodes.filter((n) => n.kind === kind).sort((a, b) => a.order - b.order);

  return {
    known: pick('known'),
    unknown: pick('unknown'),
    directions: pick('direction'),
    steps: pick('next-step'),
    slices: pick('slice'),
  };
}

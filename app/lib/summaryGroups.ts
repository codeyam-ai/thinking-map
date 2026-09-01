export interface SummaryNode {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  order: number;
}

export interface SummaryGroups {
  known: SummaryNode[];
  unknown: SummaryNode[];
  directions: SummaryNode[];
  steps: SummaryNode[];
}

/**
 * Sort a finished map's nodes into the four regions of the summary screen.
 *
 * A completed map still holds every working node — the idea, the research, the
 * gaps — so this selects only the four kinds that belong on the final screen.
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
  };
}

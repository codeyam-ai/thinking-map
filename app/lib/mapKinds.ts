// The controlled vocabulary behind MapNode.kind / MapNode.status and
// ThinkingMap.phase. SQLite has no enums in Prisma, so these Strings are
// defined here once and imported everywhere — including by the model's tool
// schema, so the AI can only emit kinds the map knows how to draw.

export const PHASES = [
  'idea',
  'deconstruct',
  'map',
  'research',
  'explore',
  'next-steps',
] as const;
export type Phase = (typeof PHASES)[number];

/** The six labels in the phase nav, in order. */
export const PHASE_LABELS: Record<Phase, string> = {
  idea: '01 Idea',
  deconstruct: '02 Deconstruct',
  map: '03 Map',
  research: '04 Research',
  explore: '05 Explore',
  'next-steps': '06 Next steps',
};

export const NODE_KINDS = [
  'idea',
  'user',
  'problem',
  'goal',
  'constraint',
  'assumption',
  'open-question',
  'research',
  'finding',
  'gap',
  'approach',
  'pro',
  'risk',
  'known',
  'unknown',
  'direction',
  'next-step',
  'slice',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** The eyebrow printed above a node, so the map reads without a legend. */
export const KIND_EYEBROW: Record<NodeKind, string> = {
  idea: 'Idea',
  user: 'User',
  problem: 'Problem',
  goal: 'Goal',
  constraint: 'Constraint',
  assumption: 'Assumption',
  'open-question': 'Open',
  research: 'Research',
  finding: 'Finding',
  gap: 'Gap',
  approach: 'Approach',
  pro: 'Pro',
  risk: 'Risk',
  known: 'We know',
  unknown: 'We don’t know',
  direction: 'Direction',
  'next-step': 'Next step',
  slice: 'Build first',
};

export const NODE_STATUSES = ['open', 'answered', 'updated'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

/** Kinds that carry a pro/risk accent rather than the neutral treatment. */
export const ACCENT_KINDS: Partial<Record<NodeKind, 'pro' | 'risk' | 'find'>> = {
  pro: 'pro',
  risk: 'risk',
  // A research node wears the lime — it is what the partner just went and found.
  research: 'find',
  // A slice is the one thing you actually go and build, so it earns the same
  // weight rather than sitting in the neutral treatment with everything else.
  slice: 'find',
};

export function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

export function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function isNodeStatus(value: string): value is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(value);
}

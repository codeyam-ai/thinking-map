// The controlled vocabulary behind MapNode.kind / MapNode.status and
// ThinkingMap.phase. SQLite has no enums in Prisma, so these Strings are
// defined here once and imported everywhere — including by the model's tool
// schema, so the AI can only emit kinds the map knows how to draw.

export const PHASES = [
  'idea',
  'map',
  'research',
  'explore',
  'next-steps',
] as const;
export type Phase = (typeof PHASES)[number];

/** The five labels in the phase nav, in order. */
export const PHASE_LABELS: Record<Phase, string> = {
  idea: '01 Idea',
  map: '02 Map',
  research: '03 Research',
  explore: '04 Explore',
  'next-steps': '05 Next steps',
};

/**
 * Phases that used to exist, and what they are now.
 *
 * `deconstruct` and `map` were two names for one activity: you answer
 * questions, and the map builds itself out of the answers. They were merged.
 * `phase` is a plain String column, so rather than migrate the rows the old
 * name simply keeps resolving — maps written before the merge still read
 * correctly, and an agent that learned the old vocabulary keeps working. This
 * is permanent, not a migration window.
 */
export const LEGACY_PHASE_ALIASES: Record<string, Phase> = {
  deconstruct: 'map',
};

/** Every phase name `set_phase` accepts — the five, plus the aliases. */
export const ACCEPTED_PHASE_NAMES = [
  ...PHASES,
  ...Object.keys(LEGACY_PHASE_ALIASES),
] as [string, ...string[]];

/**
 * What the phase asked for, and the words that end it.
 *
 * It lives beside the labels so the two cannot drift: a phase renamed here
 * without its sentence renamed too would leave the nav saying one thing and the
 * row footer another. `action` is null where a phase has no page-side way to
 * end — `idea` has not reached the map yet, and `next-steps` is where the loop
 * arrives rather than a step through it.
 */
export interface PhaseAsk {
  /** One sentence, read once the phase's round is done, naming what is left. */
  sentence: string;
  /** The label on the button that ends the phase, or null if there is none. */
  action: string | null;
  /** Where that button moves the map to. */
  next: Phase | null;
}

export const PHASE_ASK: Record<Phase, PhaseAsk> = {
  idea: {
    sentence: 'The map opens as soon as there is an idea to work from.',
    action: null,
    next: 'map',
  },
  map: {
    sentence:
      'The questions on the map are answered. What is left is going and finding things out.',
    action: 'Ready to research →',
    next: 'research',
  },
  research: {
    sentence:
      'There is enough on the map now to pick a direction and weigh it against the others.',
    action: 'Explore a direction →',
    next: 'explore',
  },
  explore: {
    sentence:
      'The directions are laid out. What is left is deciding what to build first.',
    action: 'Draw up the plan →',
    next: 'next-steps',
  },
  'next-steps': {
    sentence: 'This is the plan as it stands — a starting point, not a dead end.',
    action: null,
    next: null,
  },
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

/**
 * The six colour families the eighteen kinds collapse into.
 *
 * One hue per kind would be eighteen hues and no hierarchy at all — a legend,
 * not a system. Six is what a person can hold without one, and `KIND_EYEBROW`
 * above already names the exact kind on every card for anyone who wants the
 * detail. So the family carries the glanceable category and the eyebrow carries
 * the precision.
 *
 *   subject    the root idea; the map's own subject
 *   question   what nobody has answered yet
 *   ground     what is true about the world this idea sits in
 *   found      what somebody went and looked up
 *   judgment   a call about whether something is good or bad
 *   forward    what to do about any of it
 */
export const NODE_FAMILIES = [
  'subject',
  'question',
  'ground',
  'found',
  'judgment',
  'forward',
] as const;
export type NodeFamily = (typeof NODE_FAMILIES)[number];

/**
 * Every kind's family.
 *
 * Total rather than Partial-with-a-fallback on purpose: a nineteenth kind added
 * to `NODE_KINDS` will not compile until it is given a family, so a kind cannot
 * ship colourless.
 */
export const KIND_FAMILY: Record<NodeKind, NodeFamily> = {
  idea: 'subject',

  'open-question': 'question',
  unknown: 'question',
  // A gap is a hole in what was found — and it belongs with the questions
  // rather than with `found`, because what it records is that nobody has an
  // answer, which is the question family's whole meaning.
  gap: 'question',

  user: 'ground',
  problem: 'ground',
  goal: 'ground',
  constraint: 'ground',
  assumption: 'ground',
  known: 'ground',

  research: 'found',
  finding: 'found',

  pro: 'judgment',
  risk: 'judgment',

  approach: 'forward',
  direction: 'forward',
  'next-step': 'forward',
  slice: 'forward',
};

/** A node's family, for the kinds outside the vocabulary too — anything the
 *  map does not recognise reads as `ground`, the neutral family, rather than
 *  losing its colour entirely. */
export function familyOf(kind: string): NodeFamily {
  return KIND_FAMILY[kind as NodeKind] ?? 'ground';
}

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

/**
 * The phase a stored string means, following the aliases.
 *
 * `isPhase` answers a different question — is this literally one of the five —
 * and both are wanted: the tool schema validates against the current
 * vocabulary, while everything that READS a stored phase has to cope with what
 * earlier versions wrote. Returns null for a string that is neither, so the
 * caller picks its own fallback rather than being handed a wrong phase.
 */
export function normalizePhase(value: string): Phase | null {
  if (isPhase(value)) return value;
  return LEGACY_PHASE_ALIASES[value] ?? null;
}

export function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function isNodeStatus(value: string): value is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(value);
}

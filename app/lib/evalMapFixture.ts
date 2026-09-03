// What the browser eval's disposable map is made of.
//
// Separated from `scripts/seed-eval-map.ts` — which does the Prisma writing —
// because the SHAPE is the part that can be wrong in a way nothing notices.
// `formatStandingWait` returns an empty string unless the map carries at least
// one node whose `kind` is `open-question` and whose `status` is not
// `answered`. Seed anything else and the sentence the eval exists to test is
// never produced: the agent is never told to wait, the case fails, and the
// failure looks like a regression in the tool descriptions rather than a
// mistake in the fixture.
//
// Holding the shape here, in a module with no side effects, is what lets a test
// assert that property directly against the real `formatStandingWait` — in
// milliseconds, with no database, no dev server and no browser. The plan for
// this feature asked for that check to be made "empirically at execution"; this
// is that check, made once and then kept.

/** A node as the fixture describes it, before it has an id or a map. */
export interface FixtureNode {
  kind: string;
  label: string;
  status: string;
  origin: string;
}

/** A node once it has been written and has an id to refer to. */
export interface WrittenNode {
  id: string;
  label: string;
}

/** One row of the fixture's event log, with its revision already assigned. */
export interface FixtureEvent {
  revision: number;
  kind: string;
  origin: string;
  payload: Record<string, unknown>;
}

export interface EvalMapFixture {
  title: string;
  seedIdea: string;
  phase: string;
  theme: { label: string; order: number };
  /** The root node the questions hang from. Not an open question itself. */
  idea: FixtureNode;
  /** The nodes the standing-wait sentence actually counts. */
  questions: FixtureNode[];
}

/**
 * The map the browser eval runs against.
 *
 * Two open questions rather than one, deliberately: `formatStandingWait`
 * branches on the count for its wording ("1 question ... is" against
 * "2 questions ... are"), and the plural is the branch an agent meets in
 * practice, so it is the one worth putting in front of the model.
 */
export function evalMapFixture(): EvalMapFixture {
  return {
    title: 'Eval — a subscription box for houseplants',
    seedIdea:
      'A monthly subscription box that sends people a houseplant and looks ' +
      'after the part they always get wrong.',
    phase: 'map',
    theme: { label: 'Shipping', order: 0 },
    idea: {
      kind: 'idea',
      label: 'A houseplant subscription box',
      status: 'answered',
      origin: 'user',
    },
    questions: [
      {
        kind: 'open-question',
        label: 'Do plants survive three days in a box?',
        status: 'open',
        origin: 'agent',
      },
      {
        kind: 'open-question',
        label: 'What does a replacement policy cost us per shipment?',
        status: 'open',
        origin: 'agent',
      },
    ],
  };
}

/**
 * The event log for a seeded map, with revisions assigned.
 *
 * The seeder writes an event per seeded node rather than skipping the log,
 * because `revision` is a real cursor rather than a counter nobody reads:
 * `recordEvents` numbers each NEW event from the map's own `revision` column,
 * so a map whose column disagreed with its log would hand the agent a cursor
 * that skips or repeats history the moment it called `read_map` with one.
 *
 * Numbering lives here, apart from the writing, because it is the part that can
 * be silently wrong. Revisions must start at 1 and be gapless, and the map's
 * `revision` column must equal the count — an off-by-one in any of the three
 * produces a fixture that seeds cleanly and then misleads the agent.
 */
export function evalMapEvents(
  themeLabel: string,
  idea: WrittenNode,
  questions: readonly WrittenNode[],
): FixtureEvent[] {
  const rows = [
    { kind: 'theme.added', origin: 'agent', payload: { label: themeLabel } },
    {
      kind: 'node.added',
      origin: 'user',
      payload: { nodeId: idea.id, label: idea.label },
    },
    ...questions.map((node) => ({
      kind: 'question.asked',
      origin: 'agent',
      payload: { nodeId: node.id, label: node.label },
    })),
  ];

  // 1-based: revision 0 is the state a map is created in, before anything has
  // happened to it, so the first event is r1.
  return rows.map((row, index) => ({ revision: index + 1, ...row }));
}

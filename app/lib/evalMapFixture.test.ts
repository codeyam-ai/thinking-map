import { describe, expect, it } from 'vitest';
import { evalMapEvents, evalMapFixture } from './evalMapFixture';
import { formatStandingWait } from './mcpFormat';

// The browser eval's whole assertion is that an agent obeys the standing-wait
// sentence. If the fixture does not PRODUCE that sentence there is nothing to
// obey, the case fails, and the failure looks like a regression in the product
// rather than a mistake in the seed data.
//
// So this asserts the fixture against the real `formatStandingWait` — the same
// function the running app calls — rather than against a restatement of its
// rules. A change to what that function counts as an open question breaks this
// test, which is the point.

describe('evalMapFixture', () => {
  // The load-bearing property. An empty standing wait means the agent is never
  // told to wait, so the eval case would fail with nothing wrong in the product.
  it('produces a non-empty standing wait', () => {
    const { questions } = evalMapFixture();
    expect(formatStandingWait(questions, 4)).not.toBe('');
  });

  // The eval case asserts the agent calls `await_user_activity` with a numeric
  // `sinceRevision`. If the sentence stopped naming either, the case would be
  // asserting behaviour the app no longer asks for.
  it('tells the agent to call await_user_activity with the map revision', () => {
    const { questions } = evalMapFixture();
    const out = formatStandingWait(questions, 4);

    // The two halves of the instruction the eval case asserts the agent follows:
    // the tool to call, and the cursor to call it with.
    expect(out).toContain('await_user_activity');
    expect(out).toContain('sinceRevision: 4');
  });

  // `formatStandingWait` branches on the count for its wording. The plural is
  // what an agent meets on a real board, so trimming the fixture to one question
  // would quietly test a branch the product rarely shows.
  it('carries enough open questions to reach the plural wording', () => {
    const { questions } = evalMapFixture();
    const out = formatStandingWait(questions, 1);

    // One question would exercise the singular branch instead. The plural is
    // what an agent meets on a real board, so it is the one the model should be
    // shown.
    expect(questions.length).toBeGreaterThan(1);
    expect(out).toContain(`${questions.length} questions`);
  });

  // Guards the assertion above from passing for the wrong reason: a root node
  // that accidentally counted as an open question would inflate the total the
  // plural test checks.
  it('hangs the questions off a root that is not itself counted', () => {
    const { idea, questions } = evalMapFixture();

    // A root node that accidentally counted would make the fixture's question
    // total wrong, and the plural assertion above would pass for the wrong
    // reason.
    expect(formatStandingWait([idea], 1)).toBe('');
    expect(formatStandingWait([idea, ...questions], 1)).toContain(
      `${questions.length} questions`,
    );
  });
});

describe('evalMapEvents', () => {
  const idea = { id: 'n_idea', label: 'A houseplant subscription box' };
  const questions = [
    { id: 'n_q1', label: 'Do plants survive three days in a box?' },
    { id: 'n_q2', label: 'What does a replacement policy cost?' },
  ];

  // `recordEvents` numbers each NEW event from the map's `revision` column, so
  // a log that did not start at 1 or skipped a number would collide with, or
  // leave a hole before, the first event a tool writes.
  it('numbers revisions from one, gaplessly', () => {
    const events = evalMapEvents('Shipping', idea, questions);
    expect(events.map((e) => e.revision)).toEqual([1, 2, 3, 4]);
  });

  // The seeder sets the map's revision column to this count. If the two ever
  // disagreed, the agent's first cursor would skip or repeat history — the
  // exact failure writing the log at all is meant to prevent.
  it('produces one event per seeded row so the map revision can match', () => {
    const events = evalMapEvents('Shipping', idea, questions);
    expect(events).toHaveLength(2 + questions.length);
    expect(events[events.length - 1].revision).toBe(events.length);
  });

  // The log is what an agent reads to learn what it missed. Events carrying no
  // node id would render as bare kinds naming nothing.
  it('carries the node each question event refers to', () => {
    const events = evalMapEvents('Shipping', idea, questions);
    const asked = events.filter((e) => e.kind === 'question.asked');

    expect(asked).toHaveLength(questions.length);
    expect(asked.map((e) => e.payload.nodeId)).toEqual(['n_q1', 'n_q2']);
    expect(asked.map((e) => e.payload.label)).toEqual(questions.map((q) => q.label));
  });

  // The person's own idea and the agent's questions have to be distinguishable
  // in the log, or an agent re-reading it ingests its own output as new input.
  it('attributes the seed idea to the person and the questions to the agent', () => {
    const events = evalMapEvents('Shipping', idea, questions);
    expect(events.find((e) => e.kind === 'node.added')?.origin).toBe('user');
    expect(events.filter((e) => e.kind === 'question.asked').every((e) => e.origin === 'agent')).toBe(true);
  });
});

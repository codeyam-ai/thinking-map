import { describe, expect, it } from 'vitest';
import {
  answeredIds,
  askedNodeIds,
  describeEvent,
  describeRun,
  questionIds,
  railEntries,
  runLength,
  visibleEvents,
} from './exchangeRail';
import type { ExchangeEvent } from './exchange';

// The rail is the only account a person gets of what happened to their map —
// the page cannot see the agent's conversation and never will. So the wording
// is the interface, and a regression here is a person being told the wrong
// thing about their own artifact rather than a cosmetic slip.

let seq = 0;
function event(partial: Partial<ExchangeEvent>): ExchangeEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    revision: seq,
    kind: 'node.added',
    origin: 'agent',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

describe('visibleEvents', () => {
  // ask_user writes the question nodes AND announces them. Showing both would
  // report one act twice, and the bare adds are the half nobody can act on.
  it('hides the question nodes that a question.asked announced', () => {
    const events = [
      event({ kind: 'node.added', payload: { id: 'q1', label: 'Who is it for?' } }),
      event({ kind: 'node.added', payload: { id: 'q2', label: 'What is the goal?' } }),
      event({
        kind: 'question.asked',
        payload: { questions: [{ id: 'q1' }, { id: 'q2' }] },
      }),
    ];
    expect(visibleEvents(events).map((e) => e.kind)).toEqual(['question.asked']);
  });

  // An open-question node put on the map WITHOUT an ask_user is a real
  // contribution — nothing announced it, so nothing may hide it.
  it('keeps a question node that nothing announced', () => {
    const events = [
      event({ kind: 'node.added', payload: { id: 'q9', label: 'Unasked' } }),
    ];
    expect(visibleEvents(events)).toHaveLength(1);
  });

  // Answering closes the question. Both halves are the same act, and the
  // answer is the half worth a row.
  it('hides the node.updated that an answer closed', () => {
    const events = [
      event({ kind: 'user.answer', origin: 'user', payload: { answers: [{ id: 'q1' }] } }),
      event({
        kind: 'node.updated',
        origin: 'user',
        payload: { id: 'q1', status: 'answered' },
      }),
    ];
    expect(visibleEvents(events).map((e) => e.kind)).toEqual(['user.answer']);
  });

  // The suppression is narrow on purpose: an AGENT closing the same node is a
  // separate act by the other side and must still be reported.
  it('keeps an agent update to a node the person answered', () => {
    const events = [
      event({ kind: 'user.answer', origin: 'user', payload: { answers: [{ id: 'q1' }] } }),
      event({
        kind: 'node.updated',
        origin: 'agent',
        payload: { id: 'q1', status: 'answered' },
      }),
    ];
    expect(visibleEvents(events).map((e) => e.origin)).toEqual(['user', 'agent']);
  });

  // A user update that is not the answer's own close — a relabel, say — is a
  // real edit and is not bookkeeping.
  it('keeps a user update that is not the answer close', () => {
    const events = [
      event({ kind: 'user.answer', origin: 'user', payload: { answers: [{ id: 'q1' }] } }),
      event({
        kind: 'node.updated',
        origin: 'user',
        payload: { id: 'q1', label: 'Reworded' },
      }),
    ];
    expect(visibleEvents(events)).toHaveLength(2);
  });
});

describe('runLength', () => {
  // An agent turn that writes four nodes is one thing that happened.
  it('extends across consecutive same-kind, same-origin events', () => {
    const events = [
      event({ kind: 'node.added', origin: 'agent' }),
      event({ kind: 'node.added', origin: 'agent' }),
      event({ kind: 'node.added', origin: 'agent' }),
    ];
    expect(runLength(events, 0)).toBe(3);
  });

  // A run must not span sides — that would credit the person's work to the
  // agent, or the reverse.
  it('stops at a change of side', () => {
    const events = [
      event({ kind: 'node.added', origin: 'agent' }),
      event({ kind: 'node.added', origin: 'user' }),
    ];
    expect(runLength(events, 0)).toBe(1);
  });

  // Notes and answers carry distinct text every time, so collapsing them would
  // throw away the only part worth reading.
  it('never groups a kind that carries its own text', () => {
    const events = [
      event({ kind: 'agent.note', payload: { text: 'one' } }),
      event({ kind: 'agent.note', payload: { text: 'two' } }),
    ];
    expect(runLength(events, 0)).toBe(1);
  });

  // The caller advances by the result, so an out-of-range index must not
  // return 0 and spin forever.
  it('returns 1 past the end', () => {
    expect(runLength([], 0)).toBe(1);
  });
});

describe('describeRun', () => {
  // Naming the thing beats counting it when there is only one.
  it('names the node when the run is a single add', () => {
    const entry = describeRun([
      event({ kind: 'node.added', origin: 'agent', payload: { label: 'A goal' } }),
    ]);
    expect(entry.text).toBe('Agent added “A goal”');
  });

  // Past one, the count IS the information — an agent turn that wrote four
  // nodes is one act, and four near-identical rows would bury the rest of the log.
  it('counts them once there is more than one', () => {
    const entry = describeRun([
      event({ kind: 'node.added', origin: 'agent', payload: { label: 'A' } }),
      event({ kind: 'node.added', origin: 'agent', payload: { label: 'B' } }),
    ]);
    expect(entry.text).toBe('Agent added 2 nodes');
  });

  // The map is co-authored, so a row has to say WHICH side acted and whether
  // something was created or changed — both halves of "who did what".
  it('says "You" for the person and distinguishes an update', () => {
    const entry = describeRun([
      event({ kind: 'node.updated', origin: 'user', payload: { label: 'Reworded' } }),
    ]);
    expect(entry.text).toBe('You updated “Reworded”');
  });

  // The entry keys off the LAST event so the revision is the cursor the run
  // actually left the map at.
  it('carries the last revision in the run', () => {
    const entry = describeRun([
      event({ kind: 'node.added', revision: 4 }),
      event({ kind: 'node.added', revision: 5 }),
    ]);
    expect(entry.revision).toBe(5);
  });
});

describe('describeEvent', () => {
  // Naming the node is the entire difference between a question and a note. A
  // row reading "You asked a question" would put the reader back to guessing
  // which of twenty pills it was about.
  it('names the node a question was about', () => {
    const entry = describeEvent(
      event({
        kind: 'user.question',
        origin: 'user',
        payload: {
          nodeId: 'n1',
          label: 'Capture the thought, not the book',
          text: 'Does this replace the log?',
        },
      }),
    );
    expect(entry.text).toBe('You asked about “Capture the thought, not the book”');
    expect(entry.note).toBe('Does this replace the log?');
  });

  // The label is denormalised at write time, so a question whose node was since
  // deleted still reads as something rather than falling through to the raw
  // kind name.
  it('falls back to naming no node when the label is gone', () => {
    const entry = describeEvent(
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 'n1' } }),
    );
    expect(entry.text).toBe('You asked about a node');
  });

  // The phase nav numbers its labels; a sentence should not.
  it('drops the phase number when reporting a phase change', () => {
    const entry = describeEvent(
      event({ kind: 'phase.set', origin: 'agent', payload: { phase: 'explore' } }),
    );
    expect(entry.text).toBe('Agent moved to Explore');
  });

  // A note's whole value is its text, so it comes through as the note field
  // the row renders with question emphasis.
  it('carries a note through as text', () => {
    const entry = describeEvent(
      event({ kind: 'agent.note', origin: 'agent', payload: { text: 'why I did it' } }),
    );
    expect(entry).toMatchObject({
      text: 'Agent left a note',
      note: 'why I did it',
    });
  });

  // "Agent asked 1 questions" is the kind of seam that makes a surface read as
  // machine output rather than an account of what happened.
  it('singularises one question and counts several', () => {
    const one = describeEvent(
      event({ kind: 'question.asked', payload: { questions: [{ id: 'a' }] } }),
    );
    const many = describeEvent(
      event({
        kind: 'question.asked',
        payload: { questions: [{ id: 'a' }, { id: 'b' }] },
      }),
    );
    expect(one.text).toBe('Agent asked a question');
    expect(many.text).toBe('Agent asked 2 questions');
  });

  // One answer can be shown; several cannot, because the row has no way to say
  // which question each belongs to.
  it('shows the answer text only when a single question was answered', () => {
    const one = describeEvent(
      event({
        kind: 'user.answer',
        origin: 'user',
        payload: { answers: [{ id: 'q1', answer: 'Almost never.' }] },
      }),
    );
    const many = describeEvent(
      event({
        kind: 'user.answer',
        origin: 'user',
        payload: {
          answers: [
            { id: 'q1', answer: 'Almost never.' },
            { id: 'q2', answer: 'Just me.' },
          ],
        },
      }),
    );
    expect(one).toMatchObject({ text: 'You answered a question', note: 'Almost never.' });
    expect(many).toMatchObject({ text: 'You answered 2 questions', note: null });
  });

  // A user.node carries the created node's real label, and quoting it back is
  // what confirms to the person that what they typed reached the map.
  it('names a node the person added', () => {
    const entry = describeEvent(
      event({
        kind: 'user.node',
        origin: 'user',
        payload: { label: 'Search has to be instant' },
      }),
    );
    expect(entry.text).toBe('You added “Search has to be instant”');
  });

  // A malformed payload must still produce a readable row: the rail is the
  // person's only record, so degrading beats disappearing.
  it('falls back when the payload carries no label', () => {
    const entry = describeEvent(event({ kind: 'user.node', origin: 'user', payload: {} }));
    expect(entry.text).toBe('You added a node');
  });
});

describe('payload readers', () => {
  // Every reader is fed untrusted JSON from the log, where a row may predate
  // the current shape or have failed to parse at all.
  it('tolerate a missing, wrong-typed, or absent payload', () => {
    expect(questionIds(event({ payload: null }))).toEqual([]);
    expect(questionIds(event({ payload: { questions: 'nope' } }))).toEqual([]);
    expect(answeredIds(event({ payload: { answers: [{ id: 7 }, { id: 'ok' }] } }))).toEqual([
      'ok',
    ]);
  });
});

describe('railEntries', () => {
  // The whole pipeline over a real give-and-take: the agent works, the person
  // answers and contributes, and each act gets exactly one line.
  it('renders a full exchange as one line per act', () => {
    seq = 0;
    const events = [
      event({ kind: 'node.added', origin: 'user', payload: { id: 'idea', label: 'Tool' } }),
      event({ kind: 'agent.note', origin: 'agent', payload: { text: 'Reframing it.' } }),
      event({ kind: 'node.added', origin: 'agent', payload: { id: 'p', label: 'Problem' } }),
      event({ kind: 'node.added', origin: 'agent', payload: { id: 'q1' } }),
      event({ kind: 'question.asked', origin: 'agent', payload: { questions: [{ id: 'q1' }] } }),
      event({
        kind: 'user.answer',
        origin: 'user',
        payload: { answers: [{ id: 'q1', answer: 'Almost never.' }] },
      }),
      event({ kind: 'node.updated', origin: 'user', payload: { id: 'q1', status: 'answered' } }),
      event({ kind: 'phase.set', origin: 'agent', payload: { phase: 'explore' } }),
    ];

    expect(railEntries(events).map((e) => e.text)).toEqual([
      'You added “Tool”',
      'Agent left a note',
      'Agent added “Problem”',
      'Agent asked a question',
      'You answered a question',
      'Agent moved to Explore',
    ]);
  });

  // A map nobody has touched yet must produce no rows at all, so the rail can
  // show its own explanation of how anything gets into it.
  it('is empty for an empty log', () => {
    expect(railEntries([])).toEqual([]);
  });

  // Keys drive React reconciliation; a duplicate would drop a row.
  it('gives every entry a distinct id', () => {
    seq = 0;
    const events = [
      event({ kind: 'node.added', origin: 'agent' }),
      event({ kind: 'node.added', origin: 'user' }),
      event({ kind: 'agent.note', origin: 'agent', payload: { text: 'x' } }),
    ];
    const ids = railEntries(events).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// The marks on the map that say "you have already asked about this one". They
// are derived from the log rather than tracked alongside it, so they survive a
// reload and count a question asked from any front door.
describe('askedNodeIds', () => {
  // The ordinary case: the id travels in the payload, which is the whole reason
  // this is its own kind rather than a note with a name in the prose.
  it('collects the node a question names', () => {
    const ids = askedNodeIds([
      event({
        kind: 'user.question',
        origin: 'user',
        payload: { nodeId: 'n1', label: 'Capture the thought', text: 'Why?' },
      }),
    ]);
    expect(ids.has('n1')).toBe(true);
  });

  // A node asked about twice is still one marked node — the mark says whether,
  // not how many.
  it('counts a node asked about twice only once', () => {
    const ids = askedNodeIds([
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 'n1' } }),
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 'n1' } }),
    ]);
    expect(ids.size).toBe(1);
  });

  // Every other kind in the log must leave the marks alone — notes and answers
  // carry node ids too, and marking those would badge half the map.
  it('ignores every other kind of event', () => {
    const ids = askedNodeIds([
      event({ kind: 'user.note', origin: 'user', payload: { text: 'a note' } }),
      event({ kind: 'user.node', origin: 'user', payload: { id: 'n2' } }),
      event({ kind: 'node.added', origin: 'agent', payload: { id: 'n3' } }),
      event({
        kind: 'user.answer',
        origin: 'user',
        payload: { answers: [{ id: 'n4', answer: 'yes' }] },
      }),
    ]);
    expect(ids.size).toBe(0);
  });

  // Several nodes asked about across a session all keep their marks.
  it('collects every distinct node across the log', () => {
    const ids = askedNodeIds([
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 'n1' } }),
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 'n2' } }),
    ]);
    expect([...ids].sort()).toEqual(['n1', 'n2']);
  });

  // A payload that lost its id must not throw and must not mark anything — one
  // unattributable question should not take the marks off the rest.
  it('skips a question with a missing or non-string nodeId', () => {
    const ids = askedNodeIds([
      event({ kind: 'user.question', origin: 'user', payload: {} }),
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: 42 } }),
      event({ kind: 'user.question', origin: 'user', payload: { nodeId: '' } }),
      event({ kind: 'user.question', origin: 'user', payload: null }),
    ]);
    expect(ids.size).toBe(0);
  });

  // A map nobody has asked about has no marks.
  it('is empty for an empty log', () => {
    expect(askedNodeIds([]).size).toBe(0);
  });
});

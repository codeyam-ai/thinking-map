import { describe, expect, it } from 'vitest';
import { answersByNodeId, parseOptions } from './mapAnswers';
import type { ExchangeEvent } from './exchange';

// The answer to a question lives in the log, never on the node — so this is
// what makes an answered card able to show what the person actually said. The
// re-answer case is the one with teeth: editing an answer IS posting another
// one, so "latest wins" is the whole edit feature rather than a tidiness rule.

let seq = 0;

function answerEvent(
  answers: unknown,
  partial: Partial<ExchangeEvent> = {},
): ExchangeEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    revision: seq,
    kind: 'user.answer',
    origin: 'user',
    payload: { answers },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

describe('answersByNodeId', () => {
  // Day one: nothing has been answered, and every card is still asking.
  it('returns nothing for an empty log', () => {
    expect(answersByNodeId([]).size).toBe(0);
  });

  // The ordinary case — one question, one answer, shown back on its card.
  it('reads a single answer back by its question id', () => {
    const events = [answerEvent([{ id: 'q1', text: 'Who?', answer: 'Just me' }])];
    expect(answersByNodeId(events).get('q1')).toBe('Just me');
  });

  // One user.answer can settle several questions at once.
  it('reads every answer out of a multi-answer event', () => {
    const events = [
      answerEvent([
        { id: 'q1', answer: 'Just me' },
        { id: 'q2', answer: 'A shared fund' },
      ]),
    ];
    const answers = answersByNodeId(events);
    expect(answers.get('q1')).toBe('Just me');
    expect(answers.get('q2')).toBe('A shared fund');
  });

  // Editing an answer is posting a second one, so the later answer must stand.
  // If the first won, the Edit affordance would silently do nothing.
  it('lets a later answer replace an earlier one for the same question', () => {
    const events = [
      answerEvent([{ id: 'q1', answer: 'Just me' }]),
      answerEvent([{ id: 'q1', answer: 'Actually, the whole street' }]),
    ];
    expect(answersByNodeId(events).get('q1')).toBe('Actually, the whole street');
  });

  // Latest is by revision, not by array position — the caller is not required
  // to have sorted the log first.
  it('takes the highest-revision answer when the log arrives out of order', () => {
    const later = answerEvent([{ id: 'q1', answer: 'Second' }]);
    const earlier = answerEvent([{ id: 'q1', answer: 'First' }]);
    // Force the revisions so the array order and the revision order disagree.
    const events = [
      { ...later, revision: 9 },
      { ...earlier, revision: 2 },
    ] as ExchangeEvent[];
    expect(answersByNodeId(events).get('q1')).toBe('Second');
  });

  // The log holds every kind of event; only answers are answers.
  it('ignores events that are not answers', () => {
    const events = [
      answerEvent([{ id: 'q1', answer: 'Just me' }], {
        kind: 'agent.note',
        payload: { text: 'a note' },
      }),
    ];
    expect(answersByNodeId(events).size).toBe(0);
  });

  // One malformed payload must not blank every other answer on the map.
  it('skips malformed entries without losing the good ones', () => {
    const events = [
      answerEvent([{ id: 'q1', answer: 'Kept' }]),
      answerEvent('not an array'),
      answerEvent([{ id: 42, answer: 'no id' }, { id: 'q2' }, { id: 'q3', answer: '  ' }]),
    ];
    const answers = answersByNodeId(events);
    expect(answers.get('q1')).toBe('Kept');
    expect(answers.has('q2')).toBe(false);
    expect(answers.has('q3')).toBe(false);
  });
});

describe('parseOptions', () => {
  // A question with no shortlist is the ordinary case, not a degraded one —
  // the card is simply a card with an answer box.
  it('offers no chips when the column is null', () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
  });

  // The stored shape: a JSON array of strings, because SQLite has no arrays.
  it('reads the stored JSON array back as chips', () => {
    expect(parseOptions('["Just me", "The whole street"]')).toEqual([
      'Just me',
      'The whole street',
    ]);
  });

  // A malformed column must not take the card down with it.
  it('offers no chips when the column is not valid JSON', () => {
    expect(parseOptions('{not json')).toEqual([]);
  });

  // Valid JSON of the wrong shape is still not a list of suggestions.
  it('offers no chips when the JSON is not an array', () => {
    expect(parseOptions('{"a":1}')).toEqual([]);
    expect(parseOptions('"a string"')).toEqual([]);
  });

  // A blank or non-string entry would render as an unlabelled button nobody
  // could interpret, so it is dropped rather than shown.
  it('drops blank and non-string entries', () => {
    expect(parseOptions('["Keep", "", "   ", 7, null]')).toEqual(['Keep']);
  });

  // An empty array is the same situation as no column at all.
  it('offers no chips for an empty array', () => {
    expect(parseOptions('[]')).toEqual([]);
  });
});

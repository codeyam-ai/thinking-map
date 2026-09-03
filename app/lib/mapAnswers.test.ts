import { describe, expect, it } from 'vitest';
import {
  answersByNodeId,
  parseOptions,
  selectionsByNodeId,
  withSelections,
} from './mapAnswers';
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

describe('withSelections', () => {
  // The ordinary write from a card with a shortlist: the string stays exactly
  // what it was, and the two structured fields ride alongside it.
  it('attaches the parts to the entry that supplied them', () => {
    const entries = [{ id: 'q1', text: 'Who?', answer: 'Teachers — mostly' }];
    expect(
      withSelections(entries, { q1: { picked: ['Teachers'], text: 'mostly' } }),
    ).toEqual([
      {
        id: 'q1',
        text: 'Who?',
        answer: 'Teachers — mostly',
        selected: ['Teachers'],
        other: 'mostly',
      },
    ]);
  });

  // A question with no shortlist supplies no parts, and its entry must come
  // back byte-identical — this is what keeps every answer already in the
  // database, and every card that writes one, reading exactly as before.
  it('leaves an entry with no parts exactly as it was', () => {
    const entries = [{ id: 'q1', text: 'Who?', answer: 'Just me' }];
    expect(withSelections(entries, {})).toEqual(entries);
    expect(withSelections(entries)).toEqual(entries);
  });

  // One event can settle several questions, and only the ones with a shortlist
  // carry structure. The two shapes have to survive in the same array.
  it('attaches parts per entry, leaving the others untouched', () => {
    const entries = [
      { id: 'q1', answer: 'Teachers' },
      { id: 'q2', answer: 'A shared fund' },
    ];
    const written = withSelections(entries, {
      q1: { picked: ['Teachers'], text: '' },
    });
    expect(written[0]).toMatchObject({ selected: ['Teachers'], other: '' });
    expect(written[1]).toEqual({ id: 'q2', answer: 'A shared fund' });
  });

  // The round trip, in one place. What the writer attaches is what the reader
  // takes back off — a drift between the two field names would break editing
  // silently, and neither half tested alone would catch it.
  it('writes what selectionsByNodeId reads back', () => {
    const written = withSelections([{ id: 'q1', answer: 'Teachers — mostly' }], {
      q1: { picked: ['Teachers'], text: 'mostly' },
    });
    const restored = selectionsByNodeId([answerEvent(written)]);
    expect(restored.get('q1')).toEqual({ picked: ['Teachers'], text: 'mostly' });
  });
});

describe('selectionsByNodeId', () => {
  // Nothing answered yet, and nothing to say about it.
  it('returns nothing for an empty log', () => {
    expect(selectionsByNodeId([]).size).toBe(0);
  });

  // The ordinary read: the parts come back as the card needs to seed itself.
  it('reads a recorded selection back by its question id', () => {
    const events = [
      answerEvent([
        { id: 'q1', answer: 'Teachers', selected: ['Teachers'], other: '' },
      ]),
    ];
    expect(selectionsByNodeId(events).get('q1')).toEqual({
      picked: ['Teachers'],
      text: '',
    });
  });

  // Editing an answer is posting another one, so the newest selection stands —
  // the same rule answersByNodeId holds for the display string, and the two
  // disagreeing would open the pencil on a selection the answer contradicts.
  it('lets a later selection replace an earlier one for the same question', () => {
    const events = [
      answerEvent([{ id: 'q1', answer: 'Teachers', selected: ['Teachers'] }]),
      answerEvent([{ id: 'q1', answer: 'Nurses', selected: ['Nurses'] }]),
    ];
    expect(selectionsByNodeId(events).get('q1')?.picked).toEqual(['Nurses']);
  });

  // An answer written before the log carried structure. Saying nothing about
  // it is the honest result: the card falls back to reading the text apart,
  // which beats claiming an empty selection the person never made.
  it('passes over an entry that carries no selection', () => {
    const events = [answerEvent([{ id: 'q1', answer: 'Just me' }])];
    expect(selectionsByNodeId(events).has('q1')).toBe(false);
  });

  // And a legacy write after a structured one must not BLANK it — that would
  // lose information rather than decline to add any.
  it('does not blank an earlier selection with a later structureless write', () => {
    const events = [
      answerEvent([{ id: 'q1', answer: 'Teachers', selected: ['Teachers'] }]),
      answerEvent([{ id: 'q1', answer: 'Teachers' }]),
    ];
    expect(selectionsByNodeId(events).get('q1')?.picked).toEqual(['Teachers']);
  });

  // One bad payload must not take out every other card's selection, the same
  // tolerance answersByNodeId has for the string.
  it('skips malformed entries rather than throwing', () => {
    const events = [
      answerEvent('not an array'),
      answerEvent([{ id: 42, selected: ['x'] }]),
      answerEvent([{ id: 'q1', selected: ['Nurses', 7, null] }]),
    ];
    const selections = selectionsByNodeId(events);
    expect(selections.get('q1')).toEqual({ picked: ['Nurses'], text: '' });
  });

  // A non-user.answer event has no business here — the log carries the whole
  // exchange, agent writes included.
  it('ignores events that are not answers', () => {
    const events = [
      answerEvent([{ id: 'q1', selected: ['Nurses'] }], {
        kind: 'agent.note',
      }),
    ];
    expect(selectionsByNodeId(events).size).toBe(0);
  });
});

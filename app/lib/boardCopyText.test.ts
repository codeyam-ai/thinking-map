import { describe, expect, it } from 'vitest';
import {
  cardCopyLabel,
  cardCopyText,
  conclusionCopyText,
  coreCopyText,
  type CopyableCard,
} from './boardCopyText';

// What the board's copy buttons put on the clipboard.
//
// These exist because dragging the board suppresses text selection: the map's
// words cannot be swiped over any more, so a button copies them instead. That
// makes the rules here the ONLY path from the board to somewhere else, which is
// why each branch is pinned rather than left to three template literals in
// three components.
//
// The cases that matter are the ones where the copied text is not simply what
// the card draws: an answer without its question has lost what it was
// answering, and a reading of the idea without the idea is unrecoverable to
// anyone who reads it later.

function card(over: Partial<CopyableCard> = {}): CopyableCard {
  return {
    kind: 'open-question',
    status: 'open',
    label: 'Who is this for?',
    detail: null,
    ...over,
  };
}

describe('cardCopyText', () => {
  // An open question has no answer yet, and its shortlist is a set of options
  // rather than content — so the question alone is the whole of it.
  it('copies an open question as its question alone', () => {
    expect(cardCopyText(card())).toBe('Who is this for?');
  });

  // The pairing is the point. An answer pasted on its own has lost the question
  // it was answering, and nothing downstream can recover it.
  it('copies an answered card as the question and the answer together', () => {
    expect(
      cardCopyText(
        card({
          status: 'answered',
          detail: 'Practice managers, not clinicians.',
        }),
      ),
    ).toBe('Who is this for?\n\nPractice managers, not clinicians.');
  });

  // An insight is the partner's claim and its reasoning — the same two-block
  // shape as an answered card, but arrived at the other way round.
  it('copies an insight as its claim and its reasoning', () => {
    expect(
      cardCopyText(
        card({
          kind: 'assumption',
          status: 'open',
          label: 'Rural clinics with under 12 staff',
          detail: 'Anything larger already has a coordinator role.',
        }),
      ),
    ).toBe(
      'Rural clinics with under 12 staff\n\nAnything larger already has a coordinator role.',
    );
  });

  // A card CARRYING something is showing it to you whatever its kind — the
  // clause `isInsightCard` exists for. Branching on the kind list alone would
  // read an `approach` with a diagram as an unanswered question.
  it('treats a card carrying a diagram as an insight whatever its kind', () => {
    expect(
      cardCopyText(
        card({
          kind: 'approach',
          status: 'answered',
          label: 'Two-step handover',
          detail: 'Morning list, then a callback pass.',
          diagram: { steps: ['a', 'b'] },
        }),
      ),
    ).toBe('Two-step handover\n\nMorning list, then a callback pass.');
  });

  // An empty detail must not leave a label with a blank line hanging off it —
  // that gap arrives in whatever the person pastes into.
  it('never trails a blank line when there is no detail', () => {
    const answered = cardCopyText(card({ status: 'answered', detail: '   ' }));

    expect(answered).toBe('Who is this for?');
    expect(answered.endsWith('\n')).toBe(false);
  });
});

describe('cardCopyLabel', () => {
  // The name has to promise exactly what the text delivers, which is why it
  // branches on the same three faces rather than being written beside them.
  it('names each of the three faces distinctly', () => {
    expect(cardCopyLabel(card())).toBe('Copy this question');
    expect(cardCopyLabel(card({ status: 'answered', detail: 'x' }))).toBe(
      'Copy this question and your answer',
    );
    expect(cardCopyLabel(card({ kind: 'risk' }))).toBe('Copy this insight');
  });

  // The promise, stated as an invariant: whenever the label says an answer is
  // included, the text has to actually include it.
  it('promises the answer only when the text carries it', () => {
    const answered = card({ status: 'answered', detail: 'Practice managers.' });

    expect(cardCopyLabel(answered)).toContain('your answer');
    expect(cardCopyText(answered)).toContain('Practice managers.');
  });
});

describe('coreCopyText', () => {
  // The state a board spends its first minutes in: an idea and nothing said
  // about it yet. Copying it must be the person's own sentence, with no
  // scaffolding around it.
  it('copies the idea on its own when there is no reading of it yet', () => {
    expect(coreCopyText({ seedIdea: 'Clinics lose track of follow-up care.' })).toBe(
      'Clinics lose track of follow-up care.',
    );
  });

  // The reading never travels alone: "what that tells us" pasted by itself has
  // lost the idea it is about.
  it('carries the idea along with its reading', () => {
    expect(
      coreCopyText({
        seedIdea: 'Clinics lose track of follow-up care.',
        insight: 'The whiteboard is a symptom of an ownership gap.',
      }),
    ).toBe(
      'Clinics lose track of follow-up care.\n\nThe whiteboard is a symptom of an ownership gap.',
    );
  });

  // An explicitly absent reading is the same as none at all. Passing null
  // through would put a trailing blank line into whatever the person pastes
  // into, which is the one thing the joiner exists to prevent.
  it('ignores a null reading rather than pasting a gap', () => {
    expect(
      coreCopyText({ seedIdea: 'An idea.', insight: null }),
    ).toBe('An idea.');
  });
});

describe('conclusionCopyText', () => {
  // The ways forward come as a list because that is what they are on screen: a
  // column of buttons, not a comma-separated sentence.
  it('lists the ways forward under the conclusion', () => {
    expect(
      conclusionCopyText({
        label: 'The whiteboard is a symptom of an ownership gap',
        detail: 'Nobody owns a case between shifts.',
        choices: ['Name an owner per case', 'Try a callback pass'],
      }),
    ).toBe(
      'The whiteboard is a symptom of an ownership gap\n\n' +
        'Nobody owns a case between shifts.\n\n' +
        'Where next\n- Name an owner per case\n- Try a callback pass',
    );
  });

  // A conclusion with no routes on offer is still a conclusion. An empty
  // "Where next" heading would say the opposite — that there were options and
  // they went missing.
  it('omits the heading entirely when no ways forward were offered', () => {
    const text = conclusionCopyText({
      label: 'The whiteboard is a symptom of an ownership gap',
      detail: 'Nobody owns a case between shifts.',
      choices: [],
    });

    expect(text).not.toContain('Where next');
    expect(text).toBe(
      'The whiteboard is a symptom of an ownership gap\n\nNobody owns a case between shifts.',
    );
  });

  // The far-end card is collapsed most of the time and shows neither the
  // reasoning nor the routes. What you copy is the conclusion, not the current
  // state of the panel, so both come along regardless.
  it('copies the claim alone when it has neither reasoning nor routes', () => {
    expect(
      conclusionCopyText({ label: 'An ownership gap', detail: null, choices: null }),
    ).toBe('An ownership gap');
  });
});

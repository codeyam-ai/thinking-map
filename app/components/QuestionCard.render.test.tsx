// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuestionCard from './QuestionCard';
import type { PlacedCard } from '@/app/lib/galaxyLayout';

// One card on the board, in each of the states it can actually be in.
//
// Two of the assertions below are STRUCTURAL rather than visual, and both are
// here because both already happened once and neither is visible to a type
// checker or to a screenshot: the card's root must not be a `button`, and it
// must not carry `role="button"`. What they cost is described where they are
// asserted.

afterEach(cleanup);

const card = (
  over: Partial<PlacedCard> & Pick<PlacedCard, 'kind' | 'label'>,
): PlacedCard => ({
  id: 'c1',
  themeId: 't1',
  detail: null,
  status: 'open',
  choices: null,
  imageUrl: null,
  imageAlt: null,
  diagram: null,
  hue: 318,
  x: 0,
  y: 0,
  w: 300,
  ...over,
});

const noop = () => {};

describe('QuestionCard — an open question', () => {
  // An explicit product requirement, and nothing else defended it: an
  // unanswered card must LOOK typeable before anyone has clicked anything. The
  // one thing a first-time user has to discover is that these are typed into,
  // so the affordance has to exist before the interaction that would reveal it.
  it('carries a field without having to be clicked first', () => {
    render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.getByText('Who is it for?')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeTruthy();
  });

  // The eyebrow comes from `cardEyebrow`, the same helper every other card in
  // the app uses. A second implementation of one design rule drifts, and the
  // rule it guarantees — an answered question stops calling itself Open — is
  // one this card would otherwise be re-deriving.
  it('names its state with the shared eyebrow vocabulary', () => {
    render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.getByText('Open')).toBeTruthy();
  });

  // Typing and sending, through the control a person actually uses.
  it('reports what was typed when it is saved', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    const box = document.querySelector('textarea')!;
    fireEvent.change(box, { target: { value: 'Practice managers' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onAnswer).toHaveBeenCalledWith('Practice managers');
  });

  // An empty answer is not an answer. Saving one would close the question
  // against a blank, which reads on the board as answered-with-nothing.
  it('will not save an empty answer', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.click(screen.getByText('Save'));

    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('QuestionCard — a shortlist', () => {
  const withChoices = card({
    kind: 'open-question',
    label: 'Which item goes missing most often?',
    choices: ['Owner call-backs', 'Re-checks', 'Lab results'],
  });

  // The structural regression that cost the most. The card's root was a
  // `button` first, which is invalid HTML — a button may not contain other
  // buttons, so the parser HOISTS the inner ones out of it and they stop being
  // clickable. The options silently became decoration.
  it('renders its options as real buttons, not decoration', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    for (const label of ['Owner call-backs', 'Re-checks', 'Lab results']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  // Picking one answers immediately: a chosen option is already the whole
  // answer, and asking someone to confirm it adds a step carrying no
  // information.
  it('answers with an option the moment one is picked', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Re-checks' }));

    expect(onAnswer).toHaveBeenCalledWith('Re-checks');
  });

  // Every list the partner writes is a guess about what you might say, and the
  // guess must never be the only thing you are allowed to say. The way past the
  // list has to be present and named in words — it was a grey box captioned
  // "Other…" jammed against the last option, which read as one more option.
  it('always offers a way to say something the list does not contain', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(
      screen.getByRole('button', { name: /say something else/i }),
    ).toBeTruthy();
  });

  // The card shows EITHER the options or the free-text box. Stacking both
  // overflowed the card's fixed height, which clipped the field and pushed its
  // only submit hint outside the card entirely.
  it('swaps the options for a text box rather than stacking them', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(document.querySelector('textarea')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /say something else/i }));

    expect(document.querySelector('textarea')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Re-checks' })).toBeNull();
  });

  // Opening the box must not be a one-way door — the options are still the
  // likeliest answers, and someone who opened it to look should get them back.
  it('gives the options back when the free-text box is cancelled', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /say something else/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Re-checks' })).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  // A first answer on a card with no options has nothing to go back to, so
  // offering Cancel there would be a control that does nothing.
  it('offers no Cancel when there is nothing to cancel back to', () => {
    render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('QuestionCard — an answered question', () => {
  const answered = card({
    kind: 'open-question',
    label: 'Which item goes missing most often?',
    detail: 'Owner call-backs.',
    status: 'answered',
  });

  // Your words are the content and the question becomes their label — that
  // inversion is what makes an answered card read as a statement rather than as
  // a form with the fields missing.
  it('shows the answer with the question demoted to a label', () => {
    render(
      <QuestionCard card={answered} focused={false} onFocus={noop} onAnswer={noop} />,
    );

    expect(screen.getByText('Owner call-backs.')).toBeTruthy();
    expect(
      screen.getByText('Which item goes missing most often?'),
    ).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  // An answer is a thought at a moment, and thinking is what this board is for.
  // The pencil is the whole of what makes an answer revisable.
  it('returns to an editable box through the pencil', () => {
    render(
      <QuestionCard card={answered} focused={false} onFocus={noop} onAnswer={noop} />,
    );

    fireEvent.click(screen.getByLabelText('Edit this answer'));

    const box = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(box).toBeTruthy();
    // Pre-filled with what was said before: the pencil is for amending an
    // answer, and an empty box would make it retyping instead.
    expect(box.value).toBe('Owner call-backs.');
  });
});

describe('QuestionCard — an insight', () => {
  // The eyebrow reads the word for the KIND rather than a generic label, which
  // is what lets the board be read without a legend.
  it('names the kind it is', () => {
    render(
      <QuestionCard
        card={card({
          kind: 'assumption',
          label: 'The receptionist is the informal system',
          status: 'answered',
        })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.getByText('Assumption')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  // The bug this card had: `approach` is not an insight KIND, so a card
  // carrying a diagram fell through to the answered-question branch and the
  // diagram — the entire content of the card — was never drawn, while the
  // layout had already given it the wide column.
  it('draws a diagram it carries even when its kind is not an insight kind', () => {
    render(
      <QuestionCard
        card={card({
          kind: 'approach',
          label: 'A handover list that survives the shift',
          status: 'answered',
          diagram: { steps: ['Vet promises a call-back', 'It joins the list'] },
        })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.getByText('Vet promises a call-back')).toBeTruthy();
    expect(screen.getByText('It joins the list')).toBeTruthy();
    expect(screen.getByText('Shape')).toBeTruthy();
  });

  // The same hole, on the image side: a reference card exists so someone can
  // LOOK at the thing.
  it('draws a picture it carries even when its kind is not an insight kind', () => {
    render(
      <QuestionCard
        card={card({
          kind: 'approach',
          label: 'The whiteboard as it is today',
          status: 'answered',
          imageUrl: 'https://example.test/whiteboard.png',
          imageAlt: 'A whiteboard, half wiped',
        })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.getByAltText('A whiteboard, half wiped')).toBeTruthy();
    expect(screen.getByText('Reference')).toBeTruthy();
  });
});

describe('QuestionCard — structure', () => {
  // Regression one. A `button` may not contain the option pills and the pencil;
  // the parser hoists them out, leaving them unclickable. The card is a
  // CONTAINER — the controls inside it are what should be buttons.
  it('is not itself a button', () => {
    const { container } = render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect((container.firstElementChild as HTMLElement).tagName).not.toBe(
      'BUTTON',
    );
  });

  // Regression two, and the subtler one: `role="button"` fixed the markup but
  // not the meaning. An element's accessible name is computed from its
  // contents, so the card announced itself as a button named after its own
  // entire text — swallowing its controls into one label and producing
  // ambiguous matches for assistive technology and for tests alike.
  it('does not announce itself as a button either', () => {
    const { container } = render(
      <QuestionCard
        card={card({
          kind: 'open-question',
          label: 'Who is it for?',
          choices: ['Practice managers'],
        })}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(
      (container.firstElementChild as HTMLElement).getAttribute('role'),
    ).not.toBe('button');
    // The consequence, asserted directly: exactly one thing here is named
    // "Practice managers", and it is the pill.
    expect(screen.getAllByRole('button', { name: 'Practice managers' })).toHaveLength(
      1,
    );
  });

  // Clicking the card brings it into focus — a convenience on top of the real
  // controls, which is why it takes the click without taking a role.
  it('reports a click as a request for focus', () => {
    const onFocus = vi.fn();
    const { container } = render(
      <QuestionCard
        card={card({ kind: 'open-question', label: 'Who is it for?' })}
        focused={false}
        onFocus={onFocus}
        onAnswer={noop}
      />,
    );

    fireEvent.click(container.firstElementChild!);

    expect(onFocus).toHaveBeenCalled();
  });
});

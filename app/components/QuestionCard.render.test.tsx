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

    expect(onAnswer).toHaveBeenCalledWith('Practice managers', {
      picked: [],
      text: 'Practice managers',
    });
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

  // Picking one no longer ANSWERS. It used to, which made a shortlist a cage:
  // one option or nothing, and no way to qualify the one you took. Save is
  // what records, and until it is pressed nothing has been said.
  it('takes an option without answering on the spot', () => {
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

    expect(onAnswer).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Re-checks' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  // The change this card exists for. "Two of those" is an ordinary answer and
  // the card could not record it at all.
  it('records several options as one answer', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Owner call-backs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The SHORTLIST's order, not the order they were clicked — an answer that
    // read differently depending on which pill was tapped first would be one
    // answer wearing two faces.
    // And the parts are ordered by the same rule, so the structure recorded
    // beside the answer cannot disagree with the answer itself.
    expect(onAnswer).toHaveBeenCalledWith('Owner call-backs, Re-checks', {
      picked: ['Owner call-backs', 'Re-checks'],
      text: '',
    });
  });

  // Every list the partner writes is a guess about what you might say, and the
  // guess must never be the only thing you are allowed to say. The box is now
  // present ALONGSIDE the options rather than replacing them, so the two can
  // be combined instead of chosen between.
  it('offers the box for what the list does not contain, beside the list', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(document.querySelector('textarea')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-checks' })).toBeTruthy();
  });

  // What most real answers look like: one of the guesses, and the part the
  // guess missed. Neither half was sayable with the other before.
  it('joins the options taken to the words typed', () => {
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
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: 'and the Friday locum ones' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAnswer).toHaveBeenCalledWith(
      'Re-checks — and the Friday locum ones',
      { picked: ['Re-checks'], text: 'and the Friday locum ones' },
    );
  });

  // Save must not be gated on the FIELD when the answer is not only in the
  // field. Options taken with nothing typed is a complete answer.
  it('will not record a blank, but will record options alone', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onAnswer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Lab results' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onAnswer).toHaveBeenCalledWith('Lab results', {
      picked: ['Lab results'],
      text: '',
    });
  });

  // Not answering is a real answer to give. A board that only lets you proceed
  // by answering turns "I don't know yet" into a made-up answer, which the
  // partner cannot tell from a real one — and the question stays OPEN, so the
  // bar keeps counting it and it comes round again.
  it('offers a way past a question without answering it', () => {
    const onSkip = vi.fn();
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  // An isolated fixture has nowhere to move on TO, and a Skip that goes
  // nowhere is worse than no Skip at all.
  it('offers no Skip where there is nowhere to skip to', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  // A first answer has nothing to go back to, so offering Cancel there would
  // be a control that does nothing.
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

  // The card turns over the instant it is answered, before the map has caught
  // up. Answering writes to the shared log and the board re-renders from the
  // server when the revision rises — a round trip — so without this the card
  // someone just answered still looks unanswered, which reads as the board
  // having eaten the answer.
  it('shows the answer on the card immediately, before the map catches up', () => {
    render(
      <QuestionCard
        card={withChoices}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lab results' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The node is still `open` — nothing about the card's props changed — and
    // the card is showing the answer anyway.
    expect(screen.getByText('Lab results')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
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

describe('QuestionCard — reopening an answer', () => {
  const shortlist = ['Owner call-backs', 'Re-checks', 'Lab results'];
  const reopened = (detail: string) =>
    card({
      kind: 'open-question',
      label: 'Which handover item goes missing most often?',
      choices: shortlist,
      detail,
      status: 'answered',
    });

  const pressed = () =>
    Array.from(document.querySelectorAll('button[aria-pressed="true"]')).map(
      (b) => b.textContent,
    );

  // The whole point of the change. A compound answer used to reopen with every
  // option unchecked and the entire sentence dumped into the box, so amending
  // one choice out of two meant retyping the rest from memory.
  it('shows the options that were taken as taken', () => {
    render(
      <QuestionCard
        card={reopened('Owner call-backs, Re-checks — on Fridays')}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit this answer'));

    expect(pressed()).toEqual(['Owner call-backs', 'Re-checks']);
  });

  // The options passed over stay on the card, unchecked. Reopening an answer
  // is a chance to reconsider it, which requires the rejected options to still
  // be there to take.
  it('still offers the options that were passed over', () => {
    render(
      <QuestionCard
        card={reopened('Owner call-backs, Re-checks — on Fridays')}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit this answer'));

    const lab = screen.getByText('Lab results');
    expect(lab.getAttribute('aria-pressed')).toBe('false');
  });

  // The typed half comes back on its own, WITHOUT the options fused to the
  // front of it — otherwise saving again would record them twice.
  it('puts only the typed words back in the box', () => {
    render(
      <QuestionCard
        card={reopened('Owner call-backs, Re-checks — on Fridays')}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit this answer'));

    const box = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(box.value).toBe('on Fridays');
  });

  // An answer recorded before any of this existed. It must open as written
  // words with nothing checked — guessing which pills a sentence meant would
  // silently drop part of what somebody said.
  it('opens a legacy answer as written words with nothing taken', () => {
    render(
      <QuestionCard
        card={reopened('Owner call-backs. Though the porters see it first')}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit this answer'));

    expect(pressed()).toEqual([]);
    const box = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(box.value).toBe('Owner call-backs. Though the porters see it first');
  });

  // Reopening and saving unchanged must record what was already there. A round
  // trip that quietly rewrote the answer would make the pencil destructive.
  it('records the same answer when it is reopened and saved unchanged', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={reopened('Owner call-backs, Re-checks — on Fridays')}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit this answer'));
    fireEvent.click(screen.getByText('Save'));

    expect(onAnswer).toHaveBeenCalledWith(
      'Owner call-backs, Re-checks — on Fridays',
      { picked: ['Owner call-backs', 'Re-checks'], text: 'on Fridays' },
    );
  });

  // The parts travel with the answer so the log keeps what the string cannot
  // always give back — whether a comma was a separator or something typed.
  it('reports the answer taken apart alongside the text', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={card({
          kind: 'open-question',
          label: 'Which handover item goes missing most often?',
          choices: shortlist,
        })}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );
    fireEvent.click(screen.getByText('Re-checks'));
    fireEvent.click(screen.getByText('Save'));

    expect(onAnswer).toHaveBeenCalledWith('Re-checks', {
      picked: ['Re-checks'],
      text: '',
    });
  });

  // Enter is a SECOND entry point into the same save, and the composer that
  // owns it did not change — but what saving MEANS did. A keyboard answer must
  // record the options taken alongside the words typed, exactly as the button
  // does, or answering without reaching for the mouse would quietly drop half
  // the answer.
  it('saves the options and the words together from the keyboard', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={card({
          kind: 'open-question',
          label: 'Which handover item goes missing most often?',
          choices: shortlist,
        })}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.click(screen.getByText('Owner call-backs'));
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: 'and the Friday locum ones' },
    });
    fireEvent.keyDown(document.querySelector('textarea')!, { key: 'Enter' });

    expect(onAnswer).toHaveBeenCalledWith(
      'Owner call-backs — and the Friday locum ones',
      { picked: ['Owner call-backs'], text: 'and the Friday locum ones' },
    );
  });

  // Shift+Enter is a newline, not a save. A question worth a shortlist is often
  // worth a sentence too, and losing a paragraph to the send key would make the
  // box unusable for the qualification it exists to hold.
  it('does not save on shift+enter, which is a newline', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        card={card({
          kind: 'open-question',
          label: 'Which handover item goes missing most often?',
          choices: shortlist,
        })}
        focused={false}
        onFocus={noop}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.click(screen.getByText('Owner call-backs'));
    fireEvent.keyDown(document.querySelector('textarea')!, {
      key: 'Enter',
      shiftKey: true,
    });

    expect(onAnswer).not.toHaveBeenCalled();
  });

  // A compound answer is systematically longer than the single option this
  // face was built for, and the card is a fixed size on the board — so the
  // text is clamped rather than allowed to push the pencil off the bottom.
  it('clamps a long answer rather than letting it overflow the card', () => {
    render(
      <QuestionCard
        card={reopened(
          'Owner call-backs, Re-checks, Lab results — and medication changes on Fridays, though the evening vet usually catches those first',
        )}
        focused={false}
        onFocus={noop}
        onAnswer={noop}
      />,
    );

    const shown = screen.getByText(/and medication changes on Fridays/);
    expect(shown.className).toContain('line-clamp');
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

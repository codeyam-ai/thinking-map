// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BoardChat from './BoardChat';
import type { ExchangeEvent } from '@/app/lib/exchange';

// The chat, over the whole map.
//
// The panel's `line` mapper makes an editorial decision that is invisible in
// the code's behaviour until somebody "fixes" it: `node.added`, `theme.added`
// and `phase.set` deliberately produce NOTHING, because they are things you can
// SEE on the board and narrating them would make the conversation a changelog
// of a picture the person is already looking at. That decision is what most of
// this file defends.

afterEach(cleanup);

const at = (
  revision: number,
  kind: ExchangeEvent['kind'],
  origin: ExchangeEvent['origin'],
  payload: unknown,
): ExchangeEvent => ({
  id: `e${revision}`,
  revision,
  kind,
  origin,
  payload,
  createdAt: new Date(0),
});

describe('BoardChat', () => {
  // The two sides of the exchange, each on its own side of the panel. Without
  // this a transcript is a wall of text with no way to tell who said what.
  it('renders what each side said', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.note', 'user', { text: 'The whiteboard is not the problem.' }),
          at(2, 'agent.note', 'agent', { text: 'Then what falls through?' }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('The whiteboard is not the problem.')).toBeTruthy();
    expect(screen.getByText('Then what falls through?')).toBeTruthy();
  });

  // An answer belongs in the conversation as the words the person said, not as
  // a reference to the card it closed — the card already shows that.
  it('renders an answer as the words that were said', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.answer', 'user', {
            answers: [{ id: 'n1', answer: 'Owner call-backs' }],
          }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('Owner call-backs')).toBeTruthy();
  });

  // The recorded shape is `{ id, text }` per question — see the `question.asked`
  // write in `toolRuntime`. Stringifying the object gave EVERY agent-asked
  // question the bubble "[object Object]", which is the whole of what the
  // partner said arriving as noise.
  it('renders an asked question as its words, not as its object', () => {
    render(
      <BoardChat
        events={[
          at(1, 'question.asked', 'agent', {
            questions: [{ id: 'q1', text: 'Which item goes missing most often?' }],
          }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Which item goes missing most often?'),
    ).toBeTruthy();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  // A log written by an older or hand-rolled caller should degrade to its words
  // rather than to noise — it costs one branch and the alternative is the same
  // failure again from a different direction.
  it('still reads a question recorded as a bare string', () => {
    render(
      <BoardChat
        events={[
          at(1, 'question.asked', 'agent', { questions: ['Who owns a call-back?'] }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('Who owns a call-back?')).toBeTruthy();
  });

  // The editorial rule, stated directly. These three kinds are the board
  // MOVING; repeating them here would turn the conversation into a debug log.
  it('says nothing about the events you can already see on the board', () => {
    render(
      <BoardChat
        events={[
          at(1, 'node.added', 'agent', { id: 'n1', kind: 'open-question' }),
          at(2, 'theme.added', 'agent', { id: 't1', label: 'Who is holding it' }),
          at(3, 'phase.set', 'agent', { phase: 'explore' }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.queryByText(/who is holding it/i)).toBeNull();
    expect(screen.queryByText(/explore/i)).toBeNull();
    expect(screen.queryByText(/n1/)).toBeNull();
  });

  // The mixed case, which is the real one: a log is never all conversation or
  // all board movement, and the filter has to hold while both are present.
  it('keeps the conversation when board events are mixed into the log', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.note', 'user', { text: 'It is the call-backs.' }),
          at(2, 'theme.added', 'agent', { id: 't1', label: 'Who is holding it' }),
          at(3, 'agent.note', 'agent', { text: 'Then who owns one?' }),
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('It is the call-backs.')).toBeTruthy();
    expect(screen.getByText('Then who owns one?')).toBeTruthy();
    expect(screen.queryByText(/who is holding it/i)).toBeNull();
  });

  // The state every new board starts in. An empty conversation must read as
  // inviting rather than broken — it is the first thing anyone sees, so it is
  // the one state that must not look like a failure to load.
  it('is present and usable with nothing said yet', () => {
    render(<BoardChat events={[]} onSend={vi.fn()} />);

    expect(document.querySelector('input')).toBeTruthy();
  });

  // A log of ONLY board-visible events is, as far as the conversation goes,
  // an empty one — and must render like one rather than as an empty scroller.
  it('reads as empty when the log holds only board-visible events', () => {
    render(
      <BoardChat
        events={[at(1, 'node.added', 'agent', { id: 'n1', kind: 'goal' })]}
        onSend={vi.fn()}
      />,
    );

    expect(document.querySelector('input')).toBeTruthy();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  // The panel is where you say something that applies to the whole map rather
  // than to whichever card is nearest — so sending has to work.
  it('reports what was typed into it', () => {
    const onSend = vi.fn();
    render(<BoardChat events={[]} onSend={onSend} />);

    const box = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'Change direction — it is triage.' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Change direction — it is triage.');
  });

  // An empty send would post a blank turn into the transcript, which reads as
  // the person having said nothing on purpose.
  it('does not send an empty message', () => {
    const onSend = vi.fn();
    render(<BoardChat events={[]} onSend={onSend} />);

    const box = document.querySelector('input') as HTMLInputElement;
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });
});

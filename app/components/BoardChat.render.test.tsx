// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BoardChat from './BoardChat';
import type { ExchangeEvent } from '@/app/lib/exchange';
import type { GalaxyNodeInput } from '@/app/lib/galaxyLayout';
import { themeColor } from '@/app/lib/themeHue';

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

/** jsdom normalises `hsl(...)` in `style.background`, so compare like for like:
 *  render the expectation through the same parser the browser used. */
function asBrowserColor(css: string): string {
  const probe = document.createElement('div');
  probe.style.background = css;
  return probe.style.background;
}

/** A question card on the map, which is what an answer's node id resolves to. */
const node = (id: string, themeId: string | null): GalaxyNodeInput => ({
  id,
  themeId,
  kind: 'open-question',
  label: 'A question',
  detail: null,
  status: 'answered',
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

  // An answer wears the colour of the card it answered. The panel is what wires
  // the log to the map: without the nodes and themes reaching it, every answer
  // would render neutral and the rule would silently not exist.
  it('colours an answer with the theme of the card it answered', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.answer', 'user', {
            answers: [{ id: 'n-who', answer: 'A rota of two or three' }],
          }),
        ]}
        onSend={vi.fn()}
        themes={[{ id: 't-who', label: 'Who turns up', hue: 318, order: 0 }]}
        nodes={[node('n-who', 't-who')]}
      />,
    );

    const bubble = screen.getByText('A rota of two or three');
    expect(bubble.style.background).toBe(asBrowserColor(themeColor(318)));
  });

  // The case the old reducer could not express: one event closing two cards was
  // joined into a single bubble with " · ", which would need one background to
  // be two colours.
  it('splits one answer event across two cards into two coloured bubbles', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.answer', 'user', {
            answers: [
              { id: 'n-who', answer: 'A rota' },
              { id: 'n-risk', answer: 'Nobody has asked yet' },
            ],
          }),
        ]}
        onSend={vi.fn()}
        themes={[
          { id: 't-who', label: 'Who turns up', hue: 318, order: 0 },
          { id: 't-risk', label: 'When a repair fails', hue: 96, order: 1 },
        ]}
        nodes={[node('n-who', 't-who'), node('n-risk', 't-risk')]}
      />,
    );

    const first = screen.getByText('A rota');
    const second = screen.getByText('Nobody has asked yet');
    expect(screen.queryByText(/A rota · Nobody/)).toBeNull();
    expect(first.style.background).not.toBe(second.style.background);
  });

  // An answer to a card since deleted must render as an ordinary bubble, not as
  // an error and not in a colour that lies about which theme it belongs to.
  it('renders an answer whose card is gone without breaking', () => {
    render(
      <BoardChat
        events={[
          at(1, 'user.answer', 'user', {
            answers: [{ id: 'n-deleted', answer: 'Said before it vanished' }],
          }),
        ]}
        onSend={vi.fn()}
        themes={[{ id: 't-who', label: 'Who turns up', hue: 318, order: 0 }]}
        nodes={[node('n-who', 't-who')]}
      />,
    );

    const bubble = screen.getByText('Said before it vanished');
    expect(bubble.style.background).not.toBe(asBrowserColor(themeColor(318)));
  });

  // Collapsing hides the transcript and KEEPS the input row — that is what
  // makes it different from closing. "The chat is always here" is a claim the
  // input row makes, so collapsing must not withdraw it.
  it('hides the transcript but keeps the input when collapsed', () => {
    render(
      <BoardChat
        events={[at(1, 'user.note', 'user', { text: 'Still here somewhere' })]}
        onSend={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Hide the conversation'));

    expect(screen.queryByText('Still here somewhere')).toBeNull();
    expect(document.querySelector('input')).toBeTruthy();
  });

  // Closing has to genuinely uncover the board — that is the whole reason the
  // state exists — so the input row goes too.
  it('leaves only a way back in when closed', () => {
    render(
      <BoardChat
        events={[at(1, 'user.note', 'user', { text: 'Still here somewhere' })]}
        onSend={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Close the conversation'));

    expect(screen.queryByText('Still here somewhere')).toBeNull();
    expect(document.querySelector('input')).toBeNull();
    expect(screen.getByRole('button', { name: /chat/i })).toBeTruthy();
  });

  // Closing must not be a one-way door: nobody closes a thing they cannot get
  // back, so the pill has to restore the conversation intact.
  it('brings the conversation back from closed', () => {
    render(
      <BoardChat
        events={[at(1, 'user.note', 'user', { text: 'Still here somewhere' })]}
        onSend={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Close the conversation'));
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));

    expect(screen.getByText('Still here somewhere')).toBeTruthy();
    expect(document.querySelector('input')).toBeTruthy();
  });

  // A turn that lands behind a collapsed panel is indistinguishable from one
  // that did not land at all.
  it('reopens itself when you say something while collapsed', () => {
    const onSend = vi.fn();
    render(
      <BoardChat
        events={[at(1, 'user.note', 'user', { text: 'Earlier remark' })]}
        onSend={onSend}
      />,
    );

    fireEvent.click(screen.getByLabelText('Hide the conversation'));
    const box = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'And another thing' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('And another thing');
    expect(screen.getByText('Earlier remark')).toBeTruthy();
  });

  // The channel says what it is. The code has always documented this input as
  // the slot for everything the partner did not think to ask about; until the
  // label arrived, nothing on screen said so.
  it('names itself as the general channel', () => {
    render(<BoardChat events={[]} onSend={vi.fn()} />);

    expect(screen.getByText(/^chat$/i)).toBeTruthy();
  });
});

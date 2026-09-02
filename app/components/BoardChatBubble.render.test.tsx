// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BoardChatBubble from './BoardChatBubble';
import { themeColor } from '@/app/lib/themeHue';

// The colour rule, which is the whole reason this component exists. Colour here
// is not decoration: it is the visible difference between answering a specific
// card and saying something about the map as a whole. These tests assert
// against `themeColor` rather than against a hex, because the point is that one
// function decides what a theme looks like — a card, its connector, its cluster
// label and its answers cannot be allowed to drift apart.

afterEach(cleanup);

/** jsdom normalises `hsl(...)` in `style.background`, so compare like for
 *  like: render the expectation through the same parser the browser used. */
function asBrowserColor(css: string): string {
  const probe = document.createElement('div');
  probe.style.background = css;
  return probe.style.background;
}

describe('BoardChatBubble', () => {
  // An answer wears its card's colour. This is the rule in one assertion.
  it('paints an answer in the hue of the theme it belongs to', () => {
    render(<BoardChatBubble who="you" text="A rota of two or three" hue={318} />);

    const bubble = screen.getByText('A rota of two or three');
    expect(bubble.style.background).toBe(asBrowserColor(themeColor(318)));
  });

  // Two answers to differently-themed cards must not look alike, or the
  // transcript is back to one undifferentiated column.
  it('gives two themes two different colours', () => {
    const { container } = render(
      <>
        <BoardChatBubble who="you" text="First" hue={318} />
        <BoardChatBubble who="you" text="Second" hue={96} />
      </>,
    );

    const [a, b] = Array.from(container.querySelectorAll('span'));
    expect(a.style.background).not.toBe(b.style.background);
  });

  // A general note is about the whole map, so it has no theme to wear. It must
  // not borrow one — a default colour would claim a theme the remark does not
  // belong to.
  it('leaves a general note uncoloured', () => {
    render(<BoardChatBubble who="you" text="Change direction" />);

    const bubble = screen.getByText('Change direction');
    expect(bubble.style.background).not.toBe(asBrowserColor(themeColor(318)));
  });

  // The deleted-card case: an answer to a node that is gone renders as an
  // ordinary bubble rather than as an error or as a colour that lies.
  it('renders an answer with no resolvable theme exactly like a note', () => {
    const { container: withNode } = render(
      <BoardChatBubble who="you" text="Same" hue={undefined} />,
    );
    const answer = withNode.querySelector('span')!.style.background;

    cleanup();

    const { container: note } = render(<BoardChatBubble who="you" text="Same" />);
    expect(note.querySelector('span')!.style.background).toBe(answer);
  });

  // Colour now carries meaning that alignment used to carry alone, and the
  // panel is narrow — so the partner's turn still has to read as theirs.
  it("keeps the partner's turn visually distinct from yours", () => {
    const { container } = render(
      <>
        <BoardChatBubble who="partner" text="Theirs" />
        <BoardChatBubble who="you" text="Yours" />
      </>,
    );

    const [theirs, mine] = Array.from(container.querySelectorAll('span'));
    expect(theirs.style.background).not.toBe(mine.style.background);
  });

  // Sides, kept: the partner on the left, you on the right.
  it('puts the two sides on opposite sides of the panel', () => {
    const { container } = render(
      <>
        <BoardChatBubble who="partner" text="Theirs" />
        <BoardChatBubble who="you" text="Yours" />
      </>,
    );

    const rows = Array.from(container.querySelectorAll('div'));
    expect(rows[0].className).toContain('justify-start');
    expect(rows[1].className).toContain('justify-end');
  });
});

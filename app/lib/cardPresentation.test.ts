import { describe, expect, it } from 'vitest';
import {
  isAnsweredCard,
  isInsightCard,
  isOpenCard,
  type CardFace,
} from './cardPresentation';

// The rule that decides which of its three faces a card shows.
//
// Worth testing on its own because the failure it guards against is invisible
// to a type checker and to a screenshot taken of the wrong scenario: a card
// that takes the WIDE column and then renders none of the content that earned
// it. That is not a cosmetic slip — the diagram is the whole of what the card
// was for, and it simply was not drawn.

const card = (over: Partial<CardFace> & Pick<CardFace, 'kind'>): CardFace => ({
  status: 'open',
  ...over,
});

describe('isInsightCard', () => {
  // The kind list is the half that was always right. Pinned so that removing a
  // kind from it — which silently turns a settled claim into an editable
  // question with a pencil on it — shows up here rather than on the board.
  it('recognises the kinds that are the partner thinking, not asking', () => {
    for (const kind of [
      'assumption',
      'finding',
      'gap',
      'risk',
      'pro',
      'direction',
      'known',
      'unknown',
    ]) {
      expect(isInsightCard(card({ kind }))).toBe(true);
    }
  });

  // The base case, and the one every other clause must not swallow: a bare
  // open question carries no content and is not an insight kind, so it stays a
  // question and keeps its field.
  it('treats a plain question as a question', () => {
    expect(isInsightCard(card({ kind: 'open-question' }))).toBe(false);
  });

  // The regression this function exists for. `approach` is not an insight kind,
  // so before the carried-content clause an approach with a diagram fell
  // through to the answered-question branch and its diagram was never drawn —
  // while `widthFor` had already given it the 420px wide column.
  it('counts a card carrying a diagram, whatever its kind', () => {
    expect(
      isInsightCard(card({ kind: 'approach', diagram: { steps: ['a', 'b'] } })),
    ).toBe(true);
    expect(isInsightCard(card({ kind: 'slice', diagram: { steps: ['a'] } }))).toBe(
      true,
    );
  });

  // The image half of the same clause. A reference card exists so somebody can
  // LOOK at the thing; drawn as an answered question the picture is not shown
  // at all, which loses the entire point of the card.
  it('counts a card carrying a picture, whatever its kind', () => {
    expect(
      isInsightCard(card({ kind: 'approach', imageUrl: 'https://x/y.png' })),
    ).toBe(true);
  });

  // The clause must not fire on the ABSENCE of content. A null image is the
  // ordinary case on almost every card, and if it read as "carries something"
  // every question on the board would render as an insight.
  it('is not tripped by null or empty carried content', () => {
    expect(
      isInsightCard(card({ kind: 'open-question', imageUrl: null, diagram: null })),
    ).toBe(false);
    expect(isInsightCard(card({ kind: 'open-question', imageUrl: '' }))).toBe(
      false,
    );
  });
});

describe('isAnsweredCard', () => {
  // What makes a card show your words as its content, with the question demoted
  // to a label above them. Only a question can reach this state — it is the
  // presence of an answer that earns it, not the status string alone.
  it('is an answered question and nothing else', () => {
    expect(isAnsweredCard(card({ kind: 'open-question', status: 'answered' }))).toBe(
      true,
    );
    expect(isAnsweredCard(card({ kind: 'open-question', status: 'open' }))).toBe(
      false,
    );
  });

  // An insight carries `status: 'answered'` all over the seed data — it is how
  // a settled claim is marked. It is still not something YOU answered, and
  // drawing it with a pencil would invite editing the partner's own thinking as
  // though it were your reply.
  it('never treats a settled insight as your answer', () => {
    expect(isAnsweredCard(card({ kind: 'assumption', status: 'answered' }))).toBe(
      false,
    );
    expect(
      isAnsweredCard(
        card({ kind: 'approach', status: 'answered', diagram: { steps: ['a'] } }),
      ),
    ).toBe(false);
  });
});

describe('the three faces', () => {
  // Exactly one is true for any card. If two could be, the card would render
  // two bodies stacked; if none, it would render an empty box.
  it('are mutually exclusive and total', () => {
    const cards: CardFace[] = [
      card({ kind: 'open-question' }),
      card({ kind: 'open-question', status: 'answered' }),
      card({ kind: 'assumption', status: 'answered' }),
      card({ kind: 'approach', diagram: { steps: ['a'] } }),
      card({ kind: 'approach' }),
      card({ kind: 'slice', status: 'answered' }),
    ];

    for (const c of cards) {
      const faces = [isOpenCard(c), isAnsweredCard(c), isInsightCard(c)];
      expect(faces.filter(Boolean)).toHaveLength(1);
    }
  });
});

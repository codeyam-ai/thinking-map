// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ThemeParticles from './ThemeParticles';

// The dust around a galaxy's hub.
//
// Its animation is CSS and is deliberately not tested. What IS load-bearing is
// that the field is DETERMINISTIC: every position, size and orbit comes from a
// PRNG seeded off the theme's hue, so the server and the client draw the same
// dust. Lose that and the failure is not cosmetic — React finds a different
// tree than the one the server sent and throws a hydration error on a board
// that otherwise looks fine.
//
// The generator itself is not exported, which is the right level to test at
// anyway: what matters is the markup it produces, not the numbers on the way.

afterEach(cleanup);

/** Every particle's geometry, in order — the whole of what the seed decides. */
const field = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('span')).map((s) => s.getAttribute('style'));

describe('ThemeParticles', () => {
  // The property the whole component rests on: same hue in, same field out.
  // Two renders are what a server pass and a client pass amount to.
  it('draws an identical field from the same hue', () => {
    const a = render(<ThemeParticles hue={318} />);
    const first = field(a.container);
    cleanup();
    const b = render(<ThemeParticles hue={318} />);

    expect(field(b.container)).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  // A different galaxy must look like a different galaxy. If the seed were
  // ignored, every cluster on the board would wear the same dust in a different
  // colour — which reads as one cluster drawn repeatedly.
  it('draws a different field for a different hue', () => {
    const a = render(<ThemeParticles hue={318} />);
    const first = field(a.container);
    cleanup();
    const b = render(<ThemeParticles hue={96} />);

    expect(field(b.container)).not.toEqual(first);
  });

  // Hue 0 is a real place on the colour wheel and a falsy value in JavaScript.
  // A truthiness check anywhere in the chain would quietly send it somewhere
  // else, so it has to produce a field like any other hue.
  it('treats hue zero as a hue rather than as absent', () => {
    const { container } = render(<ThemeParticles hue={0} />);

    expect(field(container).length).toBeGreaterThan(0);
  });

  // Muting is what keeps the dust from competing with a card being read. It
  // changes only the opacity of the whole field — the particles themselves must
  // not move, or focusing a card would make the galaxy reshuffle behind it.
  it('dims without redrawing the field', () => {
    const a = render(<ThemeParticles hue={233} />);
    const first = field(a.container);
    cleanup();
    const b = render(<ThemeParticles hue={233} muted />);

    expect(field(b.container)).toEqual(first);
    expect(
      (b.container.firstElementChild as HTMLElement).getAttribute('style'),
    ).toContain('opacity');
  });

  // It is decoration sitting behind the thing you are reading, so it must not
  // reach the accessibility tree or take a click meant for a card.
  it('stays out of the way of the board', () => {
    const { container } = render(<ThemeParticles hue={318} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
  });
});

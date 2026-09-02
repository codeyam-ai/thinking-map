import { describe, expect, it } from 'vitest';
import { hueForIndex, themeColor } from './themeHue';

// Colour is not decoration on this board — it is how you know which galaxy you
// are looking at once the map is zoomed out far enough that the labels have
// stopped being readable. So what is worth testing is not the constant but the
// PROMISE: that however many themes an idea turns out to need, no two of them
// come out looking the same.

describe('hueForIndex', () => {
  // The first three are written as literals into every board fixture. Pinning
  // them here is what stops the fixtures and the function drifting apart in
  // silence: a capture would still render, just in colours the palette no
  // longer produces.
  it('starts on the magenta the mockups were drawn around', () => {
    expect(hueForIndex(0)).toBe(318);
    expect(hueForIndex(1)).toBe(96);
    expect(hueForIndex(2)).toBe(233);
  });

  // Every CSS colour function reads a hue outside [0,360) as invalid rather
  // than as wrapping, so a theme past the fourth or fifth would simply fail to
  // paint. The wrap has to happen here.
  it('stays a whole number on the wheel however far around it goes', () => {
    for (let i = 0; i < 200; i++) {
      const h = hueForIndex(i);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  // A negative index should not be reachable, but a non-negative modulo costs
  // one expression and the alternative is a negative hue that paints nothing.
  it('does not produce a negative hue from a negative index', () => {
    for (const i of [-1, -5, -17]) {
      const h = hueForIndex(i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  // THE promise, and the whole reason the golden angle was chosen over slicing
  // the wheel into N: theme 11 has to be as findable as theme 1 was, without
  // anyone knowing in advance that there would be twelve. A fixed palette
  // cannot make this claim and a model picking "a nice pink" certainly cannot.
  it('keeps the first twelve themes mutually distinguishable', () => {
    const hues = Array.from({ length: 12 }, (_, i) => hueForIndex(i));

    // Distance around a circle, so 350 and 10 are twenty degrees apart rather
    // than three hundred and forty.
    const apart = (a: number, b: number) => {
      const d = Math.abs(a - b) % 360;
      return Math.min(d, 360 - d);
    };

    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        expect(apart(hues[i], hues[j])).toBeGreaterThan(15);
      }
    }
  });

  // Pure and total: the same index always gives the same colour, which is what
  // lets a theme's hue be recomputed on every render instead of stored, and
  // what makes the same map look identical on two screens.
  it('is deterministic', () => {
    for (const i of [0, 3, 7, 41]) {
      expect(hueForIndex(i)).toBe(hueForIndex(i));
    }
  });
});

describe('themeColor', () => {
  // The ordinary case is fully opaque, and an always-present `/ 1` would be
  // valid CSS that changed every colour string in the app for no reason.
  it('emits no alpha channel when the colour is opaque', () => {
    expect(themeColor(318)).toBe('hsl(318 74% 66%)');
  });

  // Translucency is how a connector and a focus ring sit behind their card
  // without a second colour being invented for them.
  it('uses the slash form when it is not', () => {
    expect(themeColor(318, { a: 0.42 })).toBe('hsl(318 74% 66% / 0.42)');
  });

  // One place decides what a theme looks like, so a card, its connector and its
  // cluster label cannot drift apart — which means the knobs have to work.
  it('carries saturation and lightness through', () => {
    expect(themeColor(96, { s: 70, l: 62 })).toBe('hsl(96 70% 62%)');
  });
});

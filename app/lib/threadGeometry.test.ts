import { describe, expect, it } from 'vitest';
import { curve, fanOrigins, threadPull } from './threadGeometry';

// The thread's shape is the one part of the drawing that is decided rather
// than measured, so it is the part that can be wrong in a way no screenshot
// makes obvious — a bend a few pixels too shallow just looks like a slightly
// worse picture.
describe('threadPull', () => {
  // A row gap of a few pixels still has to produce a visible bend; a straight
  // line between two rows reads as a table rule, not a thread.
  it('keeps a bend even when the two rows nearly touch', () => {
    expect(threadPull(0)).toBeGreaterThan(0);
    expect(threadPull(4)).toBe(threadPull(0));
  });

  // Past the cap the control points overshoot their own endpoints and the
  // curve loops back on itself.
  it('stops deepening once the gap is large', () => {
    expect(threadPull(400)).toBe(threadPull(4000));
  });

  // Between the two clamps the bend should track the gap, so a taller gap
  // gets a proportionally lazier curve rather than the same one stretched.
  it('scales with the gap between the clamps', () => {
    expect(threadPull(60)).toBeGreaterThan(threadPull(30));
  });
});

describe('curve', () => {
  // Both control points must sit directly below/above their endpoints. A
  // horizontal pull would bow the line into a rope slung between two cards
  // instead of the S-travel the design calls for.
  it('pulls its control points vertically, never sideways', () => {
    const d = curve(0, 0, 200, 100);
    // "M x1 y1 C cx1 cy1, cx2 cy2, x2 y2"
    const [, controls] = d.split(' C ');
    const [c1, c2] = controls!.split(', ');
    expect(c1!.split(' ')[0]).toBe('0');
    expect(c2!.split(' ')[0]).toBe('200');
  });

  // The path has to start and end exactly on the card edges it was measured
  // against, or the endpoint dot floats off the card.
  it('starts and ends on the points it was given', () => {
    expect(curve(10, 20, 30, 90)).toMatch(/^M 10 20 /);
    expect(curve(10, 20, 30, 90)).toMatch(/ 30 90$/);
  });
});

describe('fanOrigins', () => {
  // One child is not a fan. It should leave from the middle of the card, which
  // is what makes a single thread read as a straight drop.
  it('sends a lone thread from the centre of the card', () => {
    expect(fanOrigins(100, 200, 1)).toEqual([200]);
  });

  // The fan has to stay symmetric about the card's centre, or a parent with
  // three children looks like it is leaning.
  it('spreads the departures evenly about the centre', () => {
    const origins = fanOrigins(0, 300, 3);
    expect(origins).toHaveLength(3);
    expect(origins[1]).toBe(150);
    expect(150 - origins[0]!).toBeCloseTo(origins[2]! - 150);
  });

  // Left to right, so the caller's left-to-right children get non-crossing
  // threads — the whole reason the fan is ordered at all.
  it('returns the departures in left-to-right order', () => {
    const origins = fanOrigins(0, 300, 4);
    expect([...origins].sort((a, b) => a - b)).toEqual(origins);
  });

  // A thread leaving at a rounded corner looks like it is falling off the
  // card, so the fan stays inside the edge however many children there are.
  it('keeps the fan inside the card edge when there are many children', () => {
    const width = 220;
    const origins = fanOrigins(0, width, 12);
    expect(origins[0]).toBeGreaterThan(0);
    expect(origins[origins.length - 1]).toBeLessThan(width);
  });

  // A narrow card with two children must not produce a fan wider than itself,
  // which would put the departures outside the card entirely.
  it('never opens wider than a narrow card', () => {
    const origins = fanOrigins(0, 40, 2);
    expect(origins[0]).toBeGreaterThanOrEqual(0);
    expect(origins[1]).toBeLessThanOrEqual(40);
  });
});

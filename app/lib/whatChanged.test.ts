import { describe, expect, it } from 'vitest';
import { newSince } from './whatChanged';

const at = (id: string) => ({ id });

describe('newSince', () => {
  // Before you have looked at all, nothing is marked. Everything being new on
  // first sight is true and useless — the marker means "this arrived while you
  // were somewhere else", and on arrival you were not anywhere else.
  it('marks nothing when the far end has never been looked at', () => {
    expect(newSince(null, [at('a'), at('b')]).size).toBe(0);
  });

  // The case the whole marker exists for: the partner wrote at the far end
  // while the person was answering somewhere else, and nothing else on screen
  // would say so.
  it('marks what arrived since the last look', () => {
    const fresh = newSince(new Set(['a']), [at('a'), at('b')]);
    expect(fresh.has('b')).toBe(true);
    expect(fresh.has('a')).toBe(false);
  });

  // Going back to a far end that has not moved marks nothing at all. A badge
  // that persisted after you had looked would stop meaning anything.
  it('marks nothing when nothing has arrived', () => {
    expect(newSince(new Set(['a', 'b']), [at('a'), at('b')]).size).toBe(0);
  });

  // Something removed since the last look is not something new. The set is
  // what to MARK, so it can only ever contain things that are on screen.
  it('never marks something that is no longer there', () => {
    expect(newSince(new Set(['a', 'b']), [at('a')]).size).toBe(0);
  });
});

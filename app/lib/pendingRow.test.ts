import { describe, expect, it } from 'vitest';
import { SETTLE_AFTER_MS, pendingRow, type PendingRowInput } from './pendingRow';

// The shimmering row beneath a finished round is a PROMISE, and the page has no
// way to keep it: WebMCP is pull-only, so nothing here can start an agent's
// turn. That makes this module the place the feature is most able to lie, and
// these are the tests that stop it — the same job `askPresence.test` does for
// the ask composer.

const input = (over: Partial<PendingRowInput> = {}): PendingRowInput => ({
  roundCount: 2,
  openInNewestRound: 0,
  phase: 'map',
  status: 'unavailable',
  waitedMs: 0,
  ...over,
});

describe('pendingRow', () => {
  // The cards are the action while questions are open. A placeholder below them
  // would be the page reaching for something the person has not finished giving.
  it('hides while the newest round still has open questions', () => {
    expect(pendingRow(input({ openInNewestRound: 1 })).kind).toBe('hidden');
    expect(pendingRow(input({ openInNewestRound: 3 })).kind).toBe('hidden');
  });

  // Nothing has been drawn, so there is no round to reach past.
  it('hides when the map has no rounds at all', () => {
    expect(pendingRow(input({ roundCount: 0 })).kind).toBe('hidden');
  });

  // `next-steps` is where the loop ARRIVES. Reaching for a further round there
  // would promise a continuation the product does not have.
  it('hides at the end of the loop', () => {
    expect(pendingRow(input({ phase: 'next-steps' })).kind).toBe('hidden');
  });

  // The round is done and the poll may still bring a new one: this is the whole
  // point of the feature — the page moves before anybody asks it to.
  it('shimmers as soon as the round is answered', () => {
    expect(pendingRow(input()).kind).toBe('waiting');
  });

  // Bounded, not indefinite. A row that shimmered forever would be claiming an
  // agent was writing, which is the one thing this page can never know.
  it('stops shimmering once the wait runs out', () => {
    expect(pendingRow(input({ waitedMs: SETTLE_AFTER_MS - 1 })).kind).toBe(
      'waiting',
    );
    expect(pendingRow(input({ waitedMs: SETTLE_AFTER_MS })).kind).toBe(
      'settled',
    );
  });

  // The pending row also appears on a DAY-ONE map — a seed idea nobody has
  // picked up, with no answers on it at all — so no sentence may name answers
  // the person has not given. This is the assertion that keeps the wording
  // true in both cases rather than only in the end-of-round one.
  it('never claims answers exist, since a day-one map has none', () => {
    for (const status of ['unavailable', 'connected', 'working'] as const) {
      const r = pendingRow(input({ status, waitedMs: SETTLE_AFTER_MS }));
      expect(r.kind === 'settled' && /answer/i.test(r.note)).toBe(false);
    }
  });

  // The three sentences are the honest part, and they are genuinely different
  // claims — "has everything you have added" is only true of an agent whose
  // turn is running.
  it('says an agent has what you added only when one is actually in a turn', () => {
    const settled = pendingRow(
      input({ status: 'working', waitedMs: SETTLE_AFTER_MS }),
    );
    expect(settled.kind).toBe('settled');
    expect(settled.kind === 'settled' && settled.note).toMatch(/working/i);
  });

  // Attached but idle: it will see what is there when its turn comes round,
  // which is a weaker claim and has to read as one.
  it('says an attached agent is waiting for its turn, not working', () => {
    const settled = pendingRow(
      input({ status: 'connected', waitedMs: SETTLE_AFTER_MS }),
    );
    expect(settled.kind === 'settled' && settled.note).toMatch(/not in a turn/i);
    expect(settled.kind === 'settled' && settled.note).not.toMatch(/working/i);
  });

  // The state every preview and capture actually produces, and the one most at
  // risk of being quietly dressed up as one of the other two. It must never
  // claim an agent is there.
  it('says plainly that nothing can reach the page when nothing can', () => {
    const settled = pendingRow(
      input({ status: 'unavailable', waitedMs: SETTLE_AFTER_MS }),
    );
    expect(settled.kind === 'settled' && settled.note).toMatch(
      /no agent can reach this page/i,
    );
  });

  // Each status gets its OWN sentence — a shared one would make the distinction
  // above invisible on screen even though the logic drew it.
  it('gives each presence state a distinct sentence', () => {
    const notes = (['unavailable', 'connected', 'working'] as const).map((s) => {
      const r = pendingRow(input({ status: s, waitedMs: SETTLE_AFTER_MS }));
      return r.kind === 'settled' ? r.note : '';
    });
    expect(new Set(notes).size).toBe(3);
  });

  // Completion is read off the NEWEST round only, so a question abandoned three
  // rounds ago cannot hold the loop hostage — it stays answerable and stops
  // gating. The caller passes the newest round's count; this pins that the
  // module honours it rather than looking any wider.
  it('advances on the newest round alone, whatever older rounds left open', () => {
    expect(pendingRow(input({ roundCount: 9, openInNewestRound: 0 })).kind).toBe(
      'waiting',
    );
  });
});

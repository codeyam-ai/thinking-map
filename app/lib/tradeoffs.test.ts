import { describe, expect, it } from 'vitest';
import { readTradeoffs, tradeoffBullets } from './tradeoffs';

describe('readTradeoffs', () => {
  // The whole shape, round-tripped. Every field is optional, so this is the
  // only place the full set is asserted together.
  it('reads what a way forward would cost and what it would cost you', () => {
    expect(
      readTradeoffs(
        '{"effort":"About two days","cost":"Free","requires":["One classroom"],"betterWhen":"You already have a teacher","worseWhen":"You need parents in it"}',
      ),
    ).toEqual({
      effort: 'About two days',
      cost: 'Free',
      requires: ['One classroom'],
      betterWhen: 'You already have a teacher',
      worseWhen: 'You need parents in it',
    });
  });

  // Every field is optional. An agent that knows the effort but not the cost
  // should say the effort rather than inventing a cost to fill the shape.
  it('keeps a partial answer rather than demanding the whole shape', () => {
    expect(readTradeoffs('{"effort":"An afternoon"}')).toEqual({
      effort: 'An afternoon',
    });
  });

  // The same degrade-to-null contract the other JSON columns keep: a card that
  // cannot render its tradeoffs is still a thing worth trying, and one that
  // took the board down with it would not be.
  it('degrades anything unreadable to nothing at all', () => {
    expect(readTradeoffs('{not json')).toBeNull();
    expect(readTradeoffs('"a string"')).toBeNull();
    expect(readTradeoffs('[]')).toBeNull();
    expect(readTradeoffs(null)).toBeNull();
    expect(readTradeoffs('')).toBeNull();
  });

  // An object with nothing usable in it is nothing, not an empty panel. A card
  // that drew a "Tradeoffs" heading over no bullets would be announcing
  // thinking that had not happened.
  it('reads an object with nothing in it as nothing', () => {
    expect(readTradeoffs('{}')).toBeNull();
    expect(readTradeoffs('{"effort":"   "}')).toBeNull();
    expect(readTradeoffs('{"requires":[]}')).toBeNull();
  });

  // Each requirement gets its own bullet, so a blank one is a bullet with
  // nothing after it — a thing you either have or do not, unnamed.
  it('drops blank requirements rather than printing empty bullets', () => {
    expect(readTradeoffs('{"requires":["A teacher","","  "]}')).toEqual({
      requires: ['A teacher'],
    });
  });

  // These print in a fixed label column, where leading space is visible as a
  // value that does not line up with the one above it.
  it('trims what it keeps', () => {
    expect(readTradeoffs('{"effort":"  Two days  "}')).toEqual({
      effort: 'Two days',
    });
  });
});

describe('tradeoffBullets', () => {
  const full = {
    effort: 'About two days',
    cost: 'Free',
    requires: ['One classroom', 'Ten printed cards'],
    betterWhen: 'You already have a teacher',
    worseWhen: 'You need parents in it',
  };

  // A FEW bullets, not everything known. The card is a thing you scan while
  // comparing it against the one below it, and a card that printed all five
  // facts would be a paragraph in a list's clothing.
  it('shows a few up front and keeps the rest for digging in', () => {
    // Six bullets in `full`: effort, cost, two requirements, and the two
    // halves of the comparison. Two on the card, four behind the control.
    const { shown, hidden } = tradeoffBullets(full, 2);
    expect(shown).toHaveLength(2);
    expect(hidden).toHaveLength(4);
  });

  // Effort and cost lead, because those are the two that decide whether a
  // thing is worth reading further about at all.
  it('leads with what it takes and what it costs', () => {
    const { shown } = tradeoffBullets(full, 2);
    expect(shown[0]).toEqual({ label: 'Effort', value: 'About two days' });
    expect(shown[1]).toEqual({ label: 'Cost', value: 'Free' });
  });

  // One bullet per requirement rather than a comma-joined line: they are
  // separate things you either have or do not.
  it('gives each requirement its own bullet', () => {
    const { hidden } = tradeoffBullets(full, 2);
    expect(hidden).toContainEqual({ label: 'Needs', value: 'One classroom' });
    expect(hidden).toContainEqual({
      label: 'Needs',
      value: 'Ten printed cards',
    });
  });

  // The comparison the whole field exists for.
  it('carries what makes it better and worse than the alternatives', () => {
    const { hidden } = tradeoffBullets(full, 2);
    expect(hidden).toContainEqual({
      label: 'Better when',
      value: 'You already have a teacher',
    });
    expect(hidden).toContainEqual({
      label: 'Worse when',
      value: 'You need parents in it',
    });
  });

  // Nothing to dig into is not a broken expander — it is a card with two facts
  // on it, and the control has to know not to offer itself.
  it('has nothing hidden when everything already fits', () => {
    const { shown, hidden } = tradeoffBullets({ effort: 'A morning' }, 2);
    expect(shown).toHaveLength(1);
    expect(hidden).toHaveLength(0);
  });
});

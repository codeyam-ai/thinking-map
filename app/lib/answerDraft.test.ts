import { describe, expect, it } from 'vitest';
import { composeAnswer, toggleChoice } from './answerDraft';

describe('toggleChoice', () => {
  // Taking an option the person has not taken yet — the ordinary press.
  it('adds a choice that was not picked', () => {
    expect(toggleChoice([], 'Teachers')).toEqual(['Teachers']);
  });

  // And pressing it again gives it back. Options used to SUBMIT on click, so
  // there was no such thing as changing your mind about one.
  it('removes one that was', () => {
    expect(toggleChoice(['Teachers', 'Parents'], 'Teachers')).toEqual([
      'Parents',
    ]);
  });

  // The order the shortlist was written in, not the order they happened to be
  // clicked. A recorded answer that reads differently depending on which pill
  // someone tapped first is the same answer wearing two faces, and the agent
  // reading it back has no way to tell that.
  it('keeps the shortlist’s order however they were clicked', () => {
    const picked = toggleChoice(['Parents'], 'Teachers');
    expect(composeAnswer(picked, '', ['Teachers', 'Parents', 'Nurses'])).toBe(
      'Teachers, Parents',
    );
  });
});

describe('composeAnswer', () => {
  const shortlist = ['Teachers', 'Parents', 'Nurses'];

  // Options alone is a complete answer, and the commonest one on a card that
  // offers a shortlist worth offering.
  it('is the picked options when nothing was typed', () => {
    expect(composeAnswer(['Teachers', 'Nurses'], '', shortlist)).toBe(
      'Teachers, Nurses',
    );
  });

  // And your own words alone, which is every card with no shortlist at all.
  it('is the typed words when nothing was picked', () => {
    expect(composeAnswer([], 'Mostly the front desk', shortlist)).toBe(
      'Mostly the front desk',
    );
  });

  // The whole point of the change. A shortlist is a guess about what you might
  // say, and the two ways of answering were mutually exclusive — you could take
  // the guess or reject it, never take it AND qualify it, which is what a real
  // answer usually is.
  it('joins the picked options to the typed words, marked as separate', () => {
    expect(
      composeAnswer(['Teachers'], 'and the front desk on Fridays', shortlist),
    ).toBe('Teachers — and the front desk on Fridays');
  });

  // What gets stored is what was said, not the spacing around it — the answer
  // is read back by the partner and quoted onto cards.
  it('trims what was typed rather than recording the whitespace', () => {
    expect(composeAnswer([], '   Mostly nurses   ', shortlist)).toBe(
      'Mostly nurses',
    );
  });

  // A blank answer reads as the person having said nothing on purpose, which
  // is not something a Save button should be able to record.
  it('is null when nothing was picked and nothing typed', () => {
    expect(composeAnswer([], '', shortlist)).toBeNull();
    expect(composeAnswer([], '   ', shortlist)).toBeNull();
  });

  // A pick that is no longer on the shortlist — the partner rewrote the
  // options while someone had one selected. Dropping it silently would record
  // an answer they did not give; keeping it in place is the honest reading.
  it('keeps a pick the shortlist no longer offers, after the ones it does', () => {
    expect(composeAnswer(['Nurses', 'Porters'], '', shortlist)).toBe(
      'Nurses, Porters',
    );
  });
});

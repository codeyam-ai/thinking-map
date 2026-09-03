import { describe, expect, it } from 'vitest';
import {
  composeAnswer,
  orderPicks,
  restoreSelection,
  toggleChoice,
} from './answerDraft';

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

describe('orderPicks', () => {
  const shortlist = ['Teachers', 'Parents', 'Nurses'];

  // The card holds picks in the order they were tapped, and the recorded
  // structure must not. Both halves of a saved answer — the text and the
  // parts — are ordered by this one rule, so they cannot disagree.
  it('puts the picks in the shortlist’s order, not the tapped order', () => {
    expect(orderPicks(['Nurses', 'Teachers'], shortlist)).toEqual([
      'Teachers',
      'Nurses',
    ]);
  });

  // A pick the shortlist no longer offers is kept, after the ones it does —
  // dropping it would record an answer the person did not give.
  it('keeps a pick the shortlist no longer offers, after the ones it does', () => {
    expect(orderPicks(['Porters', 'Nurses'], shortlist)).toEqual([
      'Nurses',
      'Porters',
    ]);
  });

  // No shortlist at all: nothing to order against, and nothing is dropped.
  it('returns the picks unchanged when there is no shortlist', () => {
    expect(orderPicks(['Porters', 'Nurses'])).toEqual(['Porters', 'Nurses']);
  });
});

describe('restoreSelection', () => {
  const shortlist = ['Teachers', 'Parents', 'Nurses'];

  // The recorded parts win whenever the log carried them: they are what the
  // person DID, where reading the text back is only an inference about how it
  // came to be written.
  it('prefers what the log recorded over reading the text back', () => {
    expect(
      restoreSelection('anything at all', shortlist, {
        picked: ['Nurses'],
        text: 'on Fridays',
      }),
    ).toEqual({ picked: ['Nurses'], text: 'on Fridays' });
  });

  // A recorded selection with no write-in still restores as one, so the field
  // opens empty rather than inheriting whatever the display string said.
  it('restores a recorded selection that has no written half', () => {
    expect(
      restoreSelection('Teachers, Nurses', shortlist, {
        picked: ['Teachers', 'Nurses'],
      }),
    ).toEqual({ picked: ['Teachers', 'Nurses'], text: '' });
  });

  // The headline case, and the one the board actually takes: no recorded
  // parts, so the answer the node carries is read back apart. Both halves have
  // to come back, or amending one choice means retyping the rest.
  it('reads options and a written qualification back apart', () => {
    expect(
      restoreSelection('Teachers, Nurses — and the front desk', shortlist),
    ).toEqual({ picked: ['Teachers', 'Nurses'], text: 'and the front desk' });
  });

  // One option, recorded verbatim by composeAnswer — the commonest answer on
  // the whole board, and the case the plan's legacy rule names.
  it('treats an answer that is exactly one option as that option', () => {
    expect(restoreSelection('Nurses', shortlist)).toEqual({
      picked: ['Nurses'],
      text: '',
    });
  });

  // Prose that resolves to nothing on the shortlist: every option stays
  // offered and nothing is checked. Guessing here would silently drop half of
  // what somebody said.
  it('opens an answer it cannot resolve as written words, checking nothing', () => {
    expect(restoreSelection('Mostly the front desk', shortlist)).toEqual({
      picked: [],
      text: 'Mostly the front desk',
    });
  });

  // An answer that STARTS with an option but continues into prose is prose.
  // Matching the prefix would check a pill and then leave the rest of the
  // sentence in the box, recording it twice on the next save.
  it('does not part-match an option out of a longer sentence', () => {
    expect(
      restoreSelection('Nurses. Though the porters see it first', shortlist),
    ).toEqual({
      picked: [],
      text: 'Nurses. Though the porters see it first',
    });
  });

  // An option is free to contain the comma the picks are joined with, so a
  // whole-string match has to be tried before splitting on one — otherwise
  // this option becomes two options nobody offered.
  it('prefers a whole option containing a comma over splitting on it', () => {
    const commas = ['Parents, and carers', 'Teachers'];
    expect(restoreSelection('Parents, and carers', commas)).toEqual({
      picked: ['Parents, and carers'],
      text: '',
    });
  });

  // A run where only SOME parts are real options is not a pick list. Half a
  // selection is worse than none, because the half it drops is invisible.
  it('declines the whole run when only part of it is on the shortlist', () => {
    expect(restoreSelection('Teachers, Porters', shortlist)).toEqual({
      picked: [],
      text: 'Teachers, Porters',
    });
  });

  // Nothing recorded at all — a card being answered for the first time. The
  // editor opens empty rather than throwing on the null the node column holds.
  it('opens empty for a card with no answer yet', () => {
    expect(restoreSelection(null, shortlist)).toEqual({ picked: [], text: '' });
    expect(restoreSelection('   ', shortlist)).toEqual({ picked: [], text: '' });
  });

  // A question with no shortlist is the ordinary text-box card, and its whole
  // answer is the write-in.
  it('treats the whole answer as written words when there is no shortlist', () => {
    expect(restoreSelection('Just me')).toEqual({
      picked: [],
      text: 'Just me',
    });
  });

  // Whatever composeAnswer writes, restoreSelection must read back — the two
  // are one round trip and a drift between their separators would break
  // editing silently, which is the failure this pair exists to prevent.
  it('round-trips whatever composeAnswer produced', () => {
    const picked = ['Teachers', 'Nurses'];
    const text = 'and the front desk on Fridays';
    const written = composeAnswer(picked, text, shortlist);
    expect(restoreSelection(written, shortlist)).toEqual({ picked, text });
  });
});

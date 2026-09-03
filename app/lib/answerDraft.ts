// An answer being written on a card.
//
// A shortlist is a GUESS about what you might say. Until now the card treated
// the guess and your own words as mutually exclusive — take an option, or
// reject the lot and type instead — and the two were never both on screen,
// because stacking a field under four pills overflowed a fixed-height card.
//
// But "one of those, with a qualification" is what a real answer usually is,
// and "two of those" is not unusual either. So a draft here is a SET of picks
// and a piece of text, and both go in on one Save. The layout problem was real
// and is solved where it belongs — the list scrolls, the field is compact —
// rather than by removing half of what someone wanted to say.
//
// Pure, so the rule that decides what actually gets recorded — and the rule
// that reads it back apart again when the pencil reopens — is a test rather
// than something you have to reproduce by clicking.

/** The two seams `composeAnswer` writes at, and `restoreSelection` splits on.
 *  Named because reading an answer back has to split on exactly what writing
 *  it joined with, and two string literals drifting apart is how a round trip
 *  quietly stops being one. */
const BETWEEN_PICKS = ', ';
const BEFORE_WRITTEN = ' — ';

/** Add a choice, or take it away if it was already picked. */
export function toggleChoice(picked: string[], choice: string): string[] {
  return picked.includes(choice)
    ? picked.filter((c) => c !== choice)
    : [...picked, choice];
}

/**
 * What gets recorded, or null when there is nothing to record.
 *
 * The picks are written in the SHORTLIST's order rather than the order they
 * were clicked: an answer that reads differently depending on which pill was
 * tapped first is one answer wearing two faces, and the partner reading it
 * back has no way to tell those apart.
 *
 * A pick the shortlist no longer offers — the partner rewrote its options
 * while someone had one selected — is kept, after the ones it does offer.
 * Dropping it silently would record an answer the person did not give.
 *
 * The em dash between the picks and the typed words is doing real work: it
 * says the two parts came from different places, so "Teachers — and the front
 * desk on Fridays" cannot be misread as a single option somebody chose.
 */
export function composeAnswer(
  picked: string[],
  text: string,
  shortlist: string[] = [],
): string | null {
  const chosen = orderPicks(picked, shortlist).join(BETWEEN_PICKS);
  const written = text.trim();

  if (chosen && written) return `${chosen}${BEFORE_WRITTEN}${written}`;
  return chosen || written || null;
}

/**
 * The picks in the shortlist's order, with any it no longer offers after them.
 *
 * Pulled out of `composeAnswer` because the STRUCTURE recorded beside the
 * answer has to be ordered by the same rule as the string, and two copies of
 * that rule would drift. The card holds picks in the order they were tapped,
 * so without this the same answer records one order in its text and another in
 * its `selected` field — one answer wearing two faces, which is the exact
 * thing the ordering rule exists to prevent.
 */
export function orderPicks(picked: string[], shortlist: string[] = []): string[] {
  const known = shortlist.filter((choice) => picked.includes(choice));
  const unknown = picked.filter((choice) => !shortlist.includes(choice));
  return [...known, ...unknown];
}

/** A draft taken apart: which options were taken, and what was typed. */
export interface AnswerSelection {
  picked: string[];
  text: string;
}

/**
 * Read a run of text back as picks, or say it is not picks at all.
 *
 * The order of the two attempts is the whole subtlety. An option is free to
 * contain the comma we join with — "Parents, and carers" is an ordinary thing
 * for the partner to offer — so a WHOLE-string match is tried before splitting
 * on one. And a split only counts when EVERY part is an option the shortlist
 * actually offers: a partial match would mean inventing a selection nobody
 * made, which is a worse failure than showing the words exactly as typed.
 */
function readPicks(run: string, shortlist: string[]): string[] | null {
  if (shortlist.includes(run)) return [run];
  const parts = run.split(BETWEEN_PICKS);
  if (parts.length < 2) return null;
  if (!parts.every((part) => shortlist.includes(part))) return null;
  return parts;
}

/**
 * What the pencil opens with.
 *
 * Editing used to be the worst thing a card asked of you. The options
 * disappeared and the whole recorded answer arrived as prose in a box, so
 * amending one choice out of three meant retyping the other two from memory.
 * This is what puts the shortlist back: checked where you took an option,
 * still offered where you passed one over, and your own words back in the
 * field rather than fused to the options in front of them.
 *
 * `recorded` wins whenever the log carried it, because it is what the person
 * actually did rather than a reading of how it was written down. The fallback
 * is not a legacy path only — the board renders an answer off the node's own
 * `detail` column and never reads the log at all, so text is what the pencil
 * usually has to work from.
 *
 * That fallback is deliberately timid. It restores a selection only when the
 * text resolves ENTIRELY into options the shortlist offers; anything short of
 * that opens as written words with every option still there to take. Guessing
 * wrong would silently drop part of what somebody said, and the cost of being
 * timid is only a pill left unchecked that could have been checked.
 */
export function restoreSelection(
  answer: string | null | undefined,
  shortlist: string[] = [],
  recorded?: { picked?: unknown; text?: unknown } | null,
): AnswerSelection {
  if (recorded && Array.isArray(recorded.picked)) {
    return {
      picked: recorded.picked.filter(
        (choice): choice is string => typeof choice === 'string',
      ),
      text: typeof recorded.text === 'string' ? recorded.text : '',
    };
  }

  const written = (answer ?? '').trim();
  if (!written) return { picked: [], text: '' };

  const seam = written.indexOf(BEFORE_WRITTEN);
  if (seam > 0) {
    const picks = readPicks(written.slice(0, seam), shortlist);
    if (picks) {
      return {
        picked: picks,
        text: written.slice(seam + BEFORE_WRITTEN.length),
      };
    }
  }

  // Either the whole answer IS the shortlist's own words, in which case the
  // field starts empty and the pills carry it — leaving the text in as well
  // would have Save compose it twice — or it is something a person wrote, and
  // it goes back in the field exactly as they wrote it.
  const picks = readPicks(written, shortlist);
  return picks ? { picked: picks, text: '' } : { picked: [], text: written };
}

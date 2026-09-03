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
// Pure, so the rule that decides what actually gets recorded is a test rather
// than something you have to reproduce by clicking.

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
  const known = shortlist.filter((choice) => picked.includes(choice));
  const unknown = picked.filter((choice) => !shortlist.includes(choice));
  const chosen = [...known, ...unknown].join(', ');
  const written = text.trim();

  if (chosen && written) return `${chosen} — ${written}`;
  return chosen || written || null;
}

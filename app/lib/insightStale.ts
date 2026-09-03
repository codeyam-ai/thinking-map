// How far behind the thinking an insight is, in words.
//
// The stack is ungated: an insight goes up from the moment it is written, long
// before the rows around it are answered. What keeps that honest is not
// withholding the card but SAYING the gap on its face — an insight the person
// has since answered four questions past is still worth reading, and hiding it
// would silently shrink the board.
//
// So this sentence is the whole honesty mechanism, which is why it lives here
// rather than as a template literal inside the card. Same argument
// `askPresence` and `settledNote` make about their own wording: the copy IS the
// interface, and the only way to check a ternary inside JSX is to look at a
// screenshot.
//
// `insightStream` computes the COUNT; this only phrases it.

/**
 * The marker for an insight written before the person's last `answersSince`
 * answers.
 *
 * Zero is not a stale insight and has no marker — the caller decides whether to
 * render one, and asking this for a phrase would force it to invent a sentence
 * for a card that has nothing to admit. It returns null rather than an empty
 * string so a caller that forgets to check renders nothing instead of an empty
 * marker sitting in the layout.
 *
 * The singular is a real case, not a nicety: the first answer after an insight
 * lands is exactly when the marker first appears, so "written before your last
 * 1 answers" would be the FIRST thing anyone ever read here.
 */
export function staleNote(answersSince: number): string | null {
  if (answersSince <= 0) return null;
  if (answersSince === 1) return 'Written before your last answer';
  return `Written before your last ${answersSince} answers`;
}

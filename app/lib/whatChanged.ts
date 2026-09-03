// What has arrived since you last looked at the far end.
//
// The map keeps moving while you are working on it: you answer a card, the
// partner reads the map and writes something at the far end, and the next time
// you go there the column has changed in a way nothing on screen accounts for.
// So the far end remembers what you had seen the last time you were there, and
// marks the rest.
//
// Deliberately session-scoped and deliberately id-based. Not stored, because
// "since you last looked" is a fact about this sitting rather than about this
// browser — coming back tomorrow to a column full of NEW badges would be
// technically true and useless. And ids rather than timestamps, because the
// question is "have I read this", which a clock cannot answer.

/**
 * The ids to mark, given what was on screen at the last look.
 *
 * `null` means the far end has not been looked at yet, and marks nothing:
 * everything being new on first sight is true and carries no information. The
 * result only ever contains things currently present, because it is a set of
 * things to draw a marker ON — something removed since the last look is not
 * something new.
 */
export function newSince(
  seen: ReadonlySet<string> | null,
  present: { id: string }[],
): Set<string> {
  if (!seen) return new Set();
  return new Set(present.filter((it) => !seen.has(it.id)).map((it) => it.id));
}

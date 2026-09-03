// What the person has already said, and what they might say.
//
// Both feed the one affordance on a question card: the recorded answer it shows
// back, and the chips it offers to start from.
//
// The answer is read off the exchange log rather than stored on the node, and
// that is deliberate — `resolveAnswered` in `app/lib/contributions.ts` flips a
// question to `answered` and never keeps the text, because the text belongs to
// the log where both sides can see it. Editing an answer is therefore just
// posting another `user.answer`, and the edit history is free.
//
// Modelled directly on `askedNodeIds` in `app/lib/exchangeRail.ts`: a per-node
// fact derived from the log, so it stays true across a reload and counts what
// happened at every front door rather than only in this tab.

import type { ExchangeEvent } from './exchange';

/**
 * The latest answer per question id.
 *
 * Latest, not first: answering again is how an answer is edited, and the
 * server already logs the second answer without inventing a second change. So
 * the last one written is the one that stands.
 *
 * A malformed entry is skipped rather than throwing — one bad payload should
 * not blank every other answer on the map.
 */
export function answersByNodeId(events: ExchangeEvent[]): Map<string, string> {
  const answers = new Map<string, string>();

  for (const event of [...events].sort((a, b) => a.revision - b.revision)) {
    if (event.kind !== 'user.answer') continue;
    const payload = event.payload as {
      answers?: { id?: unknown; answer?: unknown }[];
    } | null;
    if (!Array.isArray(payload?.answers)) continue;

    for (const entry of payload.answers) {
      const id = entry?.id;
      const answer = entry?.answer;
      if (typeof id !== 'string' || id.length === 0) continue;
      if (typeof answer !== 'string' || answer.trim().length === 0) continue;
      answers.set(id, answer);
    }
  }

  return answers;
}

/**
 * The latest SELECTION per question id — the same answers, taken apart.
 *
 * An answer is a string everywhere it is read, and that is deliberate: the
 * node's `detail` column, the chat bubbles, the rail and the agent all take it
 * as text, and none of them had to change for an answer to become a set. But
 * the string alone cannot always be read back apart — an option containing the
 * separator, or a write-in that happens to equal an option, are both genuinely
 * ambiguous — so the parts ride ALONGSIDE it, and this is what reads them.
 *
 * Deliberately separate from `answersByNodeId` rather than folded into it. That
 * function returns what every existing reader wants and is unchanged; a caller
 * that needs the structure asks for it, and one that does not is untouched.
 *
 * An event carrying no selection is PASSED OVER rather than recorded as an
 * empty one. Blanking a previous selection because a later legacy write did not
 * carry structure would lose information rather than decline to add any — and
 * with `answersByNodeId` still holding the text, the pencil falls back to
 * reading it apart, which is strictly better than opening on nothing.
 *
 * Same tolerance for a malformed entry as its sibling: skipped, never thrown.
 */
export function selectionsByNodeId(
  events: ExchangeEvent[],
): Map<string, { picked: string[]; text: string }> {
  const selections = new Map<string, { picked: string[]; text: string }>();

  for (const event of [...events].sort((a, b) => a.revision - b.revision)) {
    if (event.kind !== 'user.answer') continue;
    const payload = event.payload as {
      answers?: { id?: unknown; selected?: unknown; other?: unknown }[];
    } | null;
    if (!Array.isArray(payload?.answers)) continue;

    for (const entry of payload.answers) {
      const id = entry?.id;
      if (typeof id !== 'string' || id.length === 0) continue;
      // The presence of `selected` is what marks an entry as carrying
      // structure. An entry without it is a write from before the log recorded
      // any, and saying nothing about that node is the honest result.
      //
      // `selected` and `other` rather than the card's own `picked` / `text`:
      // an entry in this payload ALREADY has a `text`, and it is the question's
      // label, not anything the person typed. Reusing the name would have made
      // a write-in and a question indistinguishable in the log.
      if (!Array.isArray(entry.selected)) continue;
      selections.set(id, {
        picked: entry.selected.filter(
          (choice): choice is string => typeof choice === 'string',
        ),
        text: typeof entry.other === 'string' ? entry.other : '',
      });
    }
  }

  return selections;
}

/**
 * Attach the structure to the entries about to be written to the log.
 *
 * The counterpart to `selectionsByNodeId`, deliberately in the same file: what
 * this writes is exactly what that reads, and the pair being one edit apart is
 * what keeps the two field names from drifting into a round trip that silently
 * stops closing.
 *
 * ADDITIVE, and that is the whole contract. An entry whose card supplied no
 * parts comes back UNTOUCHED — not with empty fields — so a question answered
 * without a shortlist writes precisely the entry it wrote before an answer
 * could be a set, and every existing reader of `answer` is unaffected either
 * way.
 */
export function withSelections<T extends { id: string }>(
  entries: T[],
  parts?: Record<string, { picked: string[]; text: string }>,
): T[] {
  if (!parts) return entries;
  return entries.map((entry) => {
    const supplied = parts[entry.id];
    return supplied
      ? { ...entry, selected: supplied.picked, other: supplied.text }
      : entry;
  });
}

/**
 * The suggested answers stored on a node, as chips.
 *
 * SQLite has no array type, so the column holds a JSON array of strings. A
 * value that is missing, malformed, or not an array of strings yields no chips
 * at all: a card with no options is just a card with an input, which is the
 * ordinary case rather than a degraded one, so there is nothing to report.
 */
export function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (option): option is string =>
        typeof option === 'string' && option.trim().length > 0,
    );
  } catch {
    return [];
  }
}
